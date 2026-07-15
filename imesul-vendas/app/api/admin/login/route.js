import { NextResponse } from "next/server";
import {
  checkAdminRateLimit,
  createAdminSession,
  registerFailedAdminAttempt,
  resetAdminRateLimit,
} from "../../../../Backend.js/adminSecurity";

// Valida o login admin no servidor para manter usuario e senha fora do bundle do navegador.
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

const methodNotAllowed = () =>
  noStoreJson({ ok: false, message: "Método não permitido." }, { status: 405, headers: { Allow: "POST" } });

// Login admin de demonstracao. Em producao, usar autenticacao segura com sessao/cookies e senha com hash.
export async function POST(request) {
  const ipKey = getRequestIp(request);

  try {
    const rateLimit = checkAdminRateLimit(ipKey);
    if (!rateLimit.allowed) {
      return noStoreJson({ ok: false, message: "Usuário ou senha inválidos." }, { status: 429 });
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 4096) {
      registerFailedAdminAttempt(ipKey);
      return noStoreJson({ ok: false, message: "Usuário ou senha inválidos." }, { status: 400 });
    }

    const { user = "", password = "" } = await request.json();
    const expectedUser = process.env.ADMIN_DEMO_USER || "";
    const expectedPassword = process.env.ADMIN_DEMO_PASSWORD || "";
    const validCredentials =
      expectedUser &&
      expectedPassword &&
      String(user).trim() === expectedUser &&
      String(password) === expectedPassword;

    if (!validCredentials) {
      registerFailedAdminAttempt(ipKey);
      return noStoreJson({ ok: false, message: "Usuário ou senha inválidos." }, { status: 401 });
    }

    resetAdminRateLimit(ipKey);
    return noStoreJson({ ok: true, adminSessionToken: createAdminSession() });
  } catch {
    registerFailedAdminAttempt(ipKey);
    return noStoreJson({ ok: false, message: "Usuário ou senha inválidos." }, { status: 400 });
  }
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
