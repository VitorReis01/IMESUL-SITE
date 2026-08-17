import { promises as fs } from "node:fs";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import os from "node:os";
import path from "node:path";

// Armazena eventos locais do analytics e prepara os dados exibidos no painel admin.
// As rotas em app/api/analytics usam este módulo como backend simples de desenvolvimento.
// Usa o diretorio temporario do SO (gravavel mesmo em runtimes serverless como a Vercel,
// onde o diretorio do projeto e somente leitura); os dados nao persistem entre deploys/instancias.
const eventsPath = path.join(os.tmpdir(), "imesul-vendas-analytics-events.json");
const maxEvents = 2000;
const allowedTypes = new Set(["visit", "click", "whatsapp", "search", "login", "device_location"]);
const deviceLocationStatusValues = new Set(["granted", "denied", "unavailable", "timeout", "unsupported"]);
const staticPathPattern = /(?:^|\/)(?:_next|images|videos|models|fonts|favicon|catalogo)(?:\/|$)|\.(?:png|jpe?g|webp|gif|svg|ico|mp4|webm|glb|woff2?|ttf|otf|pdf)$/i;
const suspiciousAgentPattern = /sqlmap|nikto|nmap|python-requests|curl|wget|masscan|zgrab|acunetix|nessus|wpscan|libwww|httpclient/i;
const suspiciousPathPattern = /\/(?:\.env|\.git|wp-admin|admin|api\/internal|phpmyadmin|xmlrpc\.php|config|backup)/i;
const suspiciousPayloadPattern = /<script|union\s+select|\.\.\/|%2e%2e|select\s+.+\s+from|drop\s+table|insert\s+into|onerror=|javascript:/i;

// Limita quantos eventos um mesmo IP pode registrar por minuto neste endpoint publico.
const trackRateWindowMs = 60 * 1000;
const trackRateMaxRequests = 60;
const trackRequestCounters = new Map();
const maxTrackedTrackKeys = 5000;

export const checkTrackRateLimit = (ipKey = "não identificado") => {
  const now = Date.now();

  // So varre para limpar quando o Map cresce muito (muitos IPs distintos ja vistos); evita custo a cada chamada.
  if (trackRequestCounters.size >= maxTrackedTrackKeys) {
    trackRequestCounters.forEach((entry, key) => {
      if (entry.resetAt <= now) trackRequestCounters.delete(key);
    });
  }

  const current = trackRequestCounters.get(ipKey);

  if (!current || current.resetAt <= now) {
    trackRequestCounters.set(ipKey, { count: 1, resetAt: now + trackRateWindowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= trackRateMaxRequests) {
    return { allowed: false, retryAfterSeconds: Math.max(Math.ceil((current.resetAt - now) / 1000), 1) };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
};

const safeString = (value, fallback = "", limit = 500) =>
  typeof value === "string" ? value.slice(0, limit) : fallback;

const safeBoolean = (value) => Boolean(value);

const normalizeUnknown = (value, fallback = "Desconhecido") => safeString(value).trim() || fallback;

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

// Revalida deviceLocation de forma independente da rota (defesa em profundidade): mesmo que a
// validacao de app/api/analytics/track/route.js mude no futuro, este modulo nunca grava
// coordenadas fora de faixa. IP geolocation (location.*) e device geolocation NUNCA se misturam:
// device location so existe aqui quando o proprio visitante autorizou o navegador.
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
    capturedAt: validCapturedAt ? parsedCapturedAt.toISOString() : new Date().toISOString(),
  };
};

const sanitizeDeviceLocationStatus = (value) => (deviceLocationStatusValues.has(value) ? value : "");

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

// Classificacao por regex no user-agent, igual ao padrao ja usado no projeto (sem lib nova).
// Ordem importa: tokens mais especificos (CLI, bots, marcas de navegador) sao checados antes
// dos genericos, porque muitos UAs reais empilham varios tokens (ex.: Edge tambem contem "Chrome").
// Nao inventamos categorias que o user-agent nao permite distinguir com confianca (ex.: notebook
// vs desktop, ou Brave - que por padrao se disfarca de Chrome no proprio user-agent).
const parseDevice = (userAgent = "") => {
  const ua = safeString(userAgent, "", 500);

  const device =
    /postmanruntime/i.test(ua) ? "Postman" :
    /powershell/i.test(ua) ? "PowerShell" :
    /^curl\//i.test(ua) || /\bcurl\//i.test(ua) ? "curl" :
    /bot|crawler|spider|slurp|bingpreview|facebookexternalhit/i.test(ua) ? "Bot" :
    /smart-tv|smarttv|tizen|web0s|webos|hbbtv|googletv|appletv/i.test(ua) ? "Smart TV" :
    /ipad/i.test(ua) ? "iPad" :
    /iphone|ipod/i.test(ua) ? "iPhone" :
    /android/i.test(ua) && /mobile/i.test(ua) ? "Android" :
    /android/i.test(ua) || /tablet|kindle|silk/i.test(ua) ? "Tablet" :
    /mobile/i.test(ua) ? "Outro" :
    ua ? "Desktop" : "Desconhecido";

  const browser =
    /postmanruntime/i.test(ua) ? "Postman" :
    /powershell/i.test(ua) ? "PowerShell" :
    /^curl\//i.test(ua) || /\bcurl\//i.test(ua) ? "curl" :
    /bot|crawler|spider|slurp|bingpreview|facebookexternalhit/i.test(ua) ? "Bot/Crawler" :
    /edg\//i.test(ua) ? "Edge" :
    /samsungbrowser/i.test(ua) ? "Samsung Internet" :
    /opr\/|opera/i.test(ua) ? "Opera" :
    /(chrome|crios|chromium)/i.test(ua) && /; wv\)/i.test(ua) ? "WebView" :
    /crios/i.test(ua) ? "Chrome" :
    /fxios|firefox/i.test(ua) ? "Firefox" :
    /chrome|chromium/i.test(ua) ? "Chrome" :
    /version\/[\d.]+.*safari/i.test(ua) ? "Safari" :
    "Desconhecido";

  const os =
    /windows/i.test(ua) ? "Windows" :
    /android/i.test(ua) ? "Android" :
    /iphone|ipad|ipod/i.test(ua) ? "iOS" :
    /mac os|macintosh/i.test(ua) ? "macOS" :
    /tizen/i.test(ua) ? "Tizen" :
    /web0s|webos/i.test(ua) ? "WebOS" :
    /linux/i.test(ua) ? "Linux" :
    ua ? "Outro" : "Desconhecido";

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
      continent: normalizeUnknown(payload.location?.continent),
      // Coordenadas/fuso/CEP ficam "" (nao "Desconhecido") quando ausentes: o painel usa isso
      // para decidir se mostra o botao "Ver no mapa" e a linha de CEP, sem inventar valor.
      latitude: safeString(payload.location?.latitude, "", 32),
      longitude: safeString(payload.location?.longitude, "", 32),
      timezone: safeString(payload.location?.timezone, "", 64),
      postalCode: safeString(payload.location?.postalCode, "", 32),
    },
    network: {
      asn: safeString(payload.network?.asn, "", 32),
      organization: safeString(payload.network?.organization, "", 160),
      isp: safeString(payload.network?.isp, "", 160),
    },
    // Localizacao do DISPOSITIVO (GPS/rede do navegador), so existe com consentimento explicito
    // do visitante. NUNCA usar para autenticacao/autorizacao/bloqueio - e so analytics.
    // Fica deliberadamente fora de "location" para nunca ser confundida com IP geolocation.
    deviceLocation: sanitizeDeviceLocation(payload.deviceLocation),
    deviceLocationStatus: sanitizeDeviceLocationStatus(payload.deviceLocationStatus),
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
