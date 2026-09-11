import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// GET /r/[token] - hardening (rate limit, limite de tamanho de token, Cache-Control: no-store) +
// correção do bug de params assíncrono.
//
// context.params é uma Promise nos Route Handlers desde o Next.js 15 (confirmado contra
// nextjs.org/docs/app/api-reference/file-conventions/route) - este projeto está no Next.js 16.
// O código antigo lia params?.token de forma síncrona, o que sempre resolvia undefined em
// produção real (params É a Promise, não o objeto resolvido) - TODO clique num link de handoff
// real caía em "Link inválido.", para qualquer token, mesmo válido. Os testes ANTIGOS passavam
// { params: { token } } (objeto síncrono), então nunca pegaram esse bug - por isso agora todo
// teste aqui passa params como Promise de verdade (Promise.resolve({...})), reproduzindo
// exatamente o que o runtime real entrega.
const originalEnv = { ...process.env };

const fakeRequest = (headers = {}) => ({ headers: { get: (name) => headers[name.toLowerCase()] ?? null } });
const withParams = (token) => ({ params: Promise.resolve(token === undefined ? {} : { token }) });

describe("GET /r/[token] - hardening + params assíncrono", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.doUnmock("../Backend.js/handoffStore");
    vi.doUnmock("../Backend.js/rateLimiter");
  });

  // 1) params como Promise - caso base de todo teste desta suíte (withParams envolve em
  // Promise.resolve, nunca passa um objeto síncrono) - já comprova que o handler extrai o token
  // corretamente com `const { token } = await params`.

  // 2) token ausente -> 400
  it("token ausente (params resolve sem a chave token) continua respondendo 400", async () => {
    const consumeHandoffToken = vi.fn();
    vi.doMock("../Backend.js/handoffStore", () => ({ consumeHandoffToken }));
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkGlobalApiRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      checkRateLimitLayers: vi.fn().mockResolvedValue({ allowed: true }),
    }));
    const { GET } = await import("../app/r/[token]/route");

    const response = await GET(fakeRequest(), withParams(undefined));

    expect(response.status).toBe(400);
    expect(consumeHandoffToken).not.toHaveBeenCalled();
  });

  // 3) token maior que o limite -> 400 sem consultar banco
  it("token absurdamente longo é rejeitado com 400 ANTES de consultar o banco ou o rate limiter", async () => {
    const consumeHandoffToken = vi.fn();
    const checkGlobalApiRateLimit = vi.fn();
    const checkRateLimitLayers = vi.fn();
    vi.doMock("../Backend.js/handoffStore", () => ({ consumeHandoffToken }));
    vi.doMock("../Backend.js/rateLimiter", () => ({ checkGlobalApiRateLimit, checkRateLimitLayers }));
    const { GET } = await import("../app/r/[token]/route");

    const response = await GET(fakeRequest(), withParams("x".repeat(5000)));

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

    const response = await GET(fakeRequest(), withParams(token));

    expect(response.status).toBe(302);
    expect(consumeHandoffToken).toHaveBeenCalledWith(token);
  });

  // 4) token inexistente normal -> chega em consumeHandoffToken e retorna 404 (não confundir
  // com "token ausente", caso 2 acima - aqui o token TEM o tamanho/formato certo, só não existe
  // no banco. handoffStore.js#consumeHandoffToken devolve exatamente {ok:false, status:404,
  // reason:"Link não encontrado."} para esse caso - ver Backend.js/handoffStore.js).
  it("token bem formado mas inexistente no banco chega em consumeHandoffToken e responde 404", async () => {
    const consumeHandoffToken = vi.fn().mockResolvedValue({ ok: false, status: 404, reason: "Link não encontrado." });
    vi.doMock("../Backend.js/handoffStore", () => ({ consumeHandoffToken }));
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkGlobalApiRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      checkRateLimitLayers: vi.fn().mockResolvedValue({ allowed: true }),
    }));
    const { GET } = await import("../app/r/[token]/route");

    const token = "token-bem-formado-mas-nunca-emitido";
    const response = await GET(fakeRequest(), withParams(token));

    expect(consumeHandoffToken).toHaveBeenCalledWith(token);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Link não encontrado.");
  });

  // 5) token válido -> redirect 302 (+ 6: Cache-Control: no-store no redirect)
  it("uso normal: token válido + rate limit dentro do limite -> redireciona para o WhatsApp (fluxo preservado)", async () => {
    vi.doMock("../Backend.js/handoffStore", () => ({
      consumeHandoffToken: vi.fn().mockResolvedValue({ ok: true, redirectUrl: "https://wa.me/556799998888" }),
    }));
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkGlobalApiRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      checkRateLimitLayers: vi.fn().mockResolvedValue({ allowed: true }),
    }));
    const { GET } = await import("../app/r/[token]/route");

    const response = await GET(fakeRequest(), withParams("token-valido-de-teste"));

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://wa.me/556799998888");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  // 7) rate limit normal permite acesso - já coberto pelo teste "uso normal" acima (camadas
  // global e específica mockadas como allowed: true).

  // 8) excesso -> 429 + Retry-After (camada global)
  it("excesso na camada global -> 429 com Retry-After, sem consultar o banco", async () => {
    const consumeHandoffToken = vi.fn();
    vi.doMock("../Backend.js/handoffStore", () => ({ consumeHandoffToken }));
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkGlobalApiRateLimit: vi.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 9 }),
      checkRateLimitLayers: vi.fn(),
    }));
    const { GET } = await import("../app/r/[token]/route");

    const response = await GET(fakeRequest(), withParams("qualquer-token"));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("9");
    expect(consumeHandoffToken).not.toHaveBeenCalled();
  });

  // 8) excesso -> 429 + Retry-After (camada específica burst/minuto)
  it("excesso na camada específica (burst/minuto) -> 429 com Retry-After, sem consultar o banco", async () => {
    const consumeHandoffToken = vi.fn();
    vi.doMock("../Backend.js/handoffStore", () => ({ consumeHandoffToken }));
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkGlobalApiRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      checkRateLimitLayers: vi.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 3 }),
    }));
    const { GET } = await import("../app/r/[token]/route");

    const response = await GET(fakeRequest(), withParams("qualquer-token"));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("3");
    expect(consumeHandoffToken).not.toHaveBeenCalled();
  });

  // 9) falha do rate limiter -> 503 (fail closed)
  it("falha do rate limiter (Postgres indisponível) NUNCA libera a rota - 503, fail closed", async () => {
    const consumeHandoffToken = vi.fn();
    vi.doMock("../Backend.js/handoffStore", () => ({ consumeHandoffToken }));
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkGlobalApiRateLimit: vi.fn().mockRejectedValue(new Error("connection refused")),
      checkRateLimitLayers: vi.fn(),
    }));
    const { GET } = await import("../app/r/[token]/route");

    const response = await GET(fakeRequest(), withParams("qualquer-token"));

    expect(response.status).toBe(503);
    expect(consumeHandoffToken).not.toHaveBeenCalled();
  });

  it("token expirado continua respondendo com o status/motivo original do handoffStore (410)", async () => {
    vi.doMock("../Backend.js/handoffStore", () => ({
      consumeHandoffToken: vi.fn().mockResolvedValue({ ok: false, status: 410, reason: "Link expirado." }),
    }));
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkGlobalApiRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      checkRateLimitLayers: vi.fn().mockResolvedValue({ allowed: true }),
    }));
    const { GET } = await import("../app/r/[token]/route");

    const response = await GET(fakeRequest(), withParams("token-expirado"));

    expect(response.status).toBe(410);
    expect(await response.text()).toBe("Link expirado.");
  });
});
