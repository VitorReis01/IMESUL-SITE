import { isMonitoringRequestAuthorized } from "../../../../Backend.js/monitoringAuth";
import { checkRateLimitLayers } from "../../../../Backend.js/rateLimiter";
import { getRequestIp, noStoreJson } from "../../../../Backend.js/requestGuards";
import { query } from "../../../../Backend.js/db";

const timeoutMs = 1500;

const withTimeout = (promise) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("timeout")), timeoutMs);
    }),
  ]);

export async function GET(request) {
  if (!isMonitoringRequestAuthorized(request)) {
    return noStoreJson({ status: "unauthorized" }, { status: 401 });
  }

  // Rota toca o banco diretamente a cada chamada - mesmo autenticada pelo x-monitoring-key, um
  // segredo vazado (ou um monitor mal configurado disparando muito rápido) não pode floodar o
  // Postgres com SELECT 1. FAIL CLOSED: se o próprio rate limiter (Postgres) falhar, trata como
  // indisponível - nunca libera a checagem sem limite (ver Backend.js/rateLimiter.js).
  try {
    const rateLimit = await checkRateLimitLayers([
      { key: `health-database:${getRequestIp(request)}`, windowMs: 60_000, max: 30 },
    ]);
    if (!rateLimit.allowed) {
      return noStoreJson(
        { status: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }
  } catch {
    return noStoreJson({ status: "degraded" }, { status: 503 });
  }

  try {
    await withTimeout(query("SELECT 1"));
    return noStoreJson({ status: "ok", database: "ok" });
  } catch {
    return noStoreJson({ status: "degraded", database: "unavailable" }, { status: 503 });
  }
}
