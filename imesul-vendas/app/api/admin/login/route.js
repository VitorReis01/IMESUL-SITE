import {
  checkIpRateLimit,
  checkUsernameRateLimit,
  createAdminSession,
  getAccountFrictionDelayMs,
  registerFailedAdminAttempt,
  resetAdminRateLimit,
  safeCompare,
  setAdminSessionCookie,
} from "../../../../Backend.js/adminSecurity";
import { verifyAdminPassword } from "../../../../lib/adminPasswordHash";
import { checkGlobalApiRateLimit } from "../../../../Backend.js/rateLimiter";
import {
  checkOrigin,
  forbidden,
  getRequestIp,
  hasValidJsonContentType,
  methodNotAllowed as sharedMethodNotAllowed,
  noStoreJson,
  tooManyRequests,
} from "../../../../Backend.js/requestGuards";

// Valida o login admin no servidor para manter usuario e senha fora do bundle do navegador.
const genericErrorMessage = "Usuário ou senha inválidos.";
const maxBodyBytes = 4096;
const maxFieldLength = 256;

const invalidRequest = () => noStoreJson({ ok: false, message: genericErrorMessage }, { status: 400 });

const methodNotAllowed = () => sharedMethodNotAllowed("POST");

// Fail closed: se o rate limiter (Postgres) estiver indisponivel, trata como bloqueado - nunca
// libera o login sem limite so porque o rate limiter caiu (ver auditoria de seguranca).
const serviceUnavailable = () =>
  noStoreJson({ ok: false, message: "Serviço temporariamente indisponível. Tente novamente em instantes." }, { status: 503 });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Aceita somente strings simples de tamanho razoavel; rejeita arrays, objetos e campos ausentes.
const readCredentialsFromBody = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;

  const { user, password } = body;
  if (typeof user !== "string" || typeof password !== "string") return null;
  if (!user.trim() || !password) return null;
  if (user.length > maxFieldLength || password.length > maxFieldLength) return null;

  return { user: user.trim(), password };
};

// Login admin: senha comparada via hash scrypt (ADMIN_PASSWORD_HASH), sessao entregue como
// cookie HttpOnly (nunca no corpo da resposta) - ver Backend.js/adminSecurity.js.
export async function POST(request) {
  const ipKey = getRequestIp(request);

  // 0) Camadas mais baratas primeiro: Origin (so navegador chama este endpoint) e Content-Type.
  // Nenhuma das duas e autenticacao - so mais uma camada, a sessao/senha continuam obrigatorias.
  if (!checkOrigin(request, { requireOriginInProduction: true }).allowed) return forbidden();
  if (!hasValidJsonContentType(request)) {
    return noStoreJson({ ok: false, message: genericErrorMessage }, { status: 415 });
  }

  // 1) Camada GLOBAL (compartilhada por TODAS as rotas /api, mesma chave por IP) - ALEM do
  // limite especifico abaixo, nunca no lugar dele. Ver Backend.js/rateLimiter.js.
  let globalLimit;
  try {
    globalLimit = await checkGlobalApiRateLimit(request);
  } catch {
    return serviceUnavailable();
  }
  if (!globalLimit.allowed) return tooManyRequests(globalLimit.retryAfterSeconds);

  // 2) Rate limit por IP (Postgres, distribuido - ver adminSecurity.js). FAIL CLOSED: se a
  // checagem falhar (banco indisponivel), trata como bloqueado, nunca como liberado.
  let ipLimit;
  try {
    ipLimit = await checkIpRateLimit(ipKey);
  } catch {
    return serviceUnavailable();
  }
  if (!ipLimit.allowed) return tooManyRequests(ipLimit.retryAfterSeconds);

  try {
    // 3) Tamanho do corpo, antes de fazer parse.
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > maxBodyBytes) {
      registerFailedAdminAttempt(ipKey, "");
      return invalidRequest();
    }

    // 4) Parse e schema.
    let body;
    try {
      body = await request.json();
    } catch {
      registerFailedAdminAttempt(ipKey, "");
      return invalidRequest();
    }

    const credentials = readCredentialsFromBody(body);
    if (!credentials) {
      registerFailedAdminAttempt(ipKey, typeof body?.user === "string" ? body.user : "");
      return invalidRequest();
    }

    const { user, password } = credentials;

    // 5) Camada por IP+usuario (Postgres), agora que ja sabemos o usuario informado. Mesma
    // politica fail-closed dos passos 1 e 2.
    let usernameLimit;
    try {
      usernameLimit = await checkUsernameRateLimit(ipKey, user);
    } catch {
      return serviceUnavailable();
    }
    if (!usernameLimit.allowed) return tooManyRequests(usernameLimit.retryAfterSeconds);

    // 6) Atraso proporcional se essa CONTA estiver sob ataque distribuido (varios IPs). Nunca bloqueia.
    const frictionDelayMs = getAccountFrictionDelayMs(user);
    if (frictionDelayMs > 0) await sleep(frictionDelayMs);

    // 7) Comparacao de credenciais, resistente a timing attack. O username é comparado com
    // safeCompare (tempo constante); a senha SEMPRE roda por verifyAdminPassword (scrypt),
    // mesmo quando o username já está errado - combinar os dois resultados só depois com "&&"
    // (nunca fazendo curto-circuito no username) evita que "usuário errado" responda mais rápido
    // que "senha errada" e vaze qual dos dois estava incorreto (ver relatório de hardening).
    const isProduction = process.env.NODE_ENV === "production";
    const expectedUser = process.env.ADMIN_DEMO_USER || "";
    const configuredHash = process.env.ADMIN_PASSWORD_HASH || "";
    // ADMIN_DEMO_PASSWORD em texto puro só é aceito fora de produção - nunca lido quando
    // NODE_ENV=production, mesmo que a variável ainda exista no ambiente (ver seção "Senha admin
    // com hash" do relatório de hardening).
    const legacyDevPassword = !isProduction ? process.env.ADMIN_DEMO_PASSWORD || "" : "";

    const userMatches = Boolean(expectedUser) && safeCompare(user, expectedUser);

    let passwordMatches;
    if (configuredHash) {
      passwordMatches = await verifyAdminPassword(password, configuredHash);
    } else if (legacyDevPassword) {
      console.warn(
        "[security] login-admin: ADMIN_PASSWORD_HASH não configurada - usando ADMIN_DEMO_PASSWORD em texto puro (permitido só fora de produção). Gere um hash com scripts/generate-admin-password-hash.mjs."
      );
      passwordMatches = safeCompare(password, legacyDevPassword);
    } else {
      // Fail-closed: nenhuma credencial configurada. Ainda assim roda verifyAdminPassword contra
      // um hash inválido para manter o mesmo custo de tempo do caminho com hash real configurado.
      passwordMatches = await verifyAdminPassword(password, "");
    }

    const validCredentials = userMatches && passwordMatches;

    if (!validCredentials) {
      registerFailedAdminAttempt(ipKey, user);
      return noStoreJson({ ok: false, message: genericErrorMessage }, { status: 401 });
    }

    // 8) Sessao: cookie HttpOnly, nunca token no corpo da resposta (ver Backend.js/adminSecurity.js).
    await resetAdminRateLimit(ipKey, user);
    const response = noStoreJson({ ok: true });
    setAdminSessionCookie(response, await createAdminSession());
    return response;
  } catch {
    registerFailedAdminAttempt(ipKey, "");
    return invalidRequest();
  }
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
