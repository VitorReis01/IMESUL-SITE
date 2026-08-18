import { promises as fs } from "node:fs";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { isDatabaseConfigured, query } from "./db";

// Armazena eventos de analytics e prepara os dados exibidos no painel admin.
// As rotas em app/api/analytics usam este modulo, que decide o backend em tempo de execucao:
//
// - DATABASE_URL configurada: Postgres (analytics_events) - persistente, funciona igual em
//   qualquer instancia serverless da Vercel.
// - DATABASE_URL ausente: arquivo JSON em os.tmpdir() - APENAS para desenvolvimento local.
//   NAO E PERSISTENTE em producao serverless: instancias diferentes podem ter arquivos
//   diferentes, e um novo deploy apaga o arquivo. Nunca tratar isso como armazenamento de
//   producao (ver docs/analytics-storage.md).
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

// recentSameVisitorCount vem de fora (contagem no array local em dev, COUNT(*) no Postgres em
// producao) para nao obrigar este modulo a carregar todo o historico so para checar um numero.
const getSuspiciousReasons = (event, recentSameVisitorCount = 0) => {
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
  if (recentSameVisitorCount >= 30) reasons.push("Muitas requisições em pouco tempo");

  return reasons;
};

// Conta eventos dos ultimos 60s do mesmo visitante/IP dentro de um array ja carregado (fallback local).
const countRecentSameVisitorFromArray = (event, previousEvents = []) => {
  const cutoff = Date.now() - 60_000;
  return previousEvents.filter((item) => {
    const sameVisitor = item.visitorId === event.visitorId || (event.ipHash && item.ipHash === event.ipHash);
    return sameVisitor && new Date(item.timestamp).getTime() >= cutoff;
  }).length;
};

// Mesma contagem, mas como consulta pontual e indexada no Postgres - nunca carrega o historico
// inteiro so para checar isso (ver Backend.js/db.js e migration idx_analytics_events_visitor_id/ip_hash).
const countRecentSameVisitorFromDatabase = async (event) => {
  const result = await query(
    `SELECT COUNT(*)::int AS count FROM analytics_events
     WHERE event_timestamp >= NOW() - INTERVAL '60 seconds'
       AND (visitor_id = $1 OR ($2 <> '' AND ip_hash = $2))`,
    [event.visitorId, event.ipHash || ""]
  );
  return result.rows[0]?.count || 0;
};

// Normaliza o payload recebido da API e remove campos que nao devem entrar no painel.
// Nao decide ainda se o evento e suspeito - isso depende de recentSameVisitorCount, calculado
// separadamente por addAnalyticsEvent conforme o backend ativo (ver funcoes acima).
const buildEventFields = (payload = {}) => {
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

  return event;
};

// Aplica a checagem de atividade suspeita sobre um evento ja construido e devolve a versao final.
const finalizeEvent = (event, recentSameVisitorCount) => {
  const suspiciousReasons = getSuspiciousReasons(event, recentSameVisitorCount);
  return {
    ...event,
    securityStatus: suspiciousReasons.length ? "Suspeito" : "Normal",
    suspiciousReasons,
  };
};

// Cada chamada e um INSERT independente - nunca lemos a tabela inteira, modificamos em memoria
// e regravamos (isso e exatamente o problema que o arquivo JSON tinha sob concorrencia).
const insertEventToDatabase = async (event) => {
  await query(
    `INSERT INTO analytics_events (
      event_timestamp, server_timestamp, type, label, detail, section, path, page_path, method,
      visitor_id, is_logged_in, user_name, user_phone, user_email, client_status,
      origin_label, traffic_source, referrer, referer_domain, host, utm,
      ip_masked, ip_hash, ip_protected,
      device, location, network, security_headers,
      device_latitude, device_longitude, device_accuracy, device_location_captured_at, device_location_status,
      suspicious, suspicious_reasons
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      $10, $11, $12, $13, $14, $15,
      $16, $17, $18, $19, $20, $21,
      $22, $23, $24,
      $25, $26, $27, $28,
      $29, $30, $31, $32, $33,
      $34, $35
    )`,
    [
      event.timestamp, event.serverTimestamp, event.type, event.label, event.detail, event.section, event.path, event.pagePath, event.method,
      event.visitorId, event.isLoggedIn, event.client.name, event.client.phone, event.client.email, event.client.status,
      event.origin, event.trafficSource, event.referrer, event.refererDomain, event.host, JSON.stringify(event.utm),
      event.ipMasked, event.ipHash, event.ipFullProtected,
      JSON.stringify(event.device), JSON.stringify(event.location), JSON.stringify(event.network), JSON.stringify(event.securityHeaders),
      event.deviceLocation?.latitude ?? null, event.deviceLocation?.longitude ?? null, event.deviceLocation?.accuracy ?? null, event.deviceLocation?.capturedAt ?? null, event.deviceLocationStatus,
      event.securityStatus === "Suspeito", JSON.stringify(event.suspiciousReasons),
    ]
  );
};

export async function addAnalyticsEvent(payload) {
  const requestPath = safeString(payload.requestPath || payload.path || "");
  if (staticPathPattern.test(requestPath)) return null;

  if (isDatabaseConfigured()) {
    const baseEvent = buildEventFields(payload);
    const recentCount = await countRecentSameVisitorFromDatabase(baseEvent);
    const event = finalizeEvent(baseEvent, recentCount);
    await insertEventToDatabase(event);
    return event;
  }

  // Fallback local: arquivo JSON em os.tmpdir(), so para desenvolvimento (ver aviso no topo do arquivo).
  const events = await readEventsFile();
  const baseEvent = buildEventFields(payload);
  const recentCount = countRecentSameVisitorFromArray(baseEvent, events);
  const event = finalizeEvent(baseEvent, recentCount);
  await writeEventsFile([...events, event]);
  return event;
}

// IP completo so e anexado para eventos ja marcados suspeitos, e so aqui (nunca na listagem
// comum) - preserva a mesma separacao de privacidade que o formato anterior ja tinha.
const attachSecurityDetails = (event) => {
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
};

// Mesma logica de corte de periodo usada no painel (ja corrigida o bug do "Hoje": zera a hora
// sem subtrair um dia antes). Calculada uma vez aqui para o backend nunca divergir do frontend.
const validPeriods = new Set(["today", "7d", "30d", "all"]);
const getPeriodCutoff = (period) => {
  if (period === "all") return null;

  const now = new Date();
  if (period === "today") {
    const cutoff = new Date(now);
    cutoff.setHours(0, 0, 0, 0);
    return cutoff;
  }

  const days = period === "7d" ? 7 : 30;
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
};

const clampPageSize = (value) => Math.min(Math.max(Number(value) || 25, 1), 100);
const clampPage = (value) => Math.max(Math.floor(Number(value)) || 1, 1);

const normalizeEventsQuery = (params = {}) => ({
  page: clampPage(params.page),
  pageSize: clampPageSize(params.pageSize),
  type: safeString(params.type, "all", 40) || "all",
  period: validPeriods.has(params.period) ? params.period : "all",
  search: safeString(params.search, "", 120).trim(),
  hasDeviceLocation: Boolean(params.hasDeviceLocation),
});

// Converte uma linha de analytics_events (snake_case, Postgres) para o mesmo formato de evento
// usado pelo painel (camelCase) - o AdminDashboard nao precisa saber que existe SQL por tras.
const rowToEvent = (row) => {
  const hasDeviceCoords = row.device_latitude !== null && row.device_longitude !== null;

  return {
    id: String(row.id),
    timestamp: row.event_timestamp.toISOString(),
    serverTimestamp: (row.server_timestamp || row.event_timestamp).toISOString(),
    type: row.type,
    label: row.label,
    detail: row.detail,
    section: row.section,
    path: row.path,
    pagePath: row.page_path,
    method: row.method,
    visitorId: row.visitor_id,
    isLoggedIn: row.is_logged_in,
    client: { name: row.user_name, phone: row.user_phone, email: row.user_email, status: row.client_status },
    origin: row.origin_label,
    trafficSource: row.traffic_source,
    referrer: row.referrer,
    refererDomain: row.referer_domain,
    host: row.host,
    utm: row.utm || {},
    ip: row.ip_masked,
    ipMasked: row.ip_masked,
    ipHash: row.ip_hash,
    ipFullProtected: row.ip_protected,
    device: row.device || {},
    location: row.location || {},
    network: row.network || {},
    securityHeaders: row.security_headers || {},
    deviceLocation: hasDeviceCoords
      ? {
          latitude: row.device_latitude,
          longitude: row.device_longitude,
          accuracy: row.device_accuracy,
          capturedAt: row.device_location_captured_at ? row.device_location_captured_at.toISOString() : null,
        }
      : null,
    deviceLocationStatus: row.device_location_status,
    securityStatus: row.suspicious ? "Suspeito" : "Normal",
    suspiciousReasons: row.suspicious_reasons || [],
  };
};

const buildEventsWhereClause = ({ type, period, search, hasDeviceLocation }, params) => {
  const conditions = [];
  const cutoff = getPeriodCutoff(period);

  if (cutoff) {
    params.push(cutoff);
    conditions.push(`event_timestamp >= $${params.length}`);
  }

  if (hasDeviceLocation) {
    conditions.push(`device_location_status = 'granted'`);
  } else if (type === "suspicious") {
    conditions.push(`suspicious = TRUE`);
  } else if (type !== "all") {
    params.push(type);
    conditions.push(`type = $${params.length}`);
  }

  if (search) {
    // Campos seguros e ja existentes no painel de busca; sempre via parametro do driver,
    // nunca concatenado na string SQL.
    params.push(`%${search}%`);
    const idx = params.length;
    conditions.push(
      `(visitor_id ILIKE $${idx} OR user_name ILIKE $${idx} OR user_email ILIKE $${idx} OR user_phone ILIKE $${idx} OR page_path ILIKE $${idx} OR ip_masked ILIKE $${idx} OR (location->>'city') ILIKE $${idx})`
    );
  }

  return conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
};

const getAnalyticsEventsPageFromDatabase = async ({ page, pageSize, type, period, search, hasDeviceLocation }) => {
  const whereParams = [];
  const whereClause = buildEventsWhereClause({ type, period, search, hasDeviceLocation }, whereParams);

  const countResult = await query(`SELECT COUNT(*)::int AS total FROM analytics_events ${whereClause}`, whereParams);
  const total = countResult.rows[0]?.total || 0;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;

  const rowsParams = [...whereParams, pageSize, offset];
  const rowsResult = await query(
    `SELECT * FROM analytics_events ${whereClause} ORDER BY event_timestamp DESC LIMIT $${rowsParams.length - 1} OFFSET $${rowsParams.length}`,
    rowsParams
  );

  return {
    events: rowsResult.rows.map(rowToEvent).map(attachSecurityDetails),
    pagination: { page: safePage, pageSize, total, totalPages },
  };
};

const eventMatchesSearch = (event, search) => {
  if (!search) return true;

  const identity = event.client || {};
  const haystack = [
    event.visitorId,
    identity.phone,
    identity.email,
    identity.name,
    event.pagePath || event.path,
    event.ipMasked || event.ip,
    event.location?.city,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(search.toLowerCase());
};

const getAnalyticsEventsPageFromFile = async ({ page, pageSize, type, period, search, hasDeviceLocation }) => {
  const events = await readEventsFile();
  const cutoff = getPeriodCutoff(period);

  const filtered = events.filter((event) => {
    if (cutoff && new Date(event.timestamp) < cutoff) return false;
    if (hasDeviceLocation) return event.deviceLocationStatus === "granted";
    if (type === "suspicious") return event.securityStatus === "Suspeito";
    if (type !== "all" && event.type !== type) return false;
    return eventMatchesSearch(event, search);
  });

  const sorted = filtered.slice().sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp));
  const total = sorted.length;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;

  return {
    events: sorted.slice(offset, offset + pageSize).map(attachSecurityDetails),
    pagination: { page: safePage, pageSize, total, totalPages },
  };
};

// Lista paginada de eventos para a tabela principal do painel. Nunca retorna a tabela inteira
// de uma vez (evita SELECT sem limite); filtros viram WHERE parametrizado no Postgres ou
// filtro equivalente em memoria no fallback local.
export async function getAnalyticsEventsPage(params = {}) {
  const normalized = normalizeEventsQuery(params);

  return isDatabaseConfigured()
    ? getAnalyticsEventsPageFromDatabase(normalized)
    : getAnalyticsEventsPageFromFile(normalized);
}

const buildComparison = (current, previous) => {
  if (!previous) return { current, previous, label: "Sem dados anteriores", trend: "none" };

  const percent = Math.round(((current - previous) / previous) * 100);
  return {
    current,
    previous,
    label: `${percent > 0 ? "+" : ""}${percent}% vs. mês anterior`,
    trend: percent > 0 ? "up" : percent < 0 ? "down" : "flat",
  };
};

// Metricas dos cards do painel: sempre calculadas por agregacao (COUNT/GROUP BY no Postgres, ou
// reduce equivalente no fallback), nunca a partir de uma pagina de eventos - assim os numeros
// continuam corretos independente da paginacao/filtro ativo na tabela de eventos.
const getAnalyticsSummaryFromDatabase = async ({ period }) => {
  const cutoff = getPeriodCutoff(period);
  const periodParams = cutoff ? [cutoff] : [];
  const periodWhere = cutoff ? "WHERE event_timestamp >= $1" : "";

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [summaryResult, comparisonResult] = await Promise.all([
    query(
      `SELECT
        COUNT(*) FILTER (WHERE type = 'visit') AS total_accesses,
        COUNT(DISTINCT visitor_id) AS unique_visitors,
        COUNT(DISTINCT visitor_id) FILTER (WHERE suspicious) AS suspicious_visitors,
        COUNT(*) FILTER (WHERE type IN ('click','whatsapp')) AS clicks,
        COUNT(*) FILTER (WHERE type = 'whatsapp') AS whatsapp,
        COUNT(*) FILTER (WHERE type = 'search') AS searches,
        COUNT(*) FILTER (WHERE type = 'login' AND label NOT ILIKE '%erro%') AS logins,
        MAX(event_timestamp) AS last_activity
      FROM analytics_events ${periodWhere}`,
      periodParams
    ),
    query(
      `SELECT
        COUNT(DISTINCT visitor_id) FILTER (WHERE event_timestamp >= $1 AND event_timestamp < $2) AS current_unique_visitors,
        COUNT(DISTINCT visitor_id) FILTER (WHERE event_timestamp >= $3 AND event_timestamp < $1) AS previous_unique_visitors,
        COUNT(*) FILTER (WHERE type IN ('click','whatsapp') AND event_timestamp >= $1 AND event_timestamp < $2) AS current_clicks,
        COUNT(*) FILTER (WHERE type IN ('click','whatsapp') AND event_timestamp >= $3 AND event_timestamp < $1) AS previous_clicks,
        COUNT(*) FILTER (WHERE type = 'whatsapp' AND event_timestamp >= $1 AND event_timestamp < $2) AS current_whatsapp,
        COUNT(*) FILTER (WHERE type = 'whatsapp' AND event_timestamp >= $3 AND event_timestamp < $1) AS previous_whatsapp,
        COUNT(*) FILTER (WHERE type = 'search' AND event_timestamp >= $1 AND event_timestamp < $2) AS current_searches,
        COUNT(*) FILTER (WHERE type = 'search' AND event_timestamp >= $3 AND event_timestamp < $1) AS previous_searches,
        COUNT(*) FILTER (WHERE type = 'login' AND label NOT ILIKE '%erro%' AND event_timestamp >= $1 AND event_timestamp < $2) AS current_logins,
        COUNT(*) FILTER (WHERE type = 'login' AND label NOT ILIKE '%erro%' AND event_timestamp >= $3 AND event_timestamp < $1) AS previous_logins
      FROM analytics_events
      WHERE event_timestamp >= $3`,
      [currentMonthStart, nextMonthStart, previousMonthStart]
    ),
  ]);

  const row = summaryResult.rows[0];
  const cmp = comparisonResult.rows[0];
  const totalAccesses = Number(row.total_accesses) || 0;
  const uniqueVisitors = Number(row.unique_visitors) || 0;

  return {
    metrics: {
      uniqueVisitors,
      totalAccesses,
      repeatedAccesses: Math.max(totalAccesses - uniqueVisitors, 0),
      suspiciousVisitors: Number(row.suspicious_visitors) || 0,
      clicks: Number(row.clicks) || 0,
      whatsapp: Number(row.whatsapp) || 0,
      searches: Number(row.searches) || 0,
      logins: Number(row.logins) || 0,
      lastActivity: row.last_activity ? row.last_activity.toISOString() : null,
    },
    comparisons: {
      uniqueVisitors: buildComparison(Number(cmp.current_unique_visitors) || 0, Number(cmp.previous_unique_visitors) || 0),
      clicks: buildComparison(Number(cmp.current_clicks) || 0, Number(cmp.previous_clicks) || 0),
      whatsapp: buildComparison(Number(cmp.current_whatsapp) || 0, Number(cmp.previous_whatsapp) || 0),
      searches: buildComparison(Number(cmp.current_searches) || 0, Number(cmp.previous_searches) || 0),
      logins: buildComparison(Number(cmp.current_logins) || 0, Number(cmp.previous_logins) || 0),
    },
  };
};

const getAnalyticsSummaryFromFile = async ({ period }) => {
  const events = await readEventsFile();
  const cutoff = getPeriodCutoff(period);
  const periodEvents = cutoff ? events.filter((event) => new Date(event.timestamp) >= cutoff) : events;

  const totalAccesses = periodEvents.filter((event) => event.type === "visit").length;
  const uniqueVisitors = new Set(periodEvents.map((event) => event.visitorId).filter(Boolean)).size;
  const suspiciousVisitors = new Set(
    periodEvents.filter((event) => event.securityStatus === "Suspeito").map((event) => event.visitorId)
  ).size;
  const clicks = periodEvents.filter((event) => event.type === "click" || event.type === "whatsapp").length;
  const whatsapp = periodEvents.filter((event) => event.type === "whatsapp").length;
  const searches = periodEvents.filter((event) => event.type === "search").length;
  const logins = periodEvents.filter(
    (event) => event.type === "login" && !String(event.label).toLowerCase().includes("erro")
  ).length;
  const lastActivity = periodEvents.reduce((max, event) => (!max || event.timestamp > max ? event.timestamp : max), "");

  const monthKey = (timestamp) => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  };
  const now = new Date();
  const currentMonthKey = monthKey(now);
  const previousMonthKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  const countMetricForMonth = (targetMonthKey, metric) => {
    const monthEvents = events.filter((event) => monthKey(event.timestamp) === targetMonthKey);
    if (metric === "uniqueVisitors") return new Set(monthEvents.map((event) => event.visitorId).filter(Boolean)).size;
    if (metric === "clicks") return monthEvents.filter((event) => event.type === "click" || event.type === "whatsapp").length;
    if (metric === "whatsapp") return monthEvents.filter((event) => event.type === "whatsapp").length;
    if (metric === "searches") return monthEvents.filter((event) => event.type === "search").length;
    if (metric === "logins") {
      return monthEvents.filter((event) => event.type === "login" && !String(event.label).toLowerCase().includes("erro")).length;
    }
    return 0;
  };

  const comparisons = {};
  ["uniqueVisitors", "clicks", "whatsapp", "searches", "logins"].forEach((metric) => {
    comparisons[metric] = buildComparison(countMetricForMonth(currentMonthKey, metric), countMetricForMonth(previousMonthKey, metric));
  });

  return {
    metrics: {
      uniqueVisitors,
      totalAccesses,
      repeatedAccesses: Math.max(totalAccesses - uniqueVisitors, 0),
      suspiciousVisitors,
      clicks,
      whatsapp,
      searches,
      logins,
      lastActivity: lastActivity || null,
    },
    comparisons,
  };
};

export async function getAnalyticsSummary(params = {}) {
  const period = validPeriods.has(params.period) ? params.period : "all";

  return isDatabaseConfigured() ? getAnalyticsSummaryFromDatabase({ period }) : getAnalyticsSummaryFromFile({ period });
}

export async function clearAnalyticsEvents({ visitorId } = {}) {
  if (isDatabaseConfigured()) {
    if (visitorId) {
      await query("DELETE FROM analytics_events WHERE visitor_id = $1", [visitorId]);
    } else {
      // "Limpar tudo" so afeta analytics_events - admin_sessions e um dominio separado
      // (autenticacao), nunca apagado por esta rota.
      await query("DELETE FROM analytics_events");
    }
    return;
  }

  if (visitorId) {
    const events = await readEventsFile();
    await writeEventsFile(events.filter((event) => event.visitorId !== visitorId));
    return;
  }

  await writeEventsFile([]);
}
