import { promises as fs } from "node:fs";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import path from "node:path";

// Armazena eventos locais do analytics e prepara os dados exibidos no painel admin.
// As rotas em app/api/analytics usam este módulo como backend simples de desenvolvimento.
const eventsPath = path.join(process.cwd(), "Backend.js", "analytics-events.json");
const maxEvents = 2000;
const allowedTypes = new Set(["visit", "click", "whatsapp", "search", "login"]);
const staticPathPattern = /(?:^|\/)(?:_next|images|videos|models|fonts|favicon|catalogo)(?:\/|$)|\.(?:png|jpe?g|webp|gif|svg|ico|mp4|webm|glb|woff2?|ttf|otf|pdf)$/i;
const suspiciousAgentPattern = /sqlmap|nikto|nmap|python-requests|curl|wget|masscan|zgrab|acunetix|nessus|wpscan|libwww|httpclient/i;
const suspiciousPathPattern = /\/(?:\.env|\.git|wp-admin|admin|api\/internal|phpmyadmin|xmlrpc\.php|config|backup)/i;
const suspiciousPayloadPattern = /<script|union\s+select|\.\.\/|%2e%2e|select\s+.+\s+from|drop\s+table|insert\s+into|onerror=|javascript:/i;

const safeString = (value, fallback = "", limit = 500) =>
  typeof value === "string" ? value.slice(0, limit) : fallback;

const safeBoolean = (value) => Boolean(value);

const normalizeUnknown = (value, fallback = "Desconhecido") => safeString(value).trim() || fallback;

const maskIp = (ip = "") => {
  const value = safeString(ip, "não identificado").trim();
  if (!value || value === "não identificado") return "não identificado";
  if (value === "::1" || value === "127.0.0.1") return value;
  if (value.includes(".")) {
    const parts = value.split(".");
    return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.xxx` : "ip mascarado";
  }
  if (value.includes(":")) {
    const parts = value.split(":").filter(Boolean);
    return parts.length ? `${parts.slice(0, 2).join(":")}:xxxx:xxxx` : "ipv6 mascarado";
  }
  return "ip mascarado";
};

// Mantém um agrupamento estável por IP sem mostrar o endereço completo no painel comum.
const hashIp = (ip = "") => {
  const value = safeString(ip).trim();
  if (!value || value === "não identificado") return "";
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
};

const getSecurityKey = () => {
  const rawKey = safeString(process.env.ANALYTICS_SECURITY_KEY);
  return rawKey ? createHash("sha256").update(rawKey).digest() : null;
};

// IP completo e armazenado apenas para investigacao de seguranca e nao deve ser exibido no painel comum.
const encryptProtectedValue = (value = "") => {
  const normalized = safeString(value).trim();
  const key = getSecurityKey();
  if (!normalized || normalized === "não identificado" || !key) return "";

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
};

// Descriptografa IP completo somente para detalhes de eventos suspeitos no painel admin.
const decryptProtectedValue = (value = "") => {
  const key = getSecurityKey();
  if (!value || !key) return "";

  try {
    const [ivText, tagText, encryptedText] = value.split(".");
    if (!ivText || !tagText || !encryptedText) return "";

    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivText, "base64"));
    decipher.setAuthTag(Buffer.from(tagText, "base64"));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedText, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "";
  }
};

const sanitizeUrlForSecurity = (value = "") => {
  const rawValue = safeString(value, "", 700).trim();
  if (!rawValue) return "";

  try {
    const url = new URL(rawValue);
    return `${url.origin}${url.pathname}`;
  } catch {
    return rawValue.slice(0, 180);
  }
};

const getDomainFromUrl = (value = "") => {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
};

const safeUtm = (utm = {}) => ({
  source: safeString(utm.source),
  medium: safeString(utm.medium),
  campaign: safeString(utm.campaign),
  content: safeString(utm.content),
  term: safeString(utm.term),
});

const parseDevice = (userAgent = "") => {
  const ua = safeString(userAgent, "", 500);
  const device = /mobile|android|iphone|ipod/i.test(ua) ? "Mobile" : /ipad|tablet/i.test(ua) ? "Tablet" : "Desktop";
  const browser =
    /edg\//i.test(ua) ? "Edge" :
    /chrome|crios/i.test(ua) ? "Chrome" :
    /safari/i.test(ua) && !/chrome|crios/i.test(ua) ? "Safari" :
    /firefox|fxios/i.test(ua) ? "Firefox" :
    /bot|crawler|spider/i.test(ua) ? "Bot/Crawler" :
    "Desconhecido";

  const os =
    /windows/i.test(ua) ? "Windows" :
    /android/i.test(ua) ? "Android" :
    /iphone|ipad|ipod/i.test(ua) ? "iOS" :
    /mac os|macintosh/i.test(ua) ? "macOS" :
    /linux/i.test(ua) ? "Linux" :
    "Desconhecido";

  return { device, browser, os, userAgent: ua || "Desconhecido" };
};

const classifyOrigin = ({ referrer = "", origin = "", utm = {} }) => {
  const source = safeString(utm.source || origin || referrer).toLowerCase();
  if (!source || source.includes("direto")) return "Direto";
  if (source.includes("google")) return "Google";
  if (source.includes("instagram") || source.includes("ig")) return "Instagram";
  if (source.includes("facebook") || source.includes("fb")) return "Facebook";
  if (source.includes("whatsapp")) return "WhatsApp";
  if (source.includes("utm")) return "Campanha";
  return safeString(referrer || origin, "Outro", 160);
};

const ensureStoreFile = async () => {
  await fs.mkdir(path.dirname(eventsPath), { recursive: true });

  try {
    await fs.access(eventsPath);
  } catch {
    // Arquivo de eventos local nao deve ser versionado. Em producao, usar banco de dados.
    await fs.writeFile(eventsPath, "[]", "utf8");
  }
};

const readEventsFile = async () => {
  await ensureStoreFile();

  try {
    const content = await fs.readFile(eventsPath, "utf8");
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeEventsFile = async (events) => {
  await ensureStoreFile();
  await fs.writeFile(eventsPath, JSON.stringify(events.slice(-maxEvents), null, 2), "utf8");
};

const getSuspiciousReasons = (event, previousEvents = []) => {
  const reasons = [];
  const searchablePayload = [
    event.path,
    event.pagePath,
    event.section,
    event.label,
    event.detail,
    event.referrer,
    event.origin,
  ].join(" ");

  if (!event.device.userAgent || event.device.userAgent === "Desconhecido") reasons.push("User-agent vazio");
  if (suspiciousAgentPattern.test(event.device.userAgent)) reasons.push("User-agent suspeito");
  if (suspiciousPathPattern.test(event.path) || suspiciousPathPattern.test(event.pagePath)) reasons.push("Caminho sensível");
  if (suspiciousPayloadPattern.test(searchablePayload)) reasons.push("Payload suspeito");

  const cutoff = Date.now() - 60_000;
  const sameVisitorRecentEvents = previousEvents.filter((item) => {
    const sameVisitor = item.visitorId === event.visitorId || (event.ipHash && item.ipHash === event.ipHash);
    return sameVisitor && new Date(item.timestamp).getTime() >= cutoff;
  });

  if (sameVisitorRecentEvents.length >= 30) reasons.push("Muitas requisições em pouco tempo");

  return reasons;
};

// Normaliza o payload recebido da API e remove campos que nao devem entrar no painel.
const sanitizeEvent = (payload = {}, previousEvents = []) => {
  const now = new Date();
  const userName = safeString(payload.userName || payload.client?.name);
  const userPhone = safeString(payload.userPhone || payload.client?.phone);
  const userEmail = safeString(payload.userEmail || payload.client?.email);
  const isLoggedIn = safeBoolean(payload.isLoggedIn);
  const ipRaw = safeString(payload.ipRaw, "não identificado");
  const utm = safeUtm(payload.utm);
  const device = parseDevice(payload.userAgent);
  const pagePath = safeString(payload.path || payload.pagePath || "/");
  const requestPath = safeString(payload.requestPath || "/api/analytics/track");
  const referrer = sanitizeUrlForSecurity(payload.referrer || payload.requestReferrer);
  const securityHeaders = {
    host: safeString(payload.securityHeaders?.host),
    forwardedHost: safeString(payload.securityHeaders?.forwardedHost),
    vercelId: safeString(payload.securityHeaders?.vercelId),
    vercelForwardedFor: maskIp(payload.securityHeaders?.vercelForwardedFor),
    cloudflareRay: safeString(payload.securityHeaders?.cloudflareRay),
    asn: safeString(payload.securityHeaders?.asn),
    isp: safeString(payload.securityHeaders?.isp),
  };

  const event = {
    id: `${now.getTime()}-${Math.random().toString(16).slice(2)}`,
    visitorId: safeString(payload.visitorId, "visitor-unavailable"),
    type: allowedTypes.has(payload.type) ? payload.type : "click",
    label: safeString(payload.label),
    detail: safeString(payload.detail),
    section: safeString(payload.section),
    origin: safeString(payload.source || payload.origin, "Direto / não informado"),
    trafficSource: classifyOrigin({ referrer, origin: payload.source || payload.origin, utm }),
    referrer,
    refererDomain: getDomainFromUrl(referrer),
    utm,
    path: requestPath,
    pagePath,
    method: safeString(payload.requestMethod, "POST"),
    serverTimestamp: safeString(payload.serverTimestamp, now.toISOString()),
    ip: maskIp(ipRaw),
    ipMasked: maskIp(ipRaw),
    ipHash: hashIp(ipRaw),
    ipFullProtected: encryptProtectedValue(ipRaw),
    host: safeString(payload.host || securityHeaders.host),
    securityHeaders,
    location: {
      city: normalizeUnknown(payload.location?.city),
      region: normalizeUnknown(payload.location?.region),
      country: normalizeUnknown(payload.location?.country),
    },
    device,
    client: {
      name: userName,
      phone: userPhone,
      email: userEmail,
      status: isLoggedIn || userName || userPhone || userEmail ? "Cliente com login" : "Visitante sem login",
    },
    timestamp: now.toISOString(),
    isLoggedIn,
  };

  const suspiciousReasons = getSuspiciousReasons(event, previousEvents);
  return {
    ...event,
    securityStatus: suspiciousReasons.length ? "Suspeito" : "Normal",
    suspiciousReasons,
  };
};

// Armazenamento local apenas para desenvolvimento; na Vercel, usar banco/KV para persistencia confiavel.
export async function addAnalyticsEvent(payload) {
  const requestPath = safeString(payload.requestPath || payload.path || "");
  if (staticPathPattern.test(requestPath)) return null;

  const events = await readEventsFile();
  const event = sanitizeEvent(payload, events);
  await writeEventsFile([...events, event]);
  return event;
}

export async function getAnalyticsEvents() {
  const events = await readEventsFile();

  return events.map((event) => {
    if (event.securityStatus !== "Suspeito") return event;

    const ipFull = decryptProtectedValue(event.ipFullProtected);

    return {
      ...event,
      securityDetails: {
        ipFull: ipFull || "Indisponivel: configure ANALYTICS_SECURITY_KEY no servidor.",
        userAgentFull: event.device?.userAgent || "Desconhecido",
        refererFull: event.referrer || "Nao informado",
        refererDomain: event.refererDomain || "Nao informado",
        host: event.host || event.securityHeaders?.host || "Nao informado",
        method: event.method || "-",
        path: event.pagePath || event.path || "-",
        requestPath: event.path || "-",
        serverTimestamp: event.serverTimestamp || event.timestamp,
        reasons: event.suspiciousReasons || [],
        headers: event.securityHeaders || {},
      },
    };
  });
}

export async function clearAnalyticsEvents({ visitorId } = {}) {
  if (visitorId) {
    const events = await readEventsFile();
    const remainingEvents = events.filter((event) => event.visitorId !== visitorId);
    await writeEventsFile(remainingEvents);
    return remainingEvents;
  }

  await writeEventsFile([]);
  return [];
}
