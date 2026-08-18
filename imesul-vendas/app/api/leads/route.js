import { NextResponse } from "next/server";
import { checkLeadsRateLimit, createLead } from "../../../Backend.js/salesLeadsStore";

// Recebe a criacao de leads comerciais (Fase 1: Lead ID + rodizio de vendedores). O frontend
// NUNCA escolhe seller_id nem status: sanitizePayload abaixo nem aceita esses campos do corpo
// enviado, e createLead sempre cria o lead como NEGOCIANDO, escolhendo o vendedor no backend.
const getFirstForwardedIp = (value = "") => value.split(",")[0]?.trim() || "";
const safeString = (value, limit = 500) => (typeof value === "string" ? value.slice(0, limit) : "");

const noStoreJson = (body, init = {}) =>
  NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init.headers || {}),
    },
  });

const methodNotAllowed = () =>
  noStoreJson({ ok: false, error: "Método não permitido." }, { status: 405, headers: { Allow: "POST" } });

const getRequestIp = (request) =>
  getFirstForwardedIp(request.headers.get("x-forwarded-for") || "") ||
  request.headers.get("x-real-ip") ||
  request.headers.get("cf-connecting-ip") ||
  request.headers.get("fastly-client-ip") ||
  getFirstForwardedIp(request.headers.get("x-vercel-forwarded-for") || "") ||
  request.ip ||
  "não identificado";

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
  const rateLimit = checkLeadsRateLimit(getRequestIp(request));
  if (!rateLimit.allowed) {
    return noStoreJson(
      { ok: false, error: "Muitas solicitações. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

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
