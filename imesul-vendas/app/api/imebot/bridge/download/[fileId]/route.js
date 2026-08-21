import { getBridgeFileById, isBridgeAuthorized, markBridgeFileStatus } from "../../../../../../Backend.js/pdfBridgeStore";
import { imebotUnavailable, isImebotEnabled } from "../../../../../../Backend.js/imebotFeatureGate";
import { checkRateLimitLayers } from "../../../../../../Backend.js/rateLimiter";
import { getRequestIp, methodNotAllowed as sharedMethodNotAllowed, noStoreJson } from "../../../../../../Backend.js/requestGuards";

// Entrega o PDF autorizado ao Bridge via HTTPS - o Bridge NUNCA recebe credenciais Meta nem o
// media_id bruto; o backend busca/transmite o arquivo usando META_WHATSAPP_TOKEN do lado do
// servidor (arquitetura aprovada no relatório desta fase: evita manter o PDF em armazenamento
// permanente só para servir de ponte, e evita expor credenciais Meta ao PC da Bridge).
//
// SEM credenciais Meta reais configuradas nesta fase, este endpoint não pode buscar o arquivo de
// verdade - devolve 503 com um motivo claro em vez de fingir sucesso (ver relatório).
const methodNotAllowed = () => sharedMethodNotAllowed("GET");

const isMetaConfigured = () => Boolean(process.env.META_WHATSAPP_TOKEN);

export async function GET(request, { params }) {
  if (!isImebotEnabled()) return imebotUnavailable();

  if (!isBridgeAuthorized(request)) {
    return noStoreJson({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  try {
    const rateLimit = await checkRateLimitLayers([
      { key: `imebot-bridge-download:${getRequestIp(request)}`, windowMs: 60_000, max: 30 },
    ]);
    if (!rateLimit.allowed) {
      return noStoreJson({ ok: false, error: "Muitas solicitações." }, { status: 429 });
    }
  } catch {
    return noStoreJson({ ok: false, error: "Serviço temporariamente indisponível." }, { status: 503 });
  }

  const fileId = Number((await params).fileId);
  if (!Number.isInteger(fileId) || fileId <= 0) {
    return noStoreJson({ ok: false, error: "Identificador inválido." }, { status: 400 });
  }

  let file;
  try {
    file = await getBridgeFileById(fileId);
  } catch {
    return noStoreJson({ ok: false, error: "Não foi possível consultar o arquivo." }, { status: 500 });
  }

  if (!file) return noStoreJson({ ok: false, error: "Arquivo não encontrado." }, { status: 404 });
  if (file.storageStatus !== "PENDING") {
    return noStoreJson({ ok: false, error: "Este arquivo não está mais pendente de download." }, { status: 409 });
  }

  if (!isMetaConfigured()) {
    return noStoreJson(
      { ok: false, error: "Integração com a Meta ainda não configurada neste servidor." },
      { status: 503 }
    );
  }

  try {
    await markBridgeFileStatus(fileId, "DOWNLOADING");
    // Implementar aqui, quando as credenciais existirem: GET https://graph.facebook.com/v.../{media_id}
    // com Authorization: Bearer META_WHATSAPP_TOKEN para obter a URL temporária, depois um GET
    // autenticado nessa URL e repassar o corpo (stream) como resposta, com Content-Type: application/pdf.
    return noStoreJson({ ok: false, error: "Download real ainda não implementado sem credenciais Meta." }, { status: 501 });
  } catch {
    return noStoreJson({ ok: false, error: "Falha ao obter o arquivo da Meta." }, { status: 502 });
  }
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
