import { isAdminRequest } from "../../../../../Backend.js/adminSecurity";
import { getImebotGlobalQuotaState, getImebotProtectionSnapshot } from "../../../../../Backend.js/imebotAbuseGuard";
import { isImebotEnabled } from "../../../../../Backend.js/imebotFeatureGate";
import { logger } from "../../../../../Backend.js/logger";
import { isMonitoringEnabled } from "../../../../../Backend.js/monitoringAuth";
import { query } from "../../../../../Backend.js/db";
import { checkOrigin, forbidden, getRequestId, methodNotAllowed as sharedMethodNotAllowed, noStoreJson } from "../../../../../Backend.js/requestGuards";

const timeoutMs = 1500;
// Acima disso o banco respondeu mas devagar - sinaliza "degraded" em vez de esperar o timeout
// inteiro para so entao dizer "offline" (ver secao Health checks do relatorio de hardening).
const slowQueryThresholdMs = 500;

const methodNotAllowed = () => sharedMethodNotAllowed("GET");

const serviceNames = {
  institutional: "Site Institucional",
  sales: "Site de Vendas",
  api: "API",
  database: "Banco de Dados",
  rateLimiter: "Rate Limiter",
  imebot: "IMEbot",
  monitoring: "Monitoramento Externo",
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
    if (latencyMs > slowQueryThresholdMs) {
      return { status: "degraded", latencyMs, lastFailure: "Latência acima do esperado" };
    }
    return { status: "online", latencyMs, lastFailure: null };
  } catch {
    return { status: "offline", latencyMs: null, lastFailure: "Banco indisponível" };
  }
};

// Rate limiting distribuído roda nas mesmas tabelas/conexão do Postgres (ver
// Backend.js/rateLimiter.js) - reflete o mesmo resultado de checkDatabase em vez de abrir uma
// segunda conexão só para health check (evita operação pesada extra a cada request do painel,
// ver seção Health checks do relatório de hardening).
const deriveRateLimiterStatus = (databaseResult) => databaseResult;

const checkMonitoringIntegration = () =>
  isMonitoringEnabled()
    ? { status: "online", latencyMs: null, lastFailure: null }
    : { status: "disabled", latencyMs: null, lastFailure: null };

// Estado GLOBAL real do circuit breaker do IMEbot, lido do Postgres compartilhado (não da
// memória local de uma instância - ver comentário em getImebotGlobalQuotaState). Só leitura,
// não incrementa quota nem toca a lógica de autorização - uma falha AQUI (timeout, banco fora
// do ar) nunca deve mudar autorização/quota/rate limit/circuit breaker real, só o que este
// painel exibe. Por isso cai para "degraded" (não "online", que seria falso positivo de saúde,
// nem "paused", que fingiria um circuit breaker aberto que não foi de fato confirmado) quando a
// leitura falha - "não sei" é um estado diferente de "sei que está tudo bem".
const checkImebotGlobalState = async () => {
  if (!isImebotEnabled()) return { status: "disabled", latencyMs: null, lastFailure: null };

  try {
    let globalStatus;
    const latencyMs = await measure(async () => {
      globalStatus = await withTimeout(getImebotGlobalQuotaState());
    });
    return globalStatus.status === "paused"
      ? { status: "paused", latencyMs, lastFailure: "Quota global de respostas pagas esgotada" }
      : { status: "online", latencyMs, lastFailure: null };
  } catch {
    return { status: "degraded", latencyMs: null, lastFailure: "Não foi possível ler o estado da quota global" };
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
  // Sessão via cookie HttpOnly SameSite=Strict - checkOrigin é defesa extra contra CSRF (rota é
  // GET/leitura; a proteção real é o SameSite=Strict do cookie, ver Backend.js/adminSecurity.js).
  if (!checkOrigin(request).allowed) return forbidden();

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

  const [institutional, sales, database, imebotStatus] = await Promise.all([
    checkHttpHealth(institutionalBaseUrl ? `${institutionalBaseUrl}/api/health` : ""),
    checkHttpHealth(`${salesBaseUrl}/api/health`),
    checkDatabase(),
    checkImebotGlobalState(),
  ]);

  // getImebotProtectionSnapshot continua exposta no payload como telemetria LOCAL desta
  // instância (nunca autoritativa - ver comentário no próprio Backend.js/imebotAbuseGuard.js);
  // o estado exibido no painel (services.imebot acima) vem de checkImebotGlobalState, que lê o
  // Postgres compartilhado e é o mesmo entre todas as instâncias.
  const imebotProtection = getImebotProtectionSnapshot();

  const services = {
    institutional: buildService("institutional", institutional, checkedAt),
    sales: buildService("sales", sales, checkedAt),
    api: buildService("api", { status: "online", latencyMs: null, lastFailure: null }, checkedAt),
    database: buildService("database", database, checkedAt),
    rateLimiter: buildService("rateLimiter", deriveRateLimiterStatus(database), checkedAt),
    imebot: buildService("imebot", imebotStatus, checkedAt),
    monitoring: buildService("monitoring", checkMonitoringIntegration(), checkedAt),
  };

  const healthyStatuses = new Set(["online", "disabled"]);
  const incidents = Object.entries(services)
    .filter(([, service]) => !healthyStatuses.has(service.status))
    .map(([key, service]) => ({
      service: key,
      label: service.name,
      status: service.status,
      message: service.lastFailure || "Serviço indisponível",
      checkedAt,
    }));

  const requestId = getRequestId(request);
  if (incidents.length > 0) {
    // Log agregado (nao um por servico) - evita flood quando varios servicos degradam juntos
    // (ex.: banco lento derruba latencia de varias checagens ao mesmo tempo).
    logger.warn("health_degraded", {
      requestId,
      services: incidents.map((incident) => incident.service),
    });
  }

  return noStoreJson(
    {
      ok: true,
      checkedAt,
      externalMonitoring: {
        connected: isMonitoringEnabled(),
        message: isMonitoringEnabled()
          ? "Monitoramento externo conectado"
          : "Monitoramento externo ainda não conectado",
      },
      services,
      incidents,
      imebotProtection,
    },
    { headers: { "X-Request-ID": requestId } }
  );
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
