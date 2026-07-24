import { NextResponse } from "next/server";
import { addAnalyticsEvent } from "../../../../Backend.js/analyticsStore";

// Recebe eventos do site sem confiar em IP ou headers enviados pelo frontend.
// O painel admin consome os dados processados pelo backend local de analytics.
const allowedEventTypes = new Set(["visit", "click", "whatsapp", "search", "login"]);
const getFirstForwardedIp = (value = "") => value.split(",")[0]?.trim() || "";
const safeString = (value, limit = 500) =>
  typeof value === "string" ? value.slice(0, limit) : "";

const noStoreJson = (body, init = {}) =>
  NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init.headers || {}),
    },
  });

const methodNotAllowed = () =>
  noStoreJson({ ok: false, message: "Método não permitido." }, { status: 405, headers: { Allow: "POST" } });

const safeDecodeHeader = (value = "") => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const getRequestIp = (request) =>
  getFirstForwardedIp(request.headers.get("x-forwarded-for") || "") ||
  request.headers.get("x-real-ip") ||
  request.headers.get("cf-connecting-ip") ||
  request.headers.get("fastly-client-ip") ||
  getFirstForwardedIp(request.headers.get("x-vercel-forwarded-for") || "") ||
  request.ip ||
  "não identificado";

const getRequestLocation = (headers) => ({
  city: safeDecodeHeader(headers.get("x-vercel-ip-city") || headers.get("x-geo-city") || ""),
  region: safeDecodeHeader(headers.get("x-vercel-ip-country-region") || headers.get("x-geo-region") || ""),
  country: safeDecodeHeader(headers.get("x-vercel-ip-country") || headers.get("cf-ipcountry") || headers.get("x-geo-country") || ""),
});

const getSecurityHeaders = (headers) => ({
  host: headers.get("host") || "",
  forwardedHost: headers.get("x-forwarded-host") || "",
  vercelId: headers.get("x-vercel-id") || "",
  vercelForwardedFor: getFirstForwardedIp(headers.get("x-vercel-forwarded-for") || ""),
  cloudflareRay: headers.get("cf-ray") || "",
  asn: headers.get("x-vercel-ip-as-number") || headers.get("cf-asn") || "",
  isp: headers.get("x-vercel-ip-as-name") || headers.get("cf-isp") || "",
});

// Aceita apenas os campos usados pelo painel e limita textos livres antes de salvar.
const sanitizePayload = (payload = {}) => ({
  type: allowedEventTypes.has(payload.type) ? payload.type : "click",
  label: safeString(payload.label, 160),
  detail: safeString(payload.detail, 300),
  section: safeString(payload.section, 160),
  path: safeString(payload.path, 180),
  isLoggedIn: Boolean(payload.isLoggedIn),
  userName: safeString(payload.userName, 120),
  userPhone: safeString(payload.userPhone, 60),
  userEmail: safeString(payload.userEmail, 160),
  visitorId: safeString(payload.visitorId, 140),
  source: safeString(payload.source, 180),
  referrer: safeString(payload.referrer, 500),
  utm: {
    source: safeString(payload.utm?.source, 120),
    medium: safeString(payload.utm?.medium, 120),
    campaign: safeString(payload.utm?.campaign, 160),
    content: safeString(payload.utm?.content, 160),
    term: safeString(payload.utm?.term, 160),
  },
});

export async function POST(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 12_000) {
    return noStoreJson({ ok: false, error: "Evento inválido." }, { status: 413 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return noStoreJson({ ok: false, error: "Evento inválido." }, { status: 400 });
  }

  try {
    // IP e localização são dados pessoais; usar apenas para segurança e estatísticas internas.
    await addAnalyticsEvent({
      ...sanitizePayload(payload),
      ipRaw: getRequestIp(request),
      userAgent: request.headers.get("user-agent") || "",
      requestReferrer: request.headers.get("referer") || "",
      requestPath: request.nextUrl?.pathname || "/api/analytics/track",
      requestMethod: request.method,
      serverTimestamp: new Date().toISOString(),
      location: getRequestLocation(request.headers),
      host: request.headers.get("host") || "",
      securityHeaders: getSecurityHeaders(request.headers),
    });

    return noStoreJson({ ok: true });
  } catch {
    // Falha ao registrar o evento (ex.: armazenamento indisponivel) nao e payload invalido.
    return noStoreJson({ ok: false, error: "Não foi possível registrar o evento." }, { status: 500 });
  }
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
