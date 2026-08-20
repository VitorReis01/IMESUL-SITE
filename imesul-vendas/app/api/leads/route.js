import { createLead, linkCartToLead } from "../../../Backend.js/salesLeadsStore";
import { notifyImebotOfNewLead } from "../../../Backend.js/imebotStore";
import { checkGlobalApiRateLimit, checkRateLimitLayers } from "../../../Backend.js/rateLimiter";
import {
  checkOrigin,
  getCorsHeaders,
  getRequestIp,
  hasValidJsonContentType,
  noStoreJson,
} from "../../../Backend.js/requestGuards";

// Recebe a criacao de leads comerciais - Lead ID + rodizio de vendedores, para os tres fluxos
// classificados em lib/leadFlow.js (DIRECT_CONTACT, GUIDED_QUOTE, CART). O frontend NUNCA
// escolhe seller_id nem status: sanitizePayload abaixo nem aceita esses campos do corpo enviado,
// e createLead sempre cria o lead como NEGOCIANDO, escolhendo o vendedor no backend. flowType/
// unit/siteOrigin sao aceitos do cliente mas revalidados contra a allowlist dentro de
// createLead (nunca sao usados sem checagem so por terem vindo do payload).
//
// Chamado cross-origin pelo site institucional (CTA "Falar no WhatsApp") alem do proprio site de
// vendas - por isso, alem de checkOrigin (que valida a REQUISICAO), as respostas incluem headers
// CORS reais (getCorsHeaders) para o navegador do institucional conseguir LER a resposta. Nunca
// "Access-Control-Allow-Origin: *": so ecoa a origem se ela estiver na mesma allowlist do
// checkOrigin (ver Backend.js/requestGuards.js).
const safeString = (value, limit = 500) => (typeof value === "string" ? value.slice(0, limit) : "");

const methodNotAllowed = (request) => respond(request, { ok: false, error: "Método não permitido." }, { status: 405, headers: { Allow: "POST, OPTIONS" } });

// Fail closed: leads e endpoint sensivel (auditoria de seguranca). Se o rate limiter (Postgres)
// estiver indisponivel, nao libera sem limite - o orcamento do cliente nao quebra mesmo assim,
// porque o frontend cai no WhatsApp padrao quando /api/leads falha (ver lib/leads.js).
const serviceUnavailable = (request) =>
  respond(request, { ok: false, error: "Serviço temporariamente indisponível." }, { status: 503 });

// Junta o Cache-Control:no-store padrao (noStoreJson) com os headers CORS calculados para esta
// requisicao especifica - toda resposta desta rota passa por aqui, erro ou sucesso, para que o
// institucional consiga ler tanto os erros quanto o sucesso.
const respond = (request, body, init = {}) =>
  noStoreJson(body, { ...init, headers: { ...getCorsHeaders(request), ...(init.headers || {}) } });

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
  // Revalidados contra allowlist dentro de createLead (lib/leadFlow.js) - aqui so passam a
  // string crua adiante, limitada em tamanho.
  flowType: safeString(payload.flowType, 40),
  siteOrigin: safeString(payload.siteOrigin, 40),
  unit: safeString(payload.unit, 40),
  pagePath: safeString(payload.pagePath, 180),
  // So usado para ligar um cart_sessions ja rastreado (rastreio opcional, com consentimento de
  // analytics - ver lib/cartTracking.js) ao lead criado; nunca decide seller_id/status/valor.
  cartCode: safeString(payload.cartCode, 40),
});

export async function POST(request) {
  // 1) Camadas baratas primeiro: Origin (site de vendas OU institucional, ver allowlist) e
  // Content-Type. Nenhuma das duas e autenticacao - so mais uma camada (ver auditoria).
  if (!checkOrigin(request, { requireOriginInProduction: true }).allowed) {
    return respond(request, { ok: false, error: "Acesso não autorizado." }, { status: 403 });
  }
  if (!hasValidJsonContentType(request)) {
    return respond(request, { ok: false, error: "Content-Type inválido." }, { status: 415 });
  }

  // 2) Camada GLOBAL (compartilhada por TODAS as rotas /api, mesma chave por IP) - ALEM do limite
  // especifico abaixo, nunca no lugar dele. Ver Backend.js/rateLimiter.js.
  let globalLimit;
  try {
    globalLimit = await checkGlobalApiRateLimit(request);
  } catch {
    return serviceUnavailable(request);
  }
  if (!globalLimit.allowed) {
    return respond(
      request,
      { ok: false, error: "Muitas solicitações. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(Math.max(globalLimit.retryAfterSeconds, 1)) } }
    );
  }

  // 3) Rate limit especifico deste endpoint (Postgres) - muito restritivo, leads sao caros
  // (consomem rodizio).
  const ip = getRequestIp(request);
  let rateLimit;
  try {
    rateLimit = await checkRateLimitLayers([
      { key: `leads:burst:${ip}`, windowMs: 10_000, max: 2 },
      { key: `leads:minute:${ip}`, windowMs: 60_000, max: 5 },
    ]);
  } catch {
    return serviceUnavailable(request);
  }
  if (!rateLimit.allowed) {
    return respond(
      request,
      { ok: false, error: "Muitas solicitações. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(Math.max(rateLimit.retryAfterSeconds, 1)) } }
    );
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 12_000) {
    return respond(request, { ok: false, error: "Solicitação inválida." }, { status: 413 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return respond(request, { ok: false, error: "Solicitação inválida." }, { status: 400 });
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return respond(request, { ok: false, error: "Solicitação inválida." }, { status: 400 });
  }

  const sanitized = sanitizePayload(payload);
  if (!sanitized.quoteSummary.trim()) {
    return respond(request, { ok: false, error: "Resumo do orçamento é obrigatório." }, { status: 400 });
  }

  try {
    const result = await createLead(sanitized);

    if (!result.ok) {
      // Falha de banco/rodizio nao pode derrubar o orcamento: o frontend cai no WhatsApp padrao.
      return respond(request, { ok: false, error: "Não foi possível registrar o lead." }, { status: 503 });
    }

    if (sanitized.cartCode && result.leadId) {
      // Best-effort, depois do lead ja confirmado - nunca atrasa/derruba a resposta ao cliente.
      linkCartToLead({ cartCode: sanitized.cartCode, leadId: result.leadId });
    }

    if (result.seller && result.leadId) {
      // Best-effort, depois do lead ja confirmado e do WhatsApp do vendedor ja decidido - o
      // IMEbot e so acompanhamento interno complementar (so roda para unit = campo-grande, ver
      // Backend.js/imebotStore.js), nunca bloqueia nem atrasa a resposta ao cliente.
      notifyImebotOfNewLead({ leadId: result.leadId, unit: result.unit });
    }

    return respond(request, {
      ok: true,
      leadCode: result.leadCode,
      seller: result.seller ? { name: result.seller.name, whatsapp: result.seller.whatsapp } : null,
    });
  } catch {
    return respond(request, { ok: false, error: "Não foi possível registrar o lead." }, { status: 500 });
  }
}

// Preflight CORS - navegadores enviam OPTIONS antes de um POST cross-origin com
// Content-Type: application/json. So responde com os headers CORS quando a origem esta na
// allowlist (getCorsHeaders); do contrario, a ausencia do header faz o navegador bloquear a
// requisicao real por conta propria, sem o servidor precisar decidir de outra forma.
export async function OPTIONS(request) {
  // 204 nao deve ter corpo (mesmo JSON "null") - Response direto em vez de noStoreJson aqui.
  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
      ...getCorsHeaders(request),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
