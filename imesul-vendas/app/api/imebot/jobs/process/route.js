import { safeCompare } from "../../../../../Backend.js/adminSecurity";
import { processDueFeedbackJobs } from "../../../../../Backend.js/feedbackStore";
import { imebotUnavailable, isImebotEnabled } from "../../../../../Backend.js/imebotFeatureGate";
import { logger } from "../../../../../Backend.js/logger";
import { checkRateLimitLayers } from "../../../../../Backend.js/rateLimiter";
import {
  getRequestIp,
  methodNotAllowed as sharedMethodNotAllowed,
  noStoreJson,
} from "../../../../../Backend.js/requestGuards";

const unauthorized = () => noStoreJson({ ok: false }, { status: 401 });
const methodNotAllowed = () => sharedMethodNotAllowed("POST");

// Comparação em tempo constante (mesma safeCompare usada por sessão admin e pelo PDF Bridge) -
// antes comparava com "===" simples, vulnerável a timing attack (ver CLAUDE.md, "Problemas
// conhecidos", e relatório de hardening desta fase).
const isAuthorized = (request) => {
  const secret = process.env.IMEBOT_CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") && safeCompare(header.slice(7), secret);
};

export async function POST(request) {
  if (!isImebotEnabled()) return imebotUnavailable();

  if (!isAuthorized(request)) return unauthorized();

  // Mesmo com o Bearer correto, limita execucoes repetidas (ex.: credencial vazada disparando o
  // processamento em loop) - camada especifica desta rota, FAIL CLOSED se o Postgres do rate
  // limiter falhar (nunca libera o processamento so porque o rate limiter caiu - ver
  // Backend.js/rateLimiter.js). Mesmo padrao de "auth primeiro, rate limit depois" ja usado em
  // app/api/imebot/bridge/confirm/route.js (outra rota protegida por Bearer secret).
  try {
    const rateLimit = await checkRateLimitLayers([
      { key: `imebot-jobs-process:${getRequestIp(request)}`, windowMs: 60_000, max: 5 },
    ]);
    if (!rateLimit.allowed) {
      return noStoreJson(
        { ok: false },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }
  } catch {
    return noStoreJson({ ok: false }, { status: 503 });
  }

  try {
    const result = await processDueFeedbackJobs();
    return noStoreJson(result);
  } catch (err) {
    // O lote inteiro roda numa unica transacao (ver processDueFeedbackJobs) - uma falha aqui
    // derruba o lote todo, nao um job isolado; o cron tenta de novo na proxima execucao. So loga
    // o motivo (nunca o erro completo, que pode conter fragmentos de query/dados).
    logger.error("job_failed", { job: "feedback-jobs-batch", reason: err.message });
    return noStoreJson({ ok: false }, { status: 500 });
  }
}

// Processamento de jobs muda estado (efeito colateral real) - so deve responder a POST. Antes
// GET era um alias de POST (ver relatorio FULL-SCOPE/remediacao); nao era explorável via CSRF de
// navegador (a rota exige Authorization: Bearer, que nenhum navegador anexa automaticamente
// entre sites), mas violava a semantica HTTP de que GET nunca deveria ter efeito colateral.
export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
