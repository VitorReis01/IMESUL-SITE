import { NextResponse } from "next/server";
import { invalidateAdminSession } from "../../../../Backend.js/adminSecurity";

// Revoga a sessao admin no servidor. Sem isto, o botao "Sair do admin" so limpava o token
// em memoria no navegador - o token continuava valido no servidor ate o TTL natural.
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

// Idempotente de proposito: sempre responde ok, mesmo sem token ou com token ja expirado.
// Nao ha nada sensivel a proteger aqui alem do proprio token, que so o dono conhece.
export async function POST(request) {
  try {
    await invalidateAdminSession(request);
  } catch {
    // Falha ao revogar (ex.: banco indisponivel) nao pode travar o logout do lado do cliente;
    // o token local ja e descartado independentemente da resposta desta rota.
  }
  return noStoreJson({ ok: true });
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
