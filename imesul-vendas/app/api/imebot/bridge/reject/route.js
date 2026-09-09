import { isBridgeAuthorized, rejectBridgeFile } from "../../../../../Backend.js/pdfBridgeStore";
import { imebotUnavailable, isImebotEnabled } from "../../../../../Backend.js/imebotFeatureGate";
import { checkRateLimitLayers } from "../../../../../Backend.js/rateLimiter";
import {
  getRequestIp,
  hasValidJsonContentType,
  methodNotAllowed as sharedMethodNotAllowed,
  noStoreJson,
  readJsonBodyWithLimit,
} from "../../../../../Backend.js/requestGuards";

// Marca um PDF como rejeitado (fail closed): magic bytes inválidos, tamanho acima do limite,
// Microsoft Defender indisponível/reprovou, ou qualquer outra validação do Bridge que falhou -
// NUNCA grava um arquivo reprovado no destino final (ver relatório desta fase).
const methodNotAllowed = () => sharedMethodNotAllowed("POST");

export async function POST(request) {
  if (!isImebotEnabled()) return imebotUnavailable();

  if (!isBridgeAuthorized(request)) {
    return noStoreJson({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  if (!hasValidJsonContentType(request)) {
    return noStoreJson({ ok: false, error: "Content-Type inválido." }, { status: 415 });
  }

  try {
    const rateLimit = await checkRateLimitLayers([
      { key: `imebot-bridge-reject:${getRequestIp(request)}`, windowMs: 60_000, max: 30 },
    ]);
    if (!rateLimit.allowed) return noStoreJson({ ok: false, error: "Muitas solicitações." }, { status: 429 });
  } catch {
    return noStoreJson({ ok: false, error: "Serviço temporariamente indisponível." }, { status: 503 });
  }

  // Limite REAL de corpo, contado a partir do stream - nunca confia so no Content-Length
  // (contornavel com Transfer-Encoding: chunked, ver relatorio FULL-SCOPE/remediacao).
  const bodyResult = await readJsonBodyWithLimit(request, 4_000);
  if (bodyResult.status === "too_large") {
    return noStoreJson({ ok: false, error: "Solicitação inválida." }, { status: 413 });
  }
  if (bodyResult.status === "invalid_json") {
    return noStoreJson({ ok: false, error: "Solicitação inválida." }, { status: 400 });
  }

  const payload = bodyResult.body;
  const fileId = Number(payload?.fileId);
  if (!Number.isInteger(fileId) || fileId <= 0) {
    return noStoreJson({ ok: false, error: "fileId inválido." }, { status: 400 });
  }

  try {
    const result = await rejectBridgeFile({ fileId, reason: payload?.reason });
    if (!result.ok) return noStoreJson({ ok: false, error: result.reason }, { status: 400 });
    return noStoreJson({ ok: true });
  } catch {
    return noStoreJson({ ok: false, error: "Não foi possível registrar a rejeição." }, { status: 500 });
  }
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
