// Cliente leve do analytics usado pela area de vendas.
// Envia eventos para as APIs internas e usa localStorage apenas como fallback.
const storageKey = "imesul_demo_events";
const visitorKey = "imesul_demo_visitor_id";
const eventName = "imesul-demo-events-updated";
const trackEndpoint = "/api/analytics/track";
const eventsEndpoint = "/api/analytics/events";
const clearEndpoint = "/api/analytics/clear";
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

const writeStoredEvents = (events) => {
  if (!canUseBrowserStorage()) return;

  window.localStorage.setItem(storageKey, JSON.stringify(events.slice(-500)));
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
  adminSessionToken = "";
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
  const utm = {
    source: params.get("utm_source") || "",
    medium: params.get("utm_medium") || "",
    campaign: params.get("utm_campaign") || "",
    content: params.get("utm_content") || "",
    term: params.get("utm_term") || "",
  };
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

// Registra eventos no backend local e usa localStorage somente quando a API falha.
export function trackLocalEvent({
  type,
  label,
  detail = "",
  section = "",
  origin,
  client,
  isLoggedIn = false,
}) {
  if (!canUseBrowserStorage() || isAdminSession()) return null;

  const now = new Date();
  const traffic = getTrafficContext();
  const event = {
    id: `${now.getTime()}-${Math.random().toString(16).slice(2)}`,
    visitorId: getAnonymousVisitorId(),
    type,
    label,
    detail,
    section,
    path: window.location.pathname || "/",
    origin: origin || traffic.origin,
    referrer: traffic.referrer,
    utm: traffic.utm,
    ip: traffic.ip,
    client: sanitizeClient(client),
    timestamp: now.toISOString(),
    isLoggedIn: Boolean(isLoggedIn),
  };

  // Futuro: enviar evento para backend/analytics real com consentimento LGPD.
  sendEventToBackend(event)
    .then(() => notifyEventsUpdated())
    .catch(() => writeStoredEvents([...readStoredEvents(), event]));

  return event;
}

export async function getAnalyticsEvents() {
  if (!canUseBrowserStorage()) return [];

  try {
    const response = await fetch(eventsEndpoint, {
      cache: "no-store",
      headers: getAdminSessionToken() ? { Authorization: `Bearer ${getAdminSessionToken()}` } : {},
    });
    if (!response.ok) throw new Error("Falha ao consultar analytics.");

    const data = await response.json();
    return Array.isArray(data.events) ? data.events : [];
  } catch {
    return readStoredEvents();
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
