// Cliente leve do analytics usado pela area de vendas.
// Envia eventos para as APIs internas e usa localStorage apenas como fallback.
import { readConsent } from "./consent";

const storageKey = "imesul_demo_events";
const visitorKey = "imesul_demo_visitor_id";
const eventName = "imesul-demo-events-updated";
const trackEndpoint = "/api/analytics/track";
const eventsEndpoint = "/api/analytics/events";
const clearEndpoint = "/api/analytics/clear";
const logoutEndpoint = "/api/admin/logout";
let adminSessionToken = "";

const canUseBrowserStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const readStoredEvents = () => {
  if (!canUseBrowserStorage()) return [];

  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const notifyEventsUpdated = () => {
  if (!canUseBrowserStorage()) return;
  window.dispatchEvent(new CustomEvent(eventName));
};

// So um pequeno buffer de curto prazo para quando o POST ao backend falhar - o Postgres e o
// armazenamento de verdade agora, entao o navegador nao precisa (nem deve) guardar um "historico"
// grande. 50 eventos e suficiente para uma instabilidade breve sem virar retencao de dados.
const maxFallbackEvents = 50;

const writeStoredEvents = (events) => {
  if (!canUseBrowserStorage()) return;

  window.localStorage.setItem(storageKey, JSON.stringify(events.slice(-maxFallbackEvents)));
  notifyEventsUpdated();
};

export const isAdminSession = () =>
  Boolean(adminSessionToken);

export const getAdminSessionToken = () =>
  adminSessionToken;

export const startAdminSession = (token = "") => {
  // O token admin fica apenas em memoria; ao recarregar a pagina, o login precisa ser refeito.
  adminSessionToken = token;
};

export const endAdminSession = () => {
  const token = adminSessionToken;
  adminSessionToken = "";

  // Revoga a sessao no servidor tambem: sem isso, o token continuaria valido ate o TTL natural.
  if (token) {
    fetch(logoutEndpoint, { method: "POST", headers: { Authorization: `Bearer ${token}` }, keepalive: true }).catch(() => {});
  }
};

export const removeCurrentVisitorEvents = () => {
  if (!canUseBrowserStorage()) return;

  const currentVisitorId = getAnonymousVisitorId();
  writeStoredEvents(readStoredEvents().filter((event) => event.visitorId !== currentVisitorId));

  // Remove do backend local os eventos criados antes da sessao atual virar admin.
  fetch(`${clearEndpoint}?visitorId=${encodeURIComponent(currentVisitorId)}`, {
    method: "DELETE",
    headers: getAdminSessionToken() ? { Authorization: `Bearer ${getAdminSessionToken()}` } : {},
  })
    .then(() => notifyEventsUpdated())
    .catch(() => {});
};

const createAnonymousVisitorId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `visitor-${crypto.randomUUID()}`;
  }

  return `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const getAnonymousVisitorId = () => {
  if (!canUseBrowserStorage()) return "visitor-unavailable";

  const current = window.localStorage.getItem(visitorKey);
  if (current) return current;

  const next = createAnonymousVisitorId();
  window.localStorage.setItem(visitorKey, next);
  return next;
};

const utmStorageKey = "imesul_demo_utm_first_touch";

const getPersistedUtm = () => {
  try {
    const stored = window.sessionStorage.getItem(utmStorageKey);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const persistUtm = (utm) => {
  try {
    window.sessionStorage.setItem(utmStorageKey, JSON.stringify(utm));
  } catch {
    // sessionStorage indisponivel (ex.: modo privado); segue sem persistir entre paginas.
  }
};

const getTrafficContext = () => {
  if (typeof window === "undefined") {
    return {
      origin: "Direto / nao informado",
      referrer: "",
      utm: {},
      ip: "nao registrado",
    };
  }

  const params = new URLSearchParams(window.location.search);
  const urlUtm = {
    source: params.get("utm_source") || "",
    medium: params.get("utm_medium") || "",
    campaign: params.get("utm_campaign") || "",
    content: params.get("utm_content") || "",
    term: params.get("utm_term") || "",
  };
  const hasUrlUtm = Object.values(urlUtm).some(Boolean);

  // Mantem a campanha do primeiro clique durante a sessao (sessionStorage - some ao fechar a
  // aba), mesmo apos navegar para paginas sem UTM na URL. Uma navegacao interna sem UTM nunca
  // sobrescreve uma campanha ja registrada.
  let utm = urlUtm;
  if (hasUrlUtm) {
    persistUtm(urlUtm);
  } else {
    const persisted = getPersistedUtm();
    if (persisted) utm = persisted;
  }

  const hasUtm = Object.values(utm).some(Boolean);
  const referrer = document.referrer || "";

  return {
    origin: hasUtm
      ? `UTM: ${utm.source || "origem nao informada"}`
      : referrer || "Direto / nao informado",
    referrer,
    utm,
    // O frontend nao registra IP; em producao isso deve ser tratado no backend com consentimento.
    ip: "nao registrado",
  };
};

const sanitizeClient = (client = {}) => ({
  name: client.name || "",
  phone: client.phone || "",
  email: client.email || "",
  status: client.status || (client.name || client.phone || client.email ? "Cliente com login" : "Visitante sem login"),
});

const createBackendPayload = (event) => ({
  type: event.type,
  label: event.label,
  detail: event.detail,
  section: event.section,
  path: event.path,
  isLoggedIn: event.isLoggedIn,
  userName: event.client?.name || "",
  userPhone: event.client?.phone || "",
  userEmail: event.client?.email || "",
  visitorId: event.visitorId,
  source: event.origin,
  referrer: event.referrer,
  utm: event.utm,
  deviceLocation: event.deviceLocation || undefined,
  deviceLocationStatus: event.deviceLocationStatus || undefined,
});

const sendEventToBackend = async (event) => {
  const response = await fetch(trackEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(createBackendPayload(event)),
    keepalive: true,
  });

  if (!response.ok) throw new Error("Falha ao enviar analytics.");
  return response.json();
};

// Evita reenviar o mesmo evento em sequencia (React StrictMode remonta effects em dev, e um
// clique/efeito duplicado pode disparar a mesma chamada duas vezes). Guarda so a ULTIMA
// assinatura + horario: eventos legitimos diferentes (label/section/path diferentes) ou o
// mesmo evento repetido apos a janela continuam passando normalmente.
const duplicateGuardWindowMs = 2000;
let lastEventSignature = "";
let lastEventAt = 0;

const isDuplicateEvent = (signature) => {
  const now = Date.now();
  const isDuplicate = signature === lastEventSignature && now - lastEventAt < duplicateGuardWindowMs;
  lastEventSignature = signature;
  lastEventAt = now;
  return isDuplicate;
};

// Registra eventos no backend local e usa localStorage somente quando a API falha.
export function trackLocalEvent({
  type,
  label,
  detail = "",
  section = "",
  origin,
  client,
  isLoggedIn = false,
  deviceLocation,
  deviceLocationStatus,
}) {
  if (!canUseBrowserStorage() || isAdminSession()) return null;

  // "device_location" tem consentimento proprio (toggle "Localizacao do dispositivo"); todo o
  // resto (clique, busca, visita, whatsapp, login demonstrativo etc.) e analytics opcional e
  // depende do toggle "Analytics". Sem nenhuma decisao salva ainda, nada opcional e enviado.
  const consent = readConsent();
  const requiredConsent = type === "device_location" ? consent?.location : consent?.analytics;
  if (!requiredConsent) return null;

  const path = window.location.pathname || "/";
  if (isDuplicateEvent(`${type}|${label}|${section}|${path}`)) return null;

  const now = new Date();
  const traffic = getTrafficContext();
  const event = {
    id: `${now.getTime()}-${Math.random().toString(16).slice(2)}`,
    visitorId: getAnonymousVisitorId(),
    type,
    label,
    detail,
    section,
    path,
    origin: origin || traffic.origin,
    referrer: traffic.referrer,
    utm: traffic.utm,
    ip: traffic.ip,
    client: sanitizeClient(client),
    timestamp: now.toISOString(),
    isLoggedIn: Boolean(isLoggedIn),
    deviceLocation,
    deviceLocationStatus,
  };

  // Futuro: enviar evento para backend/analytics real com consentimento LGPD.
  sendEventToBackend(event)
    .then(() => notifyEventsUpdated())
    .catch(() => writeStoredEvents([...readStoredEvents(), stripSensitiveFieldsForLocalFallback(event)]));

  return event;
}

// O fallback local so existe para quando o POST ao backend falha (rede/servidor fora do ar) -
// o Postgres, nao o navegador, e o armazenamento de verdade. Por isso o localStorage nunca
// precisa (nem deve) guardar dados pessoais: nome/telefone/e-mail e coordenadas de localizacao
// do dispositivo saem do evento antes de cair no fallback (auditoria de seguranca, minimizacao
// de dados agora que o Postgres esta em producao).
const stripSensitiveFieldsForLocalFallback = (event) => ({
  ...event,
  client: { status: event.client?.status || "Visitante sem login" },
  deviceLocation: undefined,
});

const defaultPagination = { page: 1, pageSize: 25, total: 0, totalPages: 1 };

// Busca eventos paginados/filtrados server-side. params: page, pageSize, type, period, search,
// hasDeviceLocation - todos opcionais, sanitizados de novo no servidor independente do que
// chega aqui. Se a API falhar (rede/servidor fora do ar), cai para o cache local (sem paginacao
// real - so um retrato do que ja estava salvo no navegador).
export async function getAnalyticsEvents(params = {}) {
  if (!canUseBrowserStorage()) return { events: [], pagination: defaultPagination, summary: null };

  try {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));
    if (params.type) query.set("type", params.type);
    if (params.period) query.set("period", params.period);
    if (params.search) query.set("search", params.search);
    if (params.hasDeviceLocation) query.set("hasDeviceLocation", "true");

    const response = await fetch(`${eventsEndpoint}?${query.toString()}`, {
      cache: "no-store",
      headers: getAdminSessionToken() ? { Authorization: `Bearer ${getAdminSessionToken()}` } : {},
    });
    if (!response.ok) throw new Error("Falha ao consultar analytics.");

    const data = await response.json();
    return {
      events: Array.isArray(data.events) ? data.events : [],
      pagination: data.pagination || defaultPagination,
      summary: data.summary || null,
    };
  } catch {
    const events = readStoredEvents();
    return {
      events,
      pagination: { page: 1, pageSize: events.length || 25, total: events.length, totalPages: 1 },
      summary: null,
    };
  }
}

export function getLocalEvents() {
  return readStoredEvents();
}

export async function clearLocalEvents() {
  writeStoredEvents([]);

  try {
    await fetch(clearEndpoint, {
      method: "DELETE",
      headers: getAdminSessionToken() ? { Authorization: `Bearer ${getAdminSessionToken()}` } : {},
    });
  } catch {
    // Se o backend estiver indisponivel, o fallback local ja foi limpo.
  }

  notifyEventsUpdated();
}

export function subscribeToLocalEvents(callback) {
  if (!canUseBrowserStorage()) return () => {};

  const handler = () => callback(readStoredEvents());
  window.addEventListener(eventName, handler);
  window.addEventListener("storage", handler);

  return () => {
    window.removeEventListener(eventName, handler);
    window.removeEventListener("storage", handler);
  };
}
