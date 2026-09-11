import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// GET /api/health/database ganhou rate limit nesta rodada de hardening: mesmo autenticada por
// x-monitoring-key (ver Backend.js/monitoringAuth.js), a rota toca o Postgres a cada chamada -
// um segredo vazado ou um monitor mal configurado não pode floodar o banco.
const originalEnv = { ...process.env };

const fakeRequest = (key) => ({
  headers: { get: (name) => (name.toLowerCase() === "x-monitoring-key" ? key : null) },
});

describe("GET /api/health/database - rate limit (hardening)", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.MONITORING_HEALTH_SECRET = "segredo-monitoring-de-teste";
  });
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.doUnmock("../Backend.js/db");
    vi.doUnmock("../Backend.js/rateLimiter");
  });

  it("uso normal: secret correto + rate limit dentro do limite -> 200", async () => {
    vi.doMock("../Backend.js/db", () => ({ query: vi.fn().mockResolvedValue({ rows: [{}] }) }));
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkRateLimitLayers: vi.fn().mockResolvedValue({ allowed: true }),
    }));
    const { GET } = await import("../app/api/health/database/route");

    const response = await GET(fakeRequest("segredo-monitoring-de-teste"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ status: "ok", database: "ok" });
  });

  it("continua exigindo o monitoring secret ANTES do rate limit - 401 sem consumir cota", async () => {
    const checkRateLimitLayers = vi.fn();
    vi.doMock("../Backend.js/db", () => ({ query: vi.fn() }));
    vi.doMock("../Backend.js/rateLimiter", () => ({ checkRateLimitLayers }));
    const { GET } = await import("../app/api/health/database/route");

    const response = await GET(fakeRequest("secret-errado"));

    expect(response.status).toBe(401);
    expect(checkRateLimitLayers).not.toHaveBeenCalled();
  });

  it("excesso (mais de 30/min do mesmo IP) -> 429 com Retry-After, sem consultar o banco", async () => {
    const query = vi.fn();
    vi.doMock("../Backend.js/db", () => ({ query }));
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkRateLimitLayers: vi.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 20 }),
    }));
    const { GET } = await import("../app/api/health/database/route");

    const response = await GET(fakeRequest("segredo-monitoring-de-teste"));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("20");
    expect(query).not.toHaveBeenCalled();
  });

  it("falha do rate limiter (Postgres indisponível) NUNCA libera a checagem - 503, fail closed", async () => {
    const query = vi.fn();
    vi.doMock("../Backend.js/db", () => ({ query }));
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkRateLimitLayers: vi.fn().mockRejectedValue(new Error("connection refused")),
    }));
    const { GET } = await import("../app/api/health/database/route");

    const response = await GET(fakeRequest("segredo-monitoring-de-teste"));

    expect(response.status).toBe(503);
    expect(query).not.toHaveBeenCalled();
  });

  it("nunca retorna detalhe de conexão/hostname/query/erro interno no corpo", async () => {
    vi.doMock("../Backend.js/db", () => ({ query: vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:5432")) }));
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkRateLimitLayers: vi.fn().mockResolvedValue({ allowed: true }),
    }));
    const { GET } = await import("../app/api/health/database/route");

    const response = await GET(fakeRequest("segredo-monitoring-de-teste"));
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(JSON.stringify(data)).not.toContain("10.0.0.5");
    expect(JSON.stringify(data)).not.toContain("ECONNREFUSED");
    expect(data).toEqual({ status: "degraded", database: "unavailable" });
  });
});
