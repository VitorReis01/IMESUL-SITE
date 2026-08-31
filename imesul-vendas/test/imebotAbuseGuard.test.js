import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildInboundAbuseLayers,
  buildPaidActionBudgetLayers,
  checkImebotCostGuard,
  checkInboundAbuseGuard,
  getImebotProtectionSnapshot,
  isImebotCostGuardedUnit,
  reservePaidActionBudget,
} from "../Backend.js/imebotAbuseGuard";
import { registerWebhookEventOnce } from "../Backend.js/imebotStore";
import { COMMERCIAL_UNITS } from "../lib/leadFlow";

// Simula o UPSERT atômico real de rate_limit_counters (ver Backend.js/rateLimiter.js): uma única
// operação síncrona de leitura+comparação+escrita por chamada, sem `await` interno antes de
// mutar o contador. Como o corpo da função roda até o fim de forma síncrona antes de resolver a
// Promise, chamadas concorrentes via Promise.all são serializadas pelo event loop exatamente
// como o Postgres serializa concorrência na mesma linha via lock - isso testa o CONTRATO real de
// atomicidade, não uma versão idealizada dele.
const createAtomicRateLimitDb = () => {
  const store = new Map();
  const query = vi.fn(async (text, params) => {
    if (/DELETE FROM rate_limit_counters/.test(text)) return { rowCount: 0 };

    const [key, windowMs] = params;
    const now = Date.now();
    const existing = store.get(key);
    let count;
    let windowStart;
    if (!existing || existing.windowStart <= now - windowMs) {
      count = 1;
      windowStart = now;
    } else {
      count = existing.count + 1;
      windowStart = existing.windowStart;
    }
    store.set(key, { count, windowStart });
    return { rows: [{ count, window_start: new Date(windowStart) }] };
  });
  return { query };
};

const originalEnv = { ...process.env };

const withFreshGuardModule = async (envOverrides, run) => {
  process.env = { ...originalEnv, ...envOverrides };
  vi.resetModules();
  const db = createAtomicRateLimitDb();
  vi.doMock("../Backend.js/db", () => db);
  try {
    const guard = await import("../Backend.js/imebotAbuseGuard");
    const { COMMERCIAL_UNITS: units } = await import("../lib/leadFlow");
    await run({ guard, units, db });
  } finally {
    vi.doUnmock("../Backend.js/db");
  }
};

describe("proteção de custo do IMEbot", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("ignora o mesmo webhook_event_id recebido mais de uma vez", async () => {
    const runQuery = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 0 });

    await expect(registerWebhookEventOnce("wamid.123", runQuery)).resolves.toBe(true);
    await expect(registerWebhookEventOnce("wamid.123", runQuery)).resolves.toBe(false);
    expect(runQuery).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT"),
      ["wamid.123"]
    );
  });

  it("mensagem duplicada (mesmo wamid) nunca consome quota, pois o dedup vem antes de qualquer guarda", async () => {
    // Replica a estrutura real do webhook (Backend.js/imebotStore.js + app/api/imebot/webhook/
    // route.js#processInboundMessage): registerWebhookEventOnce roda ANTES de qualquer chamada a
    // checkInboundAbuseGuard/reservePaidActionBudget, e um evento repetido faz o handler
    // retornar sem nunca alcançar essas guardas. Rotas de API não têm teste automatizado direto
    // neste projeto (ver CLAUDE.md), então este teste fixa o contrato no nível das funções puras
        // que a rota consome.
    const runQuery = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 0 });

    const guardInvocations = [];
    const checkLayers = vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });

    const processOnce = async (wamid) => {
      const isNewEvent = await registerWebhookEventOnce(wamid, runQuery);
      if (!isNewEvent) return;
      guardInvocations.push(wamid);
      await checkImebotCostGuard({
        phone: "556799999999",
        messageText: "oi",
        unit: COMMERCIAL_UNITS.CAMPO_GRANDE,
        checkLayers,
        checkAlertLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
        log: { warn: vi.fn() },
      });
    };

    await processOnce("wamid.dup");
    await processOnce("wamid.dup");

    expect(guardInvocations).toEqual(["wamid.dup"]);
    // checkImebotCostGuard roda abuso + orçamento pago para a ÚNICA chamada que passou pelo
    // dedup (2 chamadas a checkLayers) - se o evento duplicado tivesse escapado do dedup, o
    // total seria 4, não 2.
    expect(checkLayers).toHaveBeenCalledTimes(2);
  });

  it("aplica guarda somente para Campo Grande", () => {
    expect(isImebotCostGuardedUnit(COMMERCIAL_UNITS.CAMPO_GRANDE)).toBe(true);
    expect(isImebotCostGuardedUnit(COMMERCIAL_UNITS.DOURADOS)).toBe(false);
    expect(buildInboundAbuseLayers({ phone: "556799999999", unit: COMMERCIAL_UNITS.DOURADOS })).toEqual([]);
    expect(buildPaidActionBudgetLayers({ unit: COMMERCIAL_UNITS.DOURADOS })).toEqual([]);
  });

  it("separa camadas de abuso (A) e de orçamento pago (B) sem sobreposição de chaves", () => {
    const abuseLayers = buildInboundAbuseLayers({ phone: "556799999999", messageText: "oi", unit: COMMERCIAL_UNITS.CAMPO_GRANDE });
    const budgetLayers = buildPaidActionBudgetLayers({ unit: COMMERCIAL_UNITS.CAMPO_GRANDE });

    expect(abuseLayers.every((layer) => layer.key.startsWith("imebot:phone:"))).toBe(true);
    expect(budgetLayers.every((layer) => layer.key.startsWith("imebot:global:"))).toBe(true);
    const abuseKeys = new Set(abuseLayers.map((layer) => layer.key));
    expect(budgetLayers.some((layer) => abuseKeys.has(layer.key))).toBe(false);
  });

  it("checkInboundAbuseGuard nunca chama a camada de orçamento pago (checkLayers só recebe as 4 camadas de abuso)", async () => {
    const checkLayers = vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });

    await checkInboundAbuseGuard({
      phone: "556799999999",
      messageText: "oi",
      unit: COMMERCIAL_UNITS.CAMPO_GRANDE,
      checkLayers,
    });

    expect(checkLayers).toHaveBeenCalledTimes(1);
    const [layersArg] = checkLayers.mock.calls[0];
    expect(layersArg).toHaveLength(4);
    expect(layersArg.every((layer) => layer.key.startsWith("imebot:phone:"))).toBe(true);
  });

  it("reservePaidActionBudget não é chamada quando o abuse guard já bloqueou (checkImebotCostGuard)", async () => {
    const checkLayers = vi.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 8, key: "imebot:phone:min-interval:556799999999" });

    const result = await checkImebotCostGuard({
      phone: "556799999999",
      messageText: "oi",
      unit: COMMERCIAL_UNITS.CAMPO_GRANDE,
      checkLayers,
      checkAlertLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
      log: { warn: vi.fn() },
    });

    expect(result.allowed).toBe(false);
    expect(result.status).toBe("throttled");
    // checkLayers só deveria ter sido chamada UMA vez (para o abuse guard) - se a implementação
    // regredisse e chamasse a camada global mesmo bloqueado por abuso, haveria uma 2ª chamada.
    expect(checkLayers).toHaveBeenCalledTimes(1);
  });

  it("bloqueia spam rápido antes de qualquer chamada paga", async () => {
    // Ordem real das chamadas a checkLayers dentro de checkImebotCostGuard: mensagem 1 -> abuso
    // (permitido) -> orçamento pago (permitido); mensagem 2 -> abuso (bloqueado, min-interval) ->
    // NUNCA chega a checar orçamento pago (só 3 chamadas ao todo, não 4).
    const checkLayers = vi.fn()
      .mockResolvedValueOnce({ allowed: true, retryAfterSeconds: 0 }) // msg 1: abuso
      .mockResolvedValueOnce({ allowed: true, retryAfterSeconds: 0 }) // msg 1: orçamento pago
      .mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 8, key: "imebot:phone:min-interval:556799999999" }); // msg 2: abuso

    const first = await checkImebotCostGuard({
      phone: "556799999999",
      messageText: "oi",
      unit: COMMERCIAL_UNITS.CAMPO_GRANDE,
      checkLayers,
      checkAlertLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
      log: { warn: vi.fn() },
    });
    const second = await checkImebotCostGuard({
      phone: "556799999999",
      messageText: "oi",
      unit: COMMERCIAL_UNITS.CAMPO_GRANDE,
      checkLayers,
      checkAlertLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
      log: { warn: vi.fn() },
    });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
    expect(second.status).toBe("throttled");
    // 2 mensagens => 2 checagens de abuso; a 1ª também reservou orçamento pago (allowed), a 2ª
    // foi barrada no abuse guard e nunca chegou a checar orçamento => 3 chamadas no total, não 4.
    expect(checkLayers).toHaveBeenCalledTimes(3);
  });

  it("não bloqueia conversa em ritmo humano quando as camadas permitem", async () => {
    const checkLayers = vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });

    const result = await checkImebotCostGuard({
      phone: "556799999999",
      messageText: "quero orçamento de telha",
      unit: COMMERCIAL_UNITS.CAMPO_GRANDE,
      checkLayers,
      checkAlertLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
      log: { warn: vi.fn() },
    });

    expect(result).toEqual({ allowed: true, status: "normal", retryAfterSeconds: 0 });
  });

  it("libera novamente depois do bloqueio quando o rate limiter permite", async () => {
    const checkLayers = vi.fn()
      .mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 60, key: "imebot:phone:minute:556799999999" })
      .mockResolvedValueOnce({ allowed: true, retryAfterSeconds: 0 })
      .mockResolvedValueOnce({ allowed: true, retryAfterSeconds: 0 });

    const blocked = await checkImebotCostGuard({
      phone: "556799999999",
      messageText: "oi",
      unit: COMMERCIAL_UNITS.CAMPO_GRANDE,
      checkLayers,
      checkAlertLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
      log: { warn: vi.fn() },
    });
    const released = await checkImebotCostGuard({
      phone: "556799999999",
      messageText: "depois do cooldown",
      unit: COMMERCIAL_UNITS.CAMPO_GRANDE,
      checkLayers,
      log: { warn: vi.fn() },
    });

    expect(blocked.allowed).toBe(false);
    expect(released.allowed).toBe(true);
  });

  it("ativa circuit breaker global (status paused) quando o orçamento pago está esgotado", async () => {
    const log = { warn: vi.fn() };
    const result = await reservePaidActionBudget({
      unit: COMMERCIAL_UNITS.CAMPO_GRANDE,
      checkLayers: vi.fn().mockResolvedValue({
        allowed: false,
        retryAfterSeconds: 3600,
        key: "imebot:global:responses-hour",
      }),
      checkAlertLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
      log,
    });

    expect(result.allowed).toBe(false);
    expect(result.status).toBe("paused");
    expect(log.warn).toHaveBeenCalledWith("imebot_cost_guard_blocked", expect.objectContaining({ reason: "global_limit" }));
  });

  it("limita alertas repetidos para não criar novo flood de logs", async () => {
    const log = { warn: vi.fn() };
    const checkAlertLimit = vi.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 120 });

    const result = await checkInboundAbuseGuard({
      phone: "556799999999",
      messageText: "oi",
      unit: COMMERCIAL_UNITS.CAMPO_GRANDE,
      checkLayers: vi.fn().mockResolvedValue({
        allowed: false,
        retryAfterSeconds: 60,
        key: "imebot:phone:minute:556799999999",
      }),
      checkAlertLimit,
      log,
    });

    expect(result.allowed).toBe(false);
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("gera a mesma chave de repetição para mensagens repetidas concorrentes", () => {
    const first = buildInboundAbuseLayers({
      phone: "55 (67) 9999-9999",
      messageText: "Oi",
      unit: COMMERCIAL_UNITS.CAMPO_GRANDE,
    });
    const second = buildInboundAbuseLayers({
      phone: "556799999999",
      messageText: "oi",
      unit: COMMERCIAL_UNITS.CAMPO_GRANDE,
    });

    expect(first.map((layer) => layer.key)).toEqual(second.map((layer) => layer.key));
  });

  it("expõe snapshot operacional sem PII ou custo inventado", () => {
    const snapshot = getImebotProtectionSnapshot();
    expect(snapshot.mode).toBe("volume_quota");
    expect(snapshot.config.budgetGuardReady).toBe(true);
    expect(snapshot.config.costModelConfigured).toBe(false);
    expect(JSON.stringify(snapshot)).not.toContain("5567");
  });
});

// ============================================================================================
// Concorrência real: em vez de mockar checkLayers (que esconde o comportamento verdadeiro do
// Promise.all em Backend.js/rateLimiter.js), estes testes mockam só o nível mais baixo (`query`
// do Postgres) com um UPSERT atômico simulado e exercitam checkInboundAbuseGuard/
// reservePaidActionBudget/checkImebotCostGuard de verdade. É assim que o bug original (camadas
// de abuso e orçamento pago misturadas num único Promise.all, incrementando a quota global mesmo
// para mensagens bloqueadas) foi encontrado - testes com checkLayers mockado nunca o exercitariam.
// ============================================================================================
describe("proteção de custo do IMEbot - concorrência real (Postgres simulado)", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("quota de 10 respostas pagas com 100 chamadas concorrentes autoriza no máximo 10", async () => {
    await withFreshGuardModule(
      { IMEBOT_MAX_RESPONSES_PER_HOUR: "10", IMEBOT_MAX_RESPONSES_PER_DAY: "10000" },
      async ({ guard, units }) => {
        const attempts = Array.from({ length: 100 }, () =>
          guard.reservePaidActionBudget({ unit: units.CAMPO_GRANDE, log: { warn: vi.fn() } })
        );
        const results = await Promise.all(attempts);

        expect(results.filter((result) => result.allowed)).toHaveLength(10);
        expect(results.filter((result) => !result.allowed)).toHaveLength(90);
      }
    );
  });

  it("1000 mensagens bloqueadas pelo abuse guard não consomem quota paga global", async () => {
    await withFreshGuardModule(
      {
        IMEBOT_MAX_RESPONSES_PER_HOUR: "10",
        IMEBOT_MAX_RESPONSES_PER_DAY: "10000",
        IMEBOT_MAX_MESSAGES_PER_MINUTE: "1",
      },
      async ({ guard, units }) => {
        const attempts = Array.from({ length: 1000 }, () =>
          guard.checkImebotCostGuard({
            phone: "556799999999",
            messageText: "spam",
            unit: units.CAMPO_GRANDE,
            log: { warn: vi.fn() },
          })
        );
        const results = await Promise.all(attempts);

        expect(results.filter((result) => result.allowed).length).toBeLessThanOrEqual(1);

        // Prova direta de que a inundação não drenou a quota global compartilhada: se as 1000
        // mensagens barradas por abuso tivessem incrementado imebot:global:responses-hour, essa
        // checagem adicional (quota máxima 10) já estaria esgotada.
        const probe = await guard.reservePaidActionBudget({ unit: units.CAMPO_GRANDE, log: { warn: vi.fn() } });
        expect(probe.allowed).toBe(true);
      }
    );
  });

  it("telefone abusivo bloqueado não impede telefone legítimo distinto de continuar", async () => {
    await withFreshGuardModule(
      {
        IMEBOT_MAX_MESSAGES_PER_MINUTE: "1",
        IMEBOT_MAX_RESPONSES_PER_HOUR: "80",
        IMEBOT_MAX_RESPONSES_PER_DAY: "500",
      },
      async ({ guard, units }) => {
        const unit = units.CAMPO_GRANDE;
        await guard.checkInboundAbuseGuard({ phone: "556711111111", messageText: "spam", unit, log: { warn: vi.fn() } });
        const abusiveBlocked = await guard.checkInboundAbuseGuard({ phone: "556711111111", messageText: "spam", unit, log: { warn: vi.fn() } });
        const legitOk = await guard.checkInboundAbuseGuard({ phone: "556722222222", messageText: "quero orçamento", unit, log: { warn: vi.fn() } });

        expect(abusiveBlocked.allowed).toBe(false);
        expect(legitOk.allowed).toBe(true);
      }
    );
  });

  it("circuit breaker global só bloqueia depois de esgotar a quota real, nunca antes", async () => {
    await withFreshGuardModule(
      { IMEBOT_MAX_RESPONSES_PER_HOUR: "3", IMEBOT_MAX_RESPONSES_PER_DAY: "3" },
      async ({ guard, units }) => {
        const unit = units.CAMPO_GRANDE;
        const results = [];
        for (let index = 0; index < 5; index += 1) {
          results.push(await guard.reservePaidActionBudget({ unit, log: { warn: vi.fn() } }));
        }

        expect(results.slice(0, 3).every((result) => result.allowed)).toBe(true);
        expect(results.slice(3).every((result) => !result.allowed && result.status === "paused")).toBe(true);
      }
    );
  });
});
