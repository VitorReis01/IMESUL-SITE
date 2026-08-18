import { NextResponse } from "next/server";
import { isAdminRequest } from "../../../../Backend.js/adminSecurity";
import { clearAnalyticsEvents } from "../../../../Backend.js/analyticsStore";

// Limpa eventos locais apenas a partir do painel admin autenticado.
const noStoreJson = (body, init = {}) =>
  NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init.headers || {}),
    },
  });

const methodNotAllowed = () =>
  noStoreJson({ ok: false, message: "Método não permitido." }, { status: 405, headers: { Allow: "DELETE" } });

export async function DELETE(request) {
  try {
    // Falha ao verificar a sessao (ex.: banco indisponivel) nunca deve liberar acesso -
    // trata como nao autorizado (fail-closed), nunca deixa o erro estourar sem resposta.
    if (!(await isAdminRequest(request))) {
      return noStoreJson({ ok: false, message: "Acesso não autorizado." }, { status: 401 });
    }
  } catch {
    return noStoreJson({ ok: false, message: "Acesso não autorizado." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const visitorId = (searchParams.get("visitorId") || "").slice(0, 120);
    await clearAnalyticsEvents({ visitorId });

    return noStoreJson({ ok: true });
  } catch {
    return noStoreJson({ ok: false, message: "Não foi possível limpar os eventos." }, { status: 500 });
  }
}

export const GET = methodNotAllowed;
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
