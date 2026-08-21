import { confirmBridgeFileStored, isBridgeAuthorized } from "../../../../../Backend.js/pdfBridgeStore";
import { imebotUnavailable, isImebotEnabled } from "../../../../../Backend.js/imebotFeatureGate";
import { checkRateLimitLayers } from "../../../../../Backend.js/rateLimiter";
import {
  getRequestIp,
  hasValidJsonContentType,
  methodNotAllowed as sharedMethodNotAllowed,
  noStoreJson,
} from "../../../../../Backend.js/requestGuards";

// Confirmação final do Bridge: já baixou, validou magic bytes/tamanho, escaneou com o Microsoft
// Defender e gravou em Y:\ORC-SITE-IMESUL\<caminho relativo> (ver relatório desta fase). O
// backend NUNCA recebe nem decide o caminho absoluto - só confirma que o relativo bate com o
// que ele mesmo atribuiu (ver Backend.js/pdfBridgeStore.js confirmBridgeFileStored).
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
      { key: `imebot-bridge-confirm:${getRequestIp(request)}`, windowMs: 60_000, max: 30 },
    ]);
    if (!rateLimit.allowed) return noStoreJson({ ok: false, error: "Muitas solicitações." }, { status: 429 });
  } catch {
    return noStoreJson({ ok: false, error: "Serviço temporariamente indisponível." }, { status: 503 });
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 4_000) {
    return noStoreJson({ ok: false, error: "Solicitação inválida." }, { status: 413 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return noStoreJson({ ok: false, error: "Solicitação inválida." }, { status: 400 });
  }

  const fileId = Number(payload?.fileId);
  if (!Number.isInteger(fileId) || fileId <= 0) {
    return noStoreJson({ ok: false, error: "fileId inválido." }, { status: 400 });
  }

  try {
    const result = await confirmBridgeFileStored({
      fileId,
      sha256: payload?.sha256,
      sizeBytes: payload?.sizeBytes,
      relativePath: payload?.relativePath,
    });

    if (!result.ok) return noStoreJson({ ok: false, error: result.reason }, { status: 400 });
    return noStoreJson({ ok: true, alreadyStored: Boolean(result.alreadyStored) });
  } catch {
    return noStoreJson({ ok: false, error: "Não foi possível confirmar o armazenamento." }, { status: 500 });
  }
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
