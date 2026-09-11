import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// GET /api/admin/monitoring/status ganhou rate limit nesta rodada de hardening (rota consulta
// banco + faz 2 fetches HTTP + lê estado global do IMEbot a cada chamada - uma sessão admin
// comprometida não pode floodar isso). Mesmo padrão de teste já usado em
// test/consentSyncRoutes.test.js: mocka Backend.js/rateLimiter via vi.doMock e importa a rota
// dinamicamente depois. As demais dependências (db, imebotAbuseGuard, imebotFeatureGate,
// monitoringAuth) são mockadas com o mínimo necessário para isolar só o comportamento novo.
const originalEnv = { ...process.env };

const fakeRequest = ({ origin = null } = {}) => ({
  url: "https://vendas.exemplo.com/api/admin/monitoring/status",
  headers: { get: (name) => (name.toLowerCase() === "origin" ? origin : null) },
});

const doMockCommonDeps = () => {
  vi.doMock("../Backend.js/adminSecurity", () => ({ isAdminRequest: vi.fn().mockResolvedValue(true) }));
  vi.doMock("../Backend.js/db", () => ({ query: vi.fn().mockResolvedValue({ rows: [{}] }) }));
  vi.doMock("../Backend.js/imebotAbuseGuard", () => ({
    getImebotGlobalQuotaState: vi.fn().mockResolvedValue({ status: "ok" }),
    getImebotProtectionSnapshot: vi.fn().mockReturnValue({}),
  }));
  vi.doMock("../Backend.js/imebotFeatureGate", () => ({ isImebotEnabled: vi.fn().mockReturnValue(false) }));
  vi.doMock("../Backend.js/monitoringAuth", () => ({ isMonitoringEnabled: vi.fn().mockReturnValue(false) }));
};

describe("GET /api/admin/monitoring/status - rate limit (hardening)", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NODE_ENV = "test";
  });
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.doUnmock("../Backend.js/adminSecurity");
    vi.doUnmock("../Backend.js/db");
    vi.doUnmock("../Backend.js/imebotAbuseGuard");
    vi.doUnmock("../Backend.js/imebotFeatureGate");
    vi.doUnmock("../Backend.js/monitoringAuth");
    vi.doUnmock("../Backend.js/rateLimiter");
  });

  it("uso normal: sessão admin válida + rate limit dentro do limite -> 200", async () => {
    doMockCommonDeps();
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkGlobalApiRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      checkRateLimitLayers: vi.fn().mockResolvedValue({ allowed: true }),
    }));
    const { GET } = await import("../app/api/admin/monitoring/status/route");

    const response = await GET(fakeRequest());
    expect(response.status).toBe(200);
  });

  it("excesso na camada global -> 429 com Retry-After, sem chamar a camada específica", async () => {
    doMockCommonDeps();
    const checkRateLimitLayers = vi.fn();
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkGlobalApiRateLimit: vi.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 7 }),
      checkRateLimitLayers,
    }));
    const { GET } = await import("../app/api/admin/monitoring/status/route");

    const response = await GET(fakeRequest());
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("7");
    expect(checkRateLimitLayers).not.toHaveBeenCalled();
  });

  it("excesso na camada específica da rota -> 429 com Retry-After", async () => {
    doMockCommonDeps();
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkGlobalApiRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      checkRateLimitLayers: vi.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 42 }),
    }));
    const { GET } = await import("../app/api/admin/monitoring/status/route");

    const response = await GET(fakeRequest());
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
  });

  it("falha do rate limiter (Postgres indisponível) NUNCA libera a rota - 503, fail closed", async () => {
    doMockCommonDeps();
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkGlobalApiRateLimit: vi.fn().mockRejectedValue(new Error("connection refused")),
      checkRateLimitLayers: vi.fn(),
    }));
    const { GET } = await import("../app/api/admin/monitoring/status/route");

    const response = await GET(fakeRequest());
    expect(response.status).toBe(503);
  });

  it("continua exigindo sessão admin mesmo com rate limit permitindo - 401 sem sessão", async () => {
    vi.doMock("../Backend.js/adminSecurity", () => ({ isAdminRequest: vi.fn().mockResolvedValue(false) }));
    vi.doMock("../Backend.js/db", () => ({ query: vi.fn().mockResolvedValue({ rows: [{}] }) }));
    vi.doMock("../Backend.js/imebotAbuseGuard", () => ({
      getImebotGlobalQuotaState: vi.fn().mockResolvedValue({ status: "ok" }),
      getImebotProtectionSnapshot: vi.fn().mockReturnValue({}),
    }));
    vi.doMock("../Backend.js/imebotFeatureGate", () => ({ isImebotEnabled: vi.fn().mockReturnValue(false) }));
    vi.doMock("../Backend.js/monitoringAuth", () => ({ isMonitoringEnabled: vi.fn().mockReturnValue(false) }));
    const checkGlobalApiRateLimit = vi.fn().mockResolvedValue({ allowed: true });
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkGlobalApiRateLimit,
      checkRateLimitLayers: vi.fn().mockResolvedValue({ allowed: true }),
    }));
    const { GET } = await import("../app/api/admin/monitoring/status/route");

    const response = await GET(fakeRequest());
    expect(response.status).toBe(401);
    // Auth continua sendo checado ANTES do rate limit - sem sessão válida, nem chega a consumir
    // cota de rate limit.
    expect(checkGlobalApiRateLimit).not.toHaveBeenCalled();
  });

  it("resposta continua sempre Cache-Control: no-store", async () => {
    doMockCommonDeps();
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkGlobalApiRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      checkRateLimitLayers: vi.fn().mockResolvedValue({ allowed: true }),
    }));
    const { GET } = await import("../app/api/admin/monitoring/status/route");

    const response = await GET(fakeRequest());
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
