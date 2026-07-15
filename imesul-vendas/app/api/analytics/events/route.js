import { NextResponse } from "next/server";
import { isAdminRequest } from "../../../../Backend.js/adminSecurity";
import { getAnalyticsEvents } from "../../../../Backend.js/analyticsStore";

// Entrega eventos somente para uma sessao admin valida e impede cache de dados sensiveis.
const noStoreJson = (body, init = {}) =>
  NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init.headers || {}),
    },
  });

const methodNotAllowed = () =>
  noStoreJson({ ok: false, message: "Método não permitido." }, { status: 405, headers: { Allow: "GET" } });

export async function GET(request) {
  if (!isAdminRequest(request)) {
    return noStoreJson({ ok: false, message: "Acesso não autorizado." }, { status: 401 });
  }

  try {
    const events = await getAnalyticsEvents();

    return noStoreJson({
      ok: true,
      source: "backend-local-json",
      events,
    });
  } catch {
    return noStoreJson({ ok: false, message: "Não foi possível carregar os eventos." }, { status: 500 });
  }
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
