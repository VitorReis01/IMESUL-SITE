import { isAdminRequest } from "../../../../../Backend.js/adminSecurity";
import { logger } from "../../../../../Backend.js/logger";
import { query } from "../../../../../Backend.js/db";
import { checkGlobalApiRateLimit, checkRateLimitLayers } from "../../../../../Backend.js/rateLimiter";
import { checkOrigin, forbidden, getRequestId, getRequestIp, methodNotAllowed as sharedMethodNotAllowed, noStoreJson } from "../../../../../Backend.js/requestGuards";

const timeoutMs = 1500;
const slowQueryThresholdMs = 500;

const methodNotAllowed = () => sharedMethodNotAllowed("GET");

const serviceNames = {
  institutional: "Site Institucional",
  sales: "Site de Vendas",
  api: "API",
  database: "Banco de Dados",
  rateLimiter: "Rate Limiter",
};

const measure = async (task) => {
  const startedAt = Date.now();
  await task();
  return Date.now() - startedAt;
};

const withTimeout = (promise, ms = timeoutMs) => {
  const controller = new AbortController();
  let timeoutId;

  const run = typeof promise === "function" ? promise(controller.signal) : promise;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error("timeout"));
    }, ms);
  });

  return Promise.race([Promise.resolve(run), timeout]).finally(() => clearTimeout(timeoutId));
};

const checkHttpHealth = async (url) => {
  if (!url) return { status: "degraded", latencyMs: null, lastFailure: "Endpoint não configurado" };

  try {
    const latencyMs = await measure(async () => {
      const response = await withTimeout((signal) => fetch(url, { cache: "no-store", signal }));
      if (!response.ok) throw new Error("unhealthy");
    });

    return { status: "online", latencyMs, lastFailure: null };
  } catch {
    return { status: "offline", latencyMs: null, lastFailure: "Falha na verificação" };
  }
};

const checkDatabase = async () => {
  try {
    const latencyMs = await measure(() => withTimeout(query("SELECT 1")));
    if (latencyMs > slowQueryThresholdMs) {
      return { status: "degraded", latencyMs, lastFailure: "Latência acima do esperado" };
    }
    return { status: "online", latencyMs, lastFailure: null };
  } catch {
    return { status: "offline", latencyMs: null, lastFailure: "Banco indisponível" };
  }
};

const deriveRateLimiterStatus = (databaseResult) => databaseResult;

const normalizeBaseUrl = (value = "") => {
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
};

const buildService = (key, result, checkedAt) => ({
  name: serviceNames[key],
  status: result.status,
  latencyMs: typeof result.latencyMs === "number" ? result.latencyMs : null,
  lastCheck: checkedAt,
  lastFailure: result.lastFailure || null,
});

const getSecuritySnapshot = async () => {
  const [analyticsResult, rateLimitResult] = await Promise.all([
    query(
      `SELECT
         COUNT(*) FILTER (
           WHERE suspicious = TRUE
             AND event_timestamp >= NOW() - INTERVAL '24 hours'
         )::int AS suspicious_events_24h,
         COUNT(DISTINCT visitor_id) FILTER (
           WHERE suspicious = TRUE
             AND event_timestamp >= NOW() - INTERVAL '24 hours'
         )::int AS suspicious_visitors_24h,
         COUNT(*) FILTER (
           WHERE suspicious = TRUE
             AND event_timestamp >= NOW() - INTERVAL '1 hour'
         )::int AS suspicious_events_1h
       FROM analytics_events`
    ),
    query(
      `SELECT COUNT(*)::int AS active_counters
         FROM rate_limit_counters
        WHERE window_start >= NOW() - INTERVAL '24 hours'`
    ),
  ]);

  const analytics = analyticsResult.rows[0] || {};
  const limiter = rateLimitResult.rows[0] || {};

  return {
    suspiciousEvents24h: analytics.suspicious_events_24h || 0,
    suspiciousVisitors24h: analytics.suspicious_visitors_24h || 0,
    suspiciousEvents1h: analytics.suspicious_events_1h || 0,
    activeRateLimitCounters24h: limiter.active_counters || 0,
  };
};

export async function GET(request) {
  if (!checkOrigin(request).allowed) return forbidden();

  try {
    if (!(await isAdminRequest(request))) {
      return noStoreJson({ ok: false, message: "Acesso não autorizado." }, { status: 401 });
    }
  } catch {
    return noStoreJson({ ok: false, message: "Acesso não autorizado." }, { status: 401 });
  }

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

  try {
    const rateLimit = await checkRateLimitLayers([
      { key: `admin-monitoring-status:${getRequestIp(request)}`, windowMs: 60_000, max: 30 },
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

  const checkedAt = new Date().toISOString();
  const salesBaseUrl = new URL(request.url).origin;
  const institutionalBaseUrl = normalizeBaseUrl(
    process.env.NEXT_PUBLIC_INSTITUTIONAL_URL || process.env.NEXT_PUBLIC_INSTITUTIONAL_SITE_URL
  );

  const [institutional, sales, database, security] = await Promise.all([
    checkHttpHealth(institutionalBaseUrl ? `${institutionalBaseUrl}/api/health` : ""),
    checkHttpHealth(`${salesBaseUrl}/api/health`),
    checkDatabase(),
    getSecuritySnapshot().catch(() => ({
      suspiciousEvents24h: null,
      suspiciousVisitors24h: null,
      suspiciousEvents1h: null,
      activeRateLimitCounters24h: null,
    })),
  ]);

  const services = {
    institutional: buildService("institutional", institutional, checkedAt),
    sales: buildService("sales", sales, checkedAt),
    api: buildService("api", { status: "online", latencyMs: null, lastFailure: null }, checkedAt),
    database: buildService("database", database, checkedAt),
    rateLimiter: buildService("rateLimiter", deriveRateLimiterStatus(database), checkedAt),
  };

  const healthyStatuses = new Set(["online"]);
  const incidents = Object.entries(services)
    .filter(([, service]) => !healthyStatuses.has(service.status))
    .map(([key, service]) => ({
      service: key,
      label: service.name,
      status: service.status,
      message: service.lastFailure || "Serviço indisponível",
      checkedAt,
    }));

  const requestId = getRequestId(request);
  if (incidents.length > 0) {
    logger.warn("health_degraded", {
      requestId,
      services: incidents.map((incident) => incident.service),
    });
  }

  return noStoreJson(
    {
      ok: true,
      checkedAt,
      services,
      incidents,
      security,
    },
    { headers: { "X-Request-ID": requestId } }
  );
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
