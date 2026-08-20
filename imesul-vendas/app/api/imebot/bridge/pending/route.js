import { isBridgeAuthorized, listPendingBridgeFiles } from "../../../../../Backend.js/pdfBridgeStore";
import { checkRateLimitLayers } from "../../../../../Backend.js/rateLimiter";
import { getRequestIp, methodNotAllowed as sharedMethodNotAllowed, noStoreJson } from "../../../../../Backend.js/requestGuards";

// Lista PDFs aguardando download pelo IMEbot PDF Bridge (script PowerShell rodando em um PC
// comum da empresa via Task Scheduler - ver relatório desta fase). Autenticado por
// Authorization: Bearer IMEBOT_BRIDGE_SECRET, NUNCA por query string.
const methodNotAllowed = () => sharedMethodNotAllowed("GET");

export async function GET(request) {
  if (!isBridgeAuthorized(request)) {
    return noStoreJson({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  try {
    const rateLimit = await checkRateLimitLayers([
      { key: `imebot-bridge:${getRequestIp(request)}`, windowMs: 60_000, max: 30 },
    ]);
    if (!rateLimit.allowed) {
      return noStoreJson({ ok: false, error: "Muitas solicitações." }, { status: 429 });
    }
  } catch {
    return noStoreJson({ ok: false, error: "Serviço temporariamente indisponível." }, { status: 503 });
  }

  try {
    const files = await listPendingBridgeFiles();
    return noStoreJson({ ok: true, files });
  } catch {
    return noStoreJson({ ok: false, error: "Não foi possível listar os arquivos pendentes." }, { status: 500 });
  }
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
