import { promises as fs } from "node:fs";
import path from "node:path";

const eventsPath = path.join(process.cwd(), "Backend.js", "analytics-events.json");
const maxEvents = 2000;

const allowedTypes = new Set(["visit", "click", "whatsapp", "search", "login"]);

const safeString = (value, fallback = "") =>
  typeof value === "string" ? value.slice(0, 500) : fallback;

const safeBoolean = (value) => Boolean(value);

const safeUtm = (utm = {}) => ({
  source: safeString(utm.source),
  medium: safeString(utm.medium),
  campaign: safeString(utm.campaign),
  content: safeString(utm.content),
  term: safeString(utm.term),
});

const ensureStoreFile = async () => {
  await fs.mkdir(path.dirname(eventsPath), { recursive: true });

  try {
    await fs.access(eventsPath);
  } catch {
    // Arquivo de eventos local não deve ser versionado. Em produção, usar banco de dados.
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

const sanitizeEvent = (payload = {}) => {
  const now = new Date();
  const userName = safeString(payload.userName || payload.client?.name);
  const userPhone = safeString(payload.userPhone || payload.client?.phone);
  const userEmail = safeString(payload.userEmail || payload.client?.email);
  const isLoggedIn = safeBoolean(payload.isLoggedIn);

  return {
    id: `${now.getTime()}-${Math.random().toString(16).slice(2)}`,
    visitorId: safeString(payload.visitorId, "visitor-unavailable"),
    type: allowedTypes.has(payload.type) ? payload.type : "click",
    label: safeString(payload.label),
    detail: safeString(payload.detail),
    section: safeString(payload.section),
    origin: safeString(payload.source || payload.origin, "Direto / não informado"),
    referrer: safeString(payload.referrer),
    utm: safeUtm(payload.utm),
    ip: "não registrado",
    client: {
      name: userName,
      phone: userPhone,
      email: userEmail,
      status: isLoggedIn || userName || userPhone || userEmail ? "Cliente com login" : "Visitante sem login",
    },
    timestamp: now.toISOString(),
    isLoggedIn,
  };
};

// Armazenamento local apenas para desenvolvimento; em produção usar banco de dados real.
export async function addAnalyticsEvent(payload) {
  const event = sanitizeEvent(payload);
  const events = await readEventsFile();
  await writeEventsFile([...events, event]);
  return event;
}

export async function getAnalyticsEvents() {
  return readEventsFile();
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
