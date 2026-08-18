import { NextResponse } from "next/server";
import { isAdminRequest } from "../../../../Backend.js/adminSecurity";
import { getAnalyticsEventsPage, getAnalyticsSummary } from "../../../../Backend.js/analyticsStore";

// Entrega eventos paginados (server-side) e metricas agregadas somente para uma sessao admin
// valida; impede cache de dados sensiveis. Todos os parametros vem sanitizados/normalizados
// dentro de analyticsStore.js (allowlist de periodo/tipo, LIMIT de pageSize, etc.).
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
    const { searchParams } = new URL(request.url);
    const queryParams = {
      page: searchParams.get("page"),
      pageSize: searchParams.get("pageSize"),
      type: searchParams.get("type") || "all",
      period: searchParams.get("period") || "all",
      search: searchParams.get("search") || "",
      hasDeviceLocation: searchParams.get("hasDeviceLocation") === "true",
    };

    const [page, summary] = await Promise.all([
      getAnalyticsEventsPage(queryParams),
      getAnalyticsSummary({ period: queryParams.period }),
    ]);

    return noStoreJson({
      ok: true,
      events: page.events,
      pagination: page.pagination,
      summary,
    });
  } catch {
    return noStoreJson({ ok: false, message: "Não foi possível carregar os eventos." }, { status: 500 });
  }
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
