import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// GET /r/[token] ganhou 3 proteções nesta rodada de hardening (rota pública que consulta e
// escreve no banco - ver Backend.js/handoffStore.js#consumeHandoffToken - e redireciona para o
// WhatsApp de um vendedor real):
//   1) limite de tamanho do token ANTES de tocar o banco (token legítimo tem 43 caracteres)
//   2) rate limit distribuído (global + burst/minuto específico da rota), fail closed
//   3) Cache-Control: no-store em toda resposta, incluindo o redirect
// O fluxo legítimo (token válido, dentro do limite) precisa continuar redirecionando exatamente
// como antes.
const originalEnv = { ...process.env };

const fakeRequest = (headers = {}) => ({ headers: { get: (name) => headers[name.toLowerCase()] ?? null } });

describe("GET /r/[token] - hardening", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.doUnmock("../Backend.js/handoffStore");
    vi.doUnmock("../Backend.js/rateLimiter");
  });

  it("token absurdamente longo é rejeitado com 400 ANTES de consultar o banco ou o rate limiter", async () => {
    const consumeHandoffToken = vi.fn();
    const checkGlobalApiRateLimit = vi.fn();
    const checkRateLimitLayers = vi.fn();
    vi.doMock("../Backend.js/handoffStore", () => ({ consumeHandoffToken }));
    vi.doMock("../Backend.js/rateLimiter", () => ({ checkGlobalApiRateLimit, checkRateLimitLayers }));
    const { GET } = await import("../app/r/[token]/route");

    const response = await GET(fakeRequest(), { params: { token: "x".repeat(5000) } });

    expect(response.status).toBe(400);
    expect(consumeHandoffToken).not.toHaveBeenCalled();
    expect(checkGlobalApiRateLimit).not.toHaveBeenCalled();
    expect(checkRateLimitLayers).not.toHaveBeenCalled();
  });

  it("token do tamanho real (43 chars, randomBytes(32).toString base64url) nunca é rejeitado pelo limite de tamanho", async () => {
    const token = "a".repeat(43);
    const consumeHandoffToken = vi.fn().mockResolvedValue({ ok: true, redirectUrl: "https://wa.me/5511999999999" });
    vi.doMock("../Backend.js/handoffStore", () => ({ consumeHandoffToken }));
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkGlobalApiRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      checkRateLimitLayers: vi.fn().mockResolvedValue({ allowed: true }),
    }));
    const { GET } = await import("../app/r/[token]/route");

    const response = await GET(fakeRequest(), { params: { token } });

    expect(response.status).toBe(302);
    expect(consumeHandoffToken).toHaveBeenCalledWith(token);
  });

  it("uso normal: token válido + rate limit dentro do limite -> redireciona para o WhatsApp (fluxo preservado)", async () => {
    vi.doMock("../Backend.js/handoffStore", () => ({
      consumeHandoffToken: vi.fn().mockResolvedValue({ ok: true, redirectUrl: "https://wa.me/556799998888" }),
    }));
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkGlobalApiRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      checkRateLimitLayers: vi.fn().mockResolvedValue({ allowed: true }),
    }));
    const { GET } = await import("../app/r/[token]/route");

    const response = await GET(fakeRequest(), { params: { token: "token-valido-de-teste" } });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://wa.me/556799998888");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("excesso na camada global -> 429 com Retry-After, sem consultar o banco", async () => {
    const consumeHandoffToken = vi.fn();
    vi.doMock("../Backend.js/handoffStore", () => ({ consumeHandoffToken }));
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkGlobalApiRateLimit: vi.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 9 }),
      checkRateLimitLayers: vi.fn(),
    }));
    const { GET } = await import("../app/r/[token]/route");

    const response = await GET(fakeRequest(), { params: { token: "qualquer-token" } });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("9");
    expect(consumeHandoffToken).not.toHaveBeenCalled();
  });

  it("excesso na camada específica (burst/minuto) -> 429 com Retry-After, sem consultar o banco", async () => {
    const consumeHandoffToken = vi.fn();
    vi.doMock("../Backend.js/handoffStore", () => ({ consumeHandoffToken }));
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkGlobalApiRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      checkRateLimitLayers: vi.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 3 }),
    }));
    const { GET } = await import("../app/r/[token]/route");

    const response = await GET(fakeRequest(), { params: { token: "qualquer-token" } });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("3");
    expect(consumeHandoffToken).not.toHaveBeenCalled();
  });

  it("falha do rate limiter (Postgres indisponível) NUNCA libera a rota - 503, fail closed", async () => {
    const consumeHandoffToken = vi.fn();
    vi.doMock("../Backend.js/handoffStore", () => ({ consumeHandoffToken }));
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkGlobalApiRateLimit: vi.fn().mockRejectedValue(new Error("connection refused")),
      checkRateLimitLayers: vi.fn(),
    }));
    const { GET } = await import("../app/r/[token]/route");

    const response = await GET(fakeRequest(), { params: { token: "qualquer-token" } });

    expect(response.status).toBe(503);
    expect(consumeHandoffToken).not.toHaveBeenCalled();
  });

  it("token expirado/indisponível continua respondendo com o status/motivo original do handoffStore", async () => {
    vi.doMock("../Backend.js/handoffStore", () => ({
      consumeHandoffToken: vi.fn().mockResolvedValue({ ok: false, status: 410, reason: "Link expirado." }),
    }));
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkGlobalApiRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      checkRateLimitLayers: vi.fn().mockResolvedValue({ allowed: true }),
    }));
    const { GET } = await import("../app/r/[token]/route");

    const response = await GET(fakeRequest(), { params: { token: "token-expirado" } });

    expect(response.status).toBe(410);
    expect(await response.text()).toBe("Link expirado.");
  });

  it("token ausente continua respondendo 400 (comportamento preservado)", async () => {
    vi.doMock("../Backend.js/handoffStore", () => ({ consumeHandoffToken: vi.fn() }));
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkGlobalApiRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      checkRateLimitLayers: vi.fn().mockResolvedValue({ allowed: true }),
    }));
    const { GET } = await import("../app/r/[token]/route");

    const response = await GET(fakeRequest(), { params: {} });
    expect(response.status).toBe(400);
  });
});
