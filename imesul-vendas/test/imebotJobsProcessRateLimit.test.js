import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// POST /api/imebot/jobs/process ganhou rate limit nesta rodada de hardening: mesmo com o Bearer
// (IMEBOT_CRON_SECRET) correto, uma credencial vazada não deve conseguir disparar o processamento
// de jobs em loop. Mesmo padrão de teste de test/imebotJobsProcessMethods.test.js (vi.doMock +
// import dinâmico) + test/consentSyncRoutes.test.js (mock do rateLimiter).
const originalEnv = { ...process.env };

const authorizedRequest = () => ({
  headers: { get: (name) => (name.toLowerCase() === "authorization" ? "Bearer segredo-cron-de-teste" : null) },
});

describe("POST /api/imebot/jobs/process - rate limit (hardening)", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.IMEBOT_ENABLED = "true";
    process.env.IMEBOT_CRON_SECRET = "segredo-cron-de-teste";
  });
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.doUnmock("../Backend.js/feedbackStore");
    vi.doUnmock("../Backend.js/rateLimiter");
  });

  it("uso normal: Bearer correto + rate limit dentro do limite -> processa normalmente", async () => {
    const processDueFeedbackJobs = vi.fn().mockResolvedValue({ ok: true, processed: 2 });
    vi.doMock("../Backend.js/feedbackStore", () => ({ processDueFeedbackJobs }));
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkRateLimitLayers: vi.fn().mockResolvedValue({ allowed: true }),
    }));
    const { POST } = await import("../app/api/imebot/jobs/process/route");

    const response = await POST(authorizedRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true, processed: 2 });
    expect(processDueFeedbackJobs).toHaveBeenCalledTimes(1);
  });

  it("excesso (mais de 5/min do mesmo IP) -> 429 com Retry-After, sem processar", async () => {
    const processDueFeedbackJobs = vi.fn().mockResolvedValue({ ok: true, processed: 0 });
    vi.doMock("../Backend.js/feedbackStore", () => ({ processDueFeedbackJobs }));
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkRateLimitLayers: vi.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 11 }),
    }));
    const { POST } = await import("../app/api/imebot/jobs/process/route");

    const response = await POST(authorizedRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("11");
    expect(processDueFeedbackJobs).not.toHaveBeenCalled();
  });

  it("falha do rate limiter (Postgres indisponível) NUNCA libera o processamento - 503, fail closed", async () => {
    const processDueFeedbackJobs = vi.fn().mockResolvedValue({ ok: true, processed: 0 });
    vi.doMock("../Backend.js/feedbackStore", () => ({ processDueFeedbackJobs }));
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkRateLimitLayers: vi.fn().mockRejectedValue(new Error("connection refused")),
    }));
    const { POST } = await import("../app/api/imebot/jobs/process/route");

    const response = await POST(authorizedRequest());

    expect(response.status).toBe(503);
    expect(processDueFeedbackJobs).not.toHaveBeenCalled();
  });

  it("Bearer errado continua retornando 401 antes de consumir cota de rate limit", async () => {
    const processDueFeedbackJobs = vi.fn();
    vi.doMock("../Backend.js/feedbackStore", () => ({ processDueFeedbackJobs }));
    const checkRateLimitLayers = vi.fn().mockResolvedValue({ allowed: true });
    vi.doMock("../Backend.js/rateLimiter", () => ({ checkRateLimitLayers }));
    const { POST } = await import("../app/api/imebot/jobs/process/route");

    const request = { headers: { get: (name) => (name.toLowerCase() === "authorization" ? "Bearer errado" : null) } };
    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(checkRateLimitLayers).not.toHaveBeenCalled();
    expect(processDueFeedbackJobs).not.toHaveBeenCalled();
  });

  it("GET continua recusado com 405, mesmo com Bearer correto (não reativado nesta rodada)", async () => {
    vi.doMock("../Backend.js/feedbackStore", () => ({ processDueFeedbackJobs: vi.fn() }));
    vi.doMock("../Backend.js/rateLimiter", () => ({ checkRateLimitLayers: vi.fn().mockResolvedValue({ allowed: true }) }));
    const { GET } = await import("../app/api/imebot/jobs/process/route");

    const response = await GET(authorizedRequest());
    expect(response.status).toBe(405);
  });
});
