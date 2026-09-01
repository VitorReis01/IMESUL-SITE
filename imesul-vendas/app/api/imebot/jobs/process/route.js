import { safeCompare } from "../../../../../Backend.js/adminSecurity";
import { processDueFeedbackJobs } from "../../../../../Backend.js/feedbackStore";
import { imebotUnavailable, isImebotEnabled } from "../../../../../Backend.js/imebotFeatureGate";
import { logger } from "../../../../../Backend.js/logger";
import { noStoreJson } from "../../../../../Backend.js/requestGuards";

const unauthorized = () => noStoreJson({ ok: false }, { status: 401 });

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

export const GET = POST;
