import { NextResponse } from "next/server";
import { addAnalyticsEvent, checkTrackRateLimit } from "../../../../Backend.js/analyticsStore";

// Recebe eventos do site sem confiar em IP ou headers enviados pelo frontend.
// O painel admin consome os dados processados pelo backend local de analytics.
const allowedEventTypes = new Set(["visit", "click", "whatsapp", "search", "login", "device_location"]);
const deviceLocationStatusValues = new Set(["granted", "denied", "unavailable", "timeout", "unsupported"]);
const getFirstForwardedIp = (value = "") => value.split(",")[0]?.trim() || "";
const safeString = (value, limit = 500) =>
  typeof value === "string" ? value.slice(0, limit) : "";
const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

// deviceLocation SO pode vir do proprio dispositivo do visitante, nunca de IP/infra.
// Por isso e o UNICO campo geografico aceito do corpo enviado pelo cliente - e so depois
// de validacao numerica estrita (nunca confiar cegamente no frontend). Nunca usar este dado
// para autenticacao, autorizacao, bloqueio ou qualquer decisao antifraude: e so analytics.
const sanitizeDeviceLocation = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const { latitude, longitude, accuracy, capturedAt } = value;
  if (!isFiniteNumber(latitude) || latitude < -90 || latitude > 90) return null;
  if (!isFiniteNumber(longitude) || longitude < -180 || longitude > 180) return null;
  if (!isFiniteNumber(accuracy) || accuracy < 0 || accuracy > 1_000_000) return null;

  const parsedCapturedAt = new Date(capturedAt);
  const validCapturedAt = typeof capturedAt === "string" && !Number.isNaN(parsedCapturedAt.getTime());

  return {
    latitude,
    longitude,
    accuracy,
    // capturedAt e so exibido no painel; nunca usado para decisao de seguranca.
    capturedAt: validCapturedAt ? parsedCapturedAt.toISOString() : new Date().toISOString(),
  };
};

const sanitizeDeviceLocationStatus = (value) =>
  deviceLocationStatusValues.has(value) ? value : "";

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

// Geolocalizacao aproximada por IP, lida somente de headers definidos pelo servidor/infra da Vercel.
// Nunca aceitar latitude/longitude enviadas pelo cliente no corpo da requisicao.
const getRequestLocation = (headers) => ({
  city: safeDecodeHeader(headers.get("x-vercel-ip-city") || headers.get("x-geo-city") || ""),
  region: safeDecodeHeader(headers.get("x-vercel-ip-country-region") || headers.get("x-geo-region") || ""),
  country: safeDecodeHeader(headers.get("x-vercel-ip-country") || headers.get("cf-ipcountry") || headers.get("x-geo-country") || ""),
  continent: safeDecodeHeader(headers.get("x-vercel-ip-continent") || ""),
  latitude: safeDecodeHeader(headers.get("x-vercel-ip-latitude") || ""),
  longitude: safeDecodeHeader(headers.get("x-vercel-ip-longitude") || ""),
  timezone: safeDecodeHeader(headers.get("x-vercel-ip-timezone") || ""),
  postalCode: safeDecodeHeader(headers.get("x-vercel-ip-postal-code") || ""),
});

// Rede/operadora a partir de headers de infraestrutura. Sem API externa nesta etapa:
// se a infra nao informar nome de organizacao, o painel mostra "Nao identificado" (nunca inventar).
const getRequestNetwork = (headers) => {
  const asn = headers.get("x-vercel-ip-as-number") || headers.get("cf-asn") || "";
  const organization = safeDecodeHeader(headers.get("x-vercel-ip-as-name") || headers.get("cf-isp") || "");

  return { asn, organization, isp: organization };
};

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
  // Localizacao do DISPOSITIVO, consentida explicitamente pelo visitante (Fase 2).
  // Nao confundir com a localizacao aproximada por IP (essa vem so de request.headers, nunca do body).
  deviceLocation: sanitizeDeviceLocation(payload.deviceLocation),
  deviceLocationStatus: sanitizeDeviceLocationStatus(payload.deviceLocationStatus),
});

export async function POST(request) {
  const rateLimit = checkTrackRateLimit(getRequestIp(request));
  if (!rateLimit.allowed) {
    return noStoreJson(
      { ok: false, error: "Muitas requisições. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

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

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
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
      network: getRequestNetwork(request.headers),
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
