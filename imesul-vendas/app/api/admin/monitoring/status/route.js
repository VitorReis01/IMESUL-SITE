import { isAdminRequest } from "../../../../../Backend.js/adminSecurity";
import { getImebotProtectionSnapshot } from "../../../../../Backend.js/imebotAbuseGuard";
import { isImebotEnabled } from "../../../../../Backend.js/imebotFeatureGate";
import { query } from "../../../../../Backend.js/db";
import { methodNotAllowed as sharedMethodNotAllowed, noStoreJson } from "../../../../../Backend.js/requestGuards";

const timeoutMs = 1500;

const methodNotAllowed = () => sharedMethodNotAllowed("GET");

const serviceNames = {
  institutional: "Site Institucional",
  sales: "Site de Vendas",
  api: "API",
  database: "Banco de Dados",
  imebot: "IMEbot",
};

const measure = async (task) => {
  const startedAt = Date.now();
  await task();
  return Date.now() - startedAt;
};

const withTimeout = (promise, ms = timeoutMs) => {
  const controller = new AbortController();
  let timeoutId;

  const run = typeof promise === "function" ? promise(controller.signal) : promise;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error("timeout"));
    }, ms);
  });

  return Promise.race([Promise.resolve(run), timeout]).finally(() => clearTimeout(timeoutId));
};

const checkHttpHealth = async (url) => {
  if (!url) return { status: "degraded", latencyMs: null, lastFailure: "Endpoint não configurado" };

  try {
    const latencyMs = await measure(async () => {
      const response = await withTimeout((signal) => fetch(url, { cache: "no-store", signal }));
      if (!response.ok) throw new Error("unhealthy");
    });

    return { status: "online", latencyMs, lastFailure: null };
  } catch {
    return { status: "offline", latencyMs: null, lastFailure: "Falha na verificação" };
  }
};

const checkDatabase = async () => {
  try {
    const latencyMs = await measure(() => withTimeout(query("SELECT 1")));
    return { status: "online", latencyMs, lastFailure: null };
  } catch {
    return { status: "offline", latencyMs: null, lastFailure: "Banco indisponível" };
  }
};

const normalizeBaseUrl = (value = "") => {
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
};

const buildService = (key, result, checkedAt) => ({
  name: serviceNames[key],
  status: result.status,
  latencyMs: typeof result.latencyMs === "number" ? result.latencyMs : null,
  lastCheck: checkedAt,
  lastFailure: result.lastFailure || null,
});

export async function GET(request) {
  try {
    if (!(await isAdminRequest(request))) {
      return noStoreJson({ ok: false, message: "Acesso não autorizado." }, { status: 401 });
    }
  } catch {
    return noStoreJson({ ok: false, message: "Acesso não autorizado." }, { status: 401 });
  }

  const checkedAt = new Date().toISOString();
  const salesBaseUrl = new URL(request.url).origin;
  const institutionalBaseUrl = normalizeBaseUrl(
    process.env.NEXT_PUBLIC_INSTITUTIONAL_URL || process.env.NEXT_PUBLIC_INSTITUTIONAL_SITE_URL
  );

  const [institutional, sales, database] = await Promise.all([
    checkHttpHealth(institutionalBaseUrl ? `${institutionalBaseUrl}/api/health` : ""),
    checkHttpHealth(`${salesBaseUrl}/api/health`),
    checkDatabase(),
  ]);

  const services = {
    institutional: buildService("institutional", institutional, checkedAt),
    sales: buildService("sales", sales, checkedAt),
    api: buildService("api", { status: "online", latencyMs: null, lastFailure: null }, checkedAt),
    database: buildService("database", database, checkedAt),
    imebot: buildService(
      "imebot",
      isImebotEnabled()
        ? { status: "online", latencyMs: null, lastFailure: null }
        : { status: "disabled", latencyMs: null, lastFailure: null },
      checkedAt
    ),
  };

  const incidents = Object.entries(services)
    .filter(([, service]) => service.status !== "online" && service.status !== "disabled")
    .map(([key, service]) => ({
      service: key,
      label: service.name,
      status: service.status,
      message: service.lastFailure || "Serviço indisponível",
      checkedAt,
    }));

  return noStoreJson({
    ok: true,
    checkedAt,
    externalMonitoring: {
      connected: false,
      message: "Monitoramento externo ainda não conectado",
    },
    services,
    incidents,
    imebotProtection: getImebotProtectionSnapshot(),
  });
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
