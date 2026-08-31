import "server-only";
import { createHash } from "crypto";
import { checkRateLimit, checkRateLimitLayers } from "./rateLimiter";
import { logger } from "./logger";
import { COMMERCIAL_UNITS } from "../lib/leadFlow";

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const imebotAbuseConfig = {
  minResponseIntervalSeconds: toNumber(process.env.IMEBOT_MIN_RESPONSE_INTERVAL_SECONDS, 8),
  maxMessagesPerMinute: toNumber(process.env.IMEBOT_MAX_MESSAGES_PER_MINUTE, 6),
  maxMessagesPer5Minutes: toNumber(process.env.IMEBOT_MAX_MESSAGES_PER_5_MINUTES, 18),
  blockDurationSeconds: toNumber(process.env.IMEBOT_BLOCK_DURATION_SECONDS, 300),
  maxResponsesPerHour: toNumber(process.env.IMEBOT_MAX_RESPONSES_PER_HOUR, 80),
  maxResponsesPerDay: toNumber(process.env.IMEBOT_MAX_RESPONSES_PER_DAY, 500),
  dailyCostWarning: toNumber(process.env.IMEBOT_DAILY_COST_WARNING, 0),
  dailyCostHardStop: toNumber(process.env.IMEBOT_DAILY_COST_HARD_STOP, 0),
};

const cleanPhone = (phone) => String(phone || "").replace(/\D/g, "").slice(0, 40);
const messageHash = (text) =>
  createHash("sha256").update(String(text || "").trim().toLowerCase()).digest("hex").slice(0, 24);

export const isImebotCostGuardedUnit = (unit) => unit === COMMERCIAL_UNITS.CAMPO_GRANDE;

// ============================================================================================
// A) INBOUND ABUSE — toda mensagem recebida passa por aqui (rate limit por telefone/conversa,
// repetição, bloqueio temporário via janela). NUNCA toca os contadores globais de quota paga
// (ver seção B) — os dois grupos de camadas são checados em chamadas Postgres separadas, nunca
// misturados no mesmo array/Promise.all, exatamente para que uma mensagem barrada aqui não
// incremente o orçamento pago (ver reservePaidActionBudget).
// ============================================================================================
export const buildInboundAbuseLayers = ({ phone, messageText = "", unit }) => {
  if (!isImebotCostGuardedUnit(unit)) return [];

  const phoneKey = cleanPhone(phone) || "unknown";
  const repeatedHash = messageHash(messageText);
  const config = imebotAbuseConfig;

  return [
    {
      key: `imebot:phone:min-interval:${phoneKey}`,
      windowMs: config.minResponseIntervalSeconds * 1000,
      max: 1,
    },
    {
      key: `imebot:phone:minute:${phoneKey}`,
      windowMs: 60_000,
      max: config.maxMessagesPerMinute,
    },
    {
      key: `imebot:phone:5min:${phoneKey}`,
      windowMs: 5 * 60_000,
      max: config.maxMessagesPer5Minutes,
    },
    {
      key: `imebot:phone:repeat:${phoneKey}:${repeatedHash}`,
      windowMs: config.blockDurationSeconds * 1000,
      max: 3,
    },
  ];
};

// ============================================================================================
// B) PAID ACTION BUDGET — quota global hora/dia + circuit breaker. Só deve ser chamada
// imediatamente antes de uma ação que realmente pode gerar custo (hoje: criar um lead
// WHATSAPP_IMEBOT e acionar o rodízio/handoff; no futuro, o envio real de mensagem paga via
// Meta Cloud API). Nunca chamada para mensagens que já foram barradas pelo abuse guard (A).
// ============================================================================================
export const buildPaidActionBudgetLayers = ({ unit }) => {
  if (!isImebotCostGuardedUnit(unit)) return [];

  const config = imebotAbuseConfig;

  return [
    {
      key: "imebot:global:responses-hour",
      windowMs: 60 * 60_000,
      max: config.maxResponsesPerHour,
    },
    {
      key: "imebot:global:responses-day",
      windowMs: 24 * 60 * 60_000,
      max: config.maxResponsesPerDay,
    },
  ];
};

const logGuardBlocked = async ({ status, unit, isGlobalLimit, phone, result, checkAlertLimit, log }) => {
  const alertKey = `imebot:alert:${isGlobalLimit ? "global" : cleanPhone(phone) || "unknown"}`;
  try {
    const alertLimit = await checkAlertLimit({ key: alertKey, windowMs: 5 * 60_000, max: 1 });
    if (alertLimit.allowed) {
      log.warn("imebot_cost_guard_blocked", {
        status,
        unit,
        reason: isGlobalLimit ? "global_limit" : "phone_or_conversation_limit",
        retryAfterSeconds: result.retryAfterSeconds,
      });
    }
  } catch {
    // Se o limitador de alerta falhar, mantém a proteção principal sem abrir detalhes no log.
  }
};

// A) Camada de abuso — deve ser a PRIMEIRA coisa checada para toda mensagem inbound (depois de
// assinatura válida + dedup por wamid, que acontecem antes disso no webhook). Nunca consome
// orçamento pago: as únicas queries que ela dispara são as camadas de buildInboundAbuseLayers.
export const checkInboundAbuseGuard = async ({
  phone,
  messageText = "",
  unit,
  checkLayers = checkRateLimitLayers,
  checkAlertLimit = checkRateLimit,
  log = logger,
} = {}) => {
  const layers = buildInboundAbuseLayers({ phone, messageText, unit });
  if (!layers.length) {
    return { allowed: true, status: "not_applicable", retryAfterSeconds: 0 };
  }

  const result = await checkLayers(layers);
  if (result.allowed) {
    return { allowed: true, status: "normal", retryAfterSeconds: 0 };
  }

  await logGuardBlocked({ status: "throttled", unit, isGlobalLimit: false, phone, result, checkAlertLimit, log });

  return { allowed: false, status: "throttled", retryAfterSeconds: result.retryAfterSeconds };
};

// B) Reserva/autoriza a ação paga — só deve ser chamada depois que checkInboundAbuseGuard já
// autorizou a mensagem. É a ÚNICA função que incrementa os contadores globais de quota
// (imebot:global:responses-hour/day), então é ela quem decide se o circuit breaker abre.
export const reservePaidActionBudget = async ({
  unit,
  checkLayers = checkRateLimitLayers,
  checkAlertLimit = checkRateLimit,
  log = logger,
} = {}) => {
  const layers = buildPaidActionBudgetLayers({ unit });
  if (!layers.length) {
    return { allowed: true, status: "not_applicable", retryAfterSeconds: 0 };
  }

  const result = await checkLayers(layers);
  if (result.allowed) {
    return { allowed: true, status: "normal", retryAfterSeconds: 0 };
  }

  await logGuardBlocked({ status: "paused", unit, isGlobalLimit: true, phone: undefined, result, checkAlertLimit, log });

  return { allowed: false, status: "paused", retryAfterSeconds: result.retryAfterSeconds };
};

// Atalho para o caso comum (webhook, ponto único de criação de lead novo): roda A e só chama B
// se A autorizou. Preserva a ORDEM exigida — abuse guard sempre antes do orçamento pago — e
// garante que uma mensagem barrada por abuso nunca chega perto da quota global.
export const checkImebotCostGuard = async ({
  phone,
  messageText = "",
  unit,
  checkLayers = checkRateLimitLayers,
  checkAlertLimit = checkRateLimit,
  log = logger,
} = {}) => {
  const abuseResult = await checkInboundAbuseGuard({ phone, messageText, unit, checkLayers, checkAlertLimit, log });
  if (!abuseResult.allowed) return abuseResult;

  return reservePaidActionBudget({ unit, checkLayers, checkAlertLimit, log });
};

export const getImebotProtectionSnapshot = () => ({
  status: "normal",
  mode: "volume_quota",
  config: {
    minResponseIntervalSeconds: imebotAbuseConfig.minResponseIntervalSeconds,
    maxMessagesPerMinute: imebotAbuseConfig.maxMessagesPerMinute,
    maxMessagesPer5Minutes: imebotAbuseConfig.maxMessagesPer5Minutes,
    blockDurationSeconds: imebotAbuseConfig.blockDurationSeconds,
    maxResponsesPerHour: imebotAbuseConfig.maxResponsesPerHour,
    maxResponsesPerDay: imebotAbuseConfig.maxResponsesPerDay,
    budgetGuardReady: true,
    costModelConfigured: false,
  },
});
