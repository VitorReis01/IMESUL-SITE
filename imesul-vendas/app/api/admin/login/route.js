import {
  checkIpRateLimit,
  checkUsernameRateLimit,
  createAdminSession,
  getAccountFrictionDelayMs,
  registerFailedAdminAttempt,
  resetAdminRateLimit,
  safeCompare,
} from "../../../../Backend.js/adminSecurity";
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

// Login admin de demonstracao. Em producao, usar autenticacao segura com sessao/cookies e senha com hash.
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

    // 7) Comparacao de credenciais, resistente a timing attack.
    const expectedUser = process.env.ADMIN_DEMO_USER || "";
    const expectedPassword = process.env.ADMIN_DEMO_PASSWORD || "";
    const validCredentials =
      Boolean(expectedUser) && Boolean(expectedPassword) && safeCompare(user, expectedUser) && safeCompare(password, expectedPassword);

    if (!validCredentials) {
      registerFailedAdminAttempt(ipKey, user);
      return noStoreJson({ ok: false, message: genericErrorMessage }, { status: 401 });
    }

    // 8) Sessao.
    await resetAdminRateLimit(ipKey, user);
    return noStoreJson({ ok: true, adminSessionToken: await createAdminSession() });
  } catch {
    registerFailedAdminAttempt(ipKey, "");
    return invalidRequest();
  }
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
