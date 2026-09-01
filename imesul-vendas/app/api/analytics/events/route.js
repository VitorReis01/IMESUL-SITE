import { isAdminRequest } from "../../../../Backend.js/adminSecurity";
import { getAnalyticsEventsPage, getAnalyticsSummary } from "../../../../Backend.js/analyticsStore";
import { checkGlobalApiRateLimit, checkRateLimitLayers } from "../../../../Backend.js/rateLimiter";
import { checkOrigin, forbidden, getRequestIp, methodNotAllowed as sharedMethodNotAllowed, noStoreJson } from "../../../../Backend.js/requestGuards";

// Entrega eventos paginados (server-side) e metricas agregadas somente para uma sessao admin
// valida; impede cache de dados sensiveis. Todos os parametros vem sanitizados/normalizados
// dentro de analyticsStore.js (allowlist de periodo/tipo, LIMIT de pageSize, etc.).
const methodNotAllowed = () => sharedMethodNotAllowed("GET");

export async function GET(request) {
  // Sessão via cookie HttpOnly SameSite=Strict - checkOrigin é defesa extra contra CSRF (rota é
  // GET/leitura; a proteção real é o SameSite=Strict do cookie, ver Backend.js/adminSecurity.js).
  if (!checkOrigin(request).allowed) return forbidden();

  try {
    // Falha ao verificar a sessao (ex.: banco indisponivel) nunca deve liberar acesso -
    // trata como nao autorizado (fail-closed), nunca deixa o erro estourar sem resposta.
    if (!(await isAdminRequest(request))) {
      return noStoreJson({ ok: false, message: "Acesso não autorizado." }, { status: 401 });
    }
  } catch {
    return noStoreJson({ ok: false, message: "Acesso não autorizado." }, { status: 401 });
  }

  // Camada GLOBAL (compartilhada por TODAS as rotas /api, mesma chave por IP) - ALEM do limite
  // especifico abaixo, nunca no lugar dele. Ver Backend.js/rateLimiter.js.
  try {
    const globalLimit = await checkGlobalApiRateLimit(request);
    if (!globalLimit.allowed) {
      return noStoreJson(
        { ok: false, message: "Muitas solicitações. Tente novamente em instantes." },
        { status: 429, headers: { "Retry-After": String(globalLimit.retryAfterSeconds) } }
      );
    }
  } catch {
    return noStoreJson({ ok: false, message: "Serviço temporariamente indisponível." }, { status: 503 });
  }

  // Defesa em profundidade: mesmo com sessao valida, limita a frequencia de consultas.
  try {
    const rateLimit = await checkRateLimitLayers([
      { key: `analytics-events:${getRequestIp(request)}`, windowMs: 60_000, max: 60 },
    ]);
    if (!rateLimit.allowed) {
      return noStoreJson(
        { ok: false, message: "Muitas solicitações. Tente novamente em instantes." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }
  } catch {
    return noStoreJson({ ok: false, message: "Serviço temporariamente indisponível." }, { status: 503 });
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
