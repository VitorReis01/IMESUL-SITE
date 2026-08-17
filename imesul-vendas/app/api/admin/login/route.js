import { NextResponse } from "next/server";
import {
  checkIpRateLimit,
  checkUsernameRateLimit,
  createAdminSession,
  getAccountFrictionDelayMs,
  registerFailedAdminAttempt,
  resetAdminRateLimit,
  safeCompare,
} from "../../../../Backend.js/adminSecurity";

// Valida o login admin no servidor para manter usuario e senha fora do bundle do navegador.
const genericErrorMessage = "Usuário ou senha inválidos.";
const maxBodyBytes = 4096;
const maxFieldLength = 256;

const getFirstForwardedIp = (value = "") => value.split(",")[0]?.trim() || "";

const getRequestIp = (request) =>
  getFirstForwardedIp(request.headers.get("x-forwarded-for") || "") ||
  request.headers.get("x-real-ip") ||
  request.headers.get("cf-connecting-ip") ||
  request.ip ||
  "unknown";

const noStoreJson = (body, init = {}) =>
  NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init.headers || {}),
    },
  });

const tooManyRequests = (retryAfterSeconds) =>
  noStoreJson(
    { ok: false, message: "Muitas tentativas. Tente novamente em instantes." },
    { status: 429, headers: { "Retry-After": String(Math.max(retryAfterSeconds, 1)) } }
  );

const invalidRequest = () => noStoreJson({ ok: false, message: genericErrorMessage }, { status: 400 });

const methodNotAllowed = () =>
  noStoreJson({ ok: false, message: "Método não permitido." }, { status: 405, headers: { Allow: "POST" } });

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

  try {
    // 1) Camada barata: so IP, antes de tocar no corpo da requisicao.
    const ipLimit = checkIpRateLimit(ipKey);
    if (!ipLimit.allowed) return tooManyRequests(ipLimit.retryAfterSeconds);

    // 2) Tamanho do corpo, antes de fazer parse.
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > maxBodyBytes) {
      registerFailedAdminAttempt(ipKey, "");
      return invalidRequest();
    }

    // 3) Parse e schema.
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

    // 4) Camada por IP+usuario, agora que ja sabemos o usuario informado.
    const usernameLimit = checkUsernameRateLimit(ipKey, user);
    if (!usernameLimit.allowed) return tooManyRequests(usernameLimit.retryAfterSeconds);

    // 5) Atraso proporcional se essa CONTA estiver sob ataque distribuido (varios IPs). Nunca bloqueia.
    const frictionDelayMs = getAccountFrictionDelayMs(user);
    if (frictionDelayMs > 0) await sleep(frictionDelayMs);

    // 6) Comparacao de credenciais, resistente a timing attack.
    const expectedUser = process.env.ADMIN_DEMO_USER || "";
    const expectedPassword = process.env.ADMIN_DEMO_PASSWORD || "";
    const validCredentials =
      Boolean(expectedUser) && Boolean(expectedPassword) && safeCompare(user, expectedUser) && safeCompare(password, expectedPassword);

    if (!validCredentials) {
      registerFailedAdminAttempt(ipKey, user);
      return noStoreJson({ ok: false, message: genericErrorMessage }, { status: 401 });
    }

    // 7) Sessao.
    resetAdminRateLimit(ipKey, user);
    return noStoreJson({ ok: true, adminSessionToken: createAdminSession() });
  } catch {
    registerFailedAdminAttempt(ipKey, "");
    return invalidRequest();
  }
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
