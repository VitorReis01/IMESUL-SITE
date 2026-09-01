import { afterEach, describe, expect, it, vi } from "vitest";
import { getRequestId } from "../Backend.js/requestGuards";
import { logger } from "../Backend.js/logger";
import { checkGlobalApiRateLimit } from "../Backend.js/rateLimiter";

const fakeRequest = (headers = {}) => ({
  headers: { get: (name) => headers[name.toLowerCase()] ?? null },
});

describe("getRequestId - correlação de request (Backend.js/requestGuards.js)", () => {
  it("usa x-vercel-id quando presente", () => {
    const id = getRequestId(fakeRequest({ "x-vercel-id": "vercel-abc123" }));
    expect(id).toBe("vercel-abc123");
  });

  it("gera um UUID quando x-vercel-id está ausente (dev local)", () => {
    const id = getRequestId(fakeRequest({}));
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("gera IDs diferentes em chamadas sucessivas sem header", () => {
    const first = getRequestId(fakeRequest({}));
    const second = getRequestId(fakeRequest({}));
    expect(first).not.toBe(second);
  });
});

describe("logger - categorias SECURITY/CIRCUIT_BREAKER (Backend.js/logger.js)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logger.security marca category:SECURITY e usa console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logger.security("test_security_event", { detail: "x" });

    expect(spy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(spy.mock.calls[0][0]);
    expect(payload.category).toBe("SECURITY");
    expect(payload.event).toBe("test_security_event");
    expect(payload.level).toBe("warn");
  });

  it("logger.circuitBreaker marca category:CIRCUIT_BREAKER e usa console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logger.circuitBreaker("test_cb_event", { unit: "campo-grande" });

    expect(spy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(spy.mock.calls[0][0]);
    expect(payload.category).toBe("CIRCUIT_BREAKER");
  });

  it("nenhum log inclui campos sensíveis mesmo se passados por engano", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logger.security("test_event", { password: "senha-real", token: "abc", cookie: "session=x" });

    const payload = JSON.parse(spy.mock.calls[0][0]);
    expect(JSON.stringify(payload)).not.toContain("senha-real");
  });
});

describe("rate_limit_triggered - log ao bloquear na camada global (Backend.js/rateLimiter.js)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("loga category:SECURITY quando a camada global bloqueia, e não loga quando permite", async () => {
    const store = new Map();
    const db = {
      query: vi.fn(async (text, params) => {
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
      }),
    };

    vi.resetModules();
    vi.doMock("../Backend.js/db", () => db);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { checkGlobalApiRateLimit: freshCheck } = await import("../Backend.js/rateLimiter");

    const request = fakeRequest({});
    // Limite da camada global e 10 em 10s (Backend.js/rateLimiter.js) - as primeiras 10
    // permitem, sem log; a 11a bloqueia e loga.
    for (let index = 0; index < 10; index += 1) {
      await freshCheck(request);
    }
    expect(warnSpy).not.toHaveBeenCalled();

    const blocked = await freshCheck(request);
    expect(blocked.allowed).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(warnSpy.mock.calls[0][0]);
    expect(payload.event).toBe("rate_limit_triggered");
    expect(payload.category).toBe("SECURITY");

    vi.doUnmock("../Backend.js/db");
  });
});

// checkGlobalApiRateLimit segue exportado e chamável sem quebrar (import no topo do arquivo,
// fora do mock acima) - regressão simples de que a assinatura não mudou para quem já usa.
describe("checkGlobalApiRateLimit - assinatura preservada", () => {
  it("continua sendo uma função que aceita (request)", () => {
    expect(typeof checkGlobalApiRateLimit).toBe("function");
  });
});
