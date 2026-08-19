import { createLead } from "../../../Backend.js/salesLeadsStore";
import { checkRateLimitLayers } from "../../../Backend.js/rateLimiter";
import {
  checkOrigin,
  forbidden,
  getRequestIp,
  hasValidJsonContentType,
  methodNotAllowed as sharedMethodNotAllowed,
  noStoreJson,
  tooManyRequests,
} from "../../../Backend.js/requestGuards";

// Recebe a criacao de leads comerciais (Fase 1: Lead ID + rodizio de vendedores). O frontend
// NUNCA escolhe seller_id nem status: sanitizePayload abaixo nem aceita esses campos do corpo
// enviado, e createLead sempre cria o lead como NEGOCIANDO, escolhendo o vendedor no backend.
const safeString = (value, limit = 500) => (typeof value === "string" ? value.slice(0, limit) : "");

const methodNotAllowed = () => sharedMethodNotAllowed("POST");

// Fail closed: leads e endpoint sensivel (auditoria de seguranca). Se o rate limiter (Postgres)
// estiver indisponivel, nao libera sem limite - o orcamento do cliente nao quebra mesmo assim,
// porque o frontend cai no WhatsApp padrao quando /api/leads falha (ver lib/leads.js).
const serviceUnavailable = () =>
  noStoreJson({ ok: false, error: "Serviço temporariamente indisponível." }, { status: 503 });

// So aceita os campos que o cliente realmente precisa enviar. seller_id, status, lead_code e
// idempotency_key nao existem aqui de proposito - sao decididos/gerados so no backend.
const sanitizePayload = (payload = {}) => ({
  visitorId: safeString(payload.visitorId, 140),
  customerName: safeString(payload.customerName, 120),
  customerPhone: safeString(payload.customerPhone, 40),
  customerEmail: safeString(payload.customerEmail, 160),
  origin: safeString(payload.origin, 180),
  source: safeString(payload.source, 180),
  utm: {
    source: safeString(payload.utm?.source, 120),
    medium: safeString(payload.utm?.medium, 120),
    campaign: safeString(payload.utm?.campaign, 160),
    content: safeString(payload.utm?.content, 160),
    term: safeString(payload.utm?.term, 160),
  },
  product: safeString(payload.product, 200),
  quoteSummary: safeString(payload.quoteSummary, 4000),
});

export async function POST(request) {
  // 1) Camadas baratas primeiro: Origin (endpoint so e chamado pelo fetch() do proprio site) e
  // Content-Type. Nenhuma das duas e autenticacao - so mais uma camada (ver auditoria).
  if (!checkOrigin(request, { requireOriginInProduction: true }).allowed) return forbidden();
  if (!hasValidJsonContentType(request)) {
    return noStoreJson({ ok: false, error: "Content-Type inválido." }, { status: 415 });
  }

  // 2) Rate limit distribuido (Postgres) - muito restritivo, leads sao caros (consomem rodizio).
  const ip = getRequestIp(request);
  let rateLimit;
  try {
    rateLimit = await checkRateLimitLayers([
      { key: `leads:burst:${ip}`, windowMs: 10_000, max: 2 },
      { key: `leads:minute:${ip}`, windowMs: 60_000, max: 5 },
    ]);
  } catch {
    return serviceUnavailable();
  }
  if (!rateLimit.allowed) return tooManyRequests(rateLimit.retryAfterSeconds);

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 12_000) {
    return noStoreJson({ ok: false, error: "Solicitação inválida." }, { status: 413 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return noStoreJson({ ok: false, error: "Solicitação inválida." }, { status: 400 });
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return noStoreJson({ ok: false, error: "Solicitação inválida." }, { status: 400 });
  }

  const sanitized = sanitizePayload(payload);
  if (!sanitized.quoteSummary.trim()) {
    return noStoreJson({ ok: false, error: "Resumo do orçamento é obrigatório." }, { status: 400 });
  }

  try {
    const result = await createLead(sanitized);

    if (!result.ok) {
      // Falha de banco/rodizio nao pode derrubar o orcamento: o frontend cai no WhatsApp padrao.
      return noStoreJson({ ok: false, error: "Não foi possível registrar o lead." }, { status: 503 });
    }

    return noStoreJson({
      ok: true,
      leadCode: result.leadCode,
      seller: result.seller ? { name: result.seller.name, whatsapp: result.seller.whatsapp } : null,
    });
  } catch {
    return noStoreJson({ ok: false, error: "Não foi possível registrar o lead." }, { status: 500 });
  }
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
