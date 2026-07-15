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
  if (!isAdminRequest(request)) {
    return noStoreJson({ ok: false, message: "Acesso não autorizado." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const visitorId = (searchParams.get("visitorId") || "").slice(0, 120);
    const events = await clearAnalyticsEvents({ visitorId });

    return noStoreJson({
      ok: true,
      source: "backend-local-json",
      events,
    });
  } catch {
    return noStoreJson({ ok: false, message: "Não foi possível limpar os eventos." }, { status: 500 });
  }
}

export const GET = methodNotAllowed;
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
