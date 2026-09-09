import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mesma estrategia de request minima usada em test/requestGuardsBodyLimit.test.js - controla
// Content-Length e os bytes reais do stream de forma independente.
const makeRequest = ({ contentLength, chunks = [], headers = {} } = {}) => {
  let index = 0;
  return {
    headers: {
      get: (name) => {
        const lower = name.toLowerCase();
        if (lower === "content-length") return contentLength ?? null;
        return headers[lower] ?? null;
      },
    },
    body: {
      getReader: () => ({
        read: async () => {
          if (index < chunks.length) {
            const value = chunks[index];
            index += 1;
            return { done: false, value };
          }
          return { done: true, value: undefined };
        },
        cancel: async () => {},
      }),
    },
  };
};

const bytes = (text) => new TextEncoder().encode(text);
const jsonRequest = (obj) => {
  const raw = JSON.stringify(obj);
  return makeRequest({ contentLength: String(bytes(raw).length), chunks: [bytes(raw)] });
};

const originalEnv = { ...process.env };

describe("POST /api/consent-sync/issue - imesul-vendas", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.CONSENT_SYNC_SECRET = "segredo-de-teste-consent-sync";
  });
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.doUnmock("../Backend.js/rateLimiter");
  });

  it("emite um token quando o rate limit permite e o corpo é válido", async () => {
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkGlobalApiRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      checkRateLimitLayers: vi.fn().mockResolvedValue({ allowed: true }),
    }));
    const { POST } = await import("../app/api/consent-sync/issue/route");

    const response = await POST(jsonRequest({ analytics: true, location: false }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(typeof data.token).toBe("string");
  });

  it("bloqueia com 429 quando a camada específica de rate limit da rota nega", async () => {
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkGlobalApiRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      checkRateLimitLayers: vi.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 30 }),
    }));
    const { POST } = await import("../app/api/consent-sync/issue/route");

    const response = await POST(jsonRequest({ analytics: true, location: false }));

    expect(response.status).toBe(429);
  });

  it("rejeita corpo acima do limite (2000 bytes) mesmo sem Content-Length (simulação de chunked)", async () => {
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkGlobalApiRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      checkRateLimitLayers: vi.fn().mockResolvedValue({ allowed: true }),
    }));
    const { POST } = await import("../app/api/consent-sync/issue/route");

    const request = makeRequest({ contentLength: null, chunks: [bytes("x".repeat(5_000))] });
    const response = await POST(request);

    expect(response.status).toBe(413);
  });

  it("nunca muda o contrato do token válido: mesmo shape {ok, token} de antes da remediação", async () => {
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkGlobalApiRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      checkRateLimitLayers: vi.fn().mockResolvedValue({ allowed: true }),
    }));
    const { POST } = await import("../app/api/consent-sync/issue/route");

    const response = await POST(jsonRequest({ analytics: false, location: true }));
    const data = await response.json();

    expect(Object.keys(data).sort()).toEqual(["ok", "token"]);
    expect(data.token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });
});

describe("POST /api/consent-sync/import - imesul-vendas", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.CONSENT_SYNC_SECRET = "segredo-de-teste-consent-sync";
  });
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.doUnmock("../Backend.js/rateLimiter");
  });

  const withMockedRateLimiter = async ({ allowed = true, retryAfterSeconds = 0 } = {}) => {
    vi.doMock("../Backend.js/rateLimiter", () => ({
      checkGlobalApiRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      checkRateLimitLayers: vi.fn().mockResolvedValue({ allowed, retryAfterSeconds }),
    }));
    const issueModule = await import("../app/api/consent-sync/issue/route");
    const importModule = await import("../app/api/consent-sync/import/route");
    return { issuePOST: issueModule.POST, importPOST: importModule.POST };
  };

  it("importa de volta um token válido emitido por /issue, preservando o HMAC", async () => {
    const { issuePOST, importPOST } = await withMockedRateLimiter();

    const issueResponse = await issuePOST(jsonRequest({ analytics: true, location: true }));
    const { token } = await issueResponse.json();

    const importResponse = await importPOST(jsonRequest({ token }));
    const importData = await importResponse.json();

    expect(importResponse.status).toBe(200);
    expect(importData).toEqual({ ok: true, consent: { analytics: true, location: true } });
  });

  it("rejeita corpo acima do limite mesmo sem Content-Length (simulação de chunked)", async () => {
    const { importPOST } = await withMockedRateLimiter();

    const request = makeRequest({ contentLength: null, chunks: [bytes("y".repeat(5_000))] });
    const response = await importPOST(request);

    expect(response.status).toBe(413);
  });

  it("bloqueia com 429 quando a camada específica de rate limit da rota nega", async () => {
    const { importPOST } = await withMockedRateLimiter({ allowed: false, retryAfterSeconds: 15 });

    const response = await importPOST(jsonRequest({ token: "qualquer.coisa" }));

    expect(response.status).toBe(429);
  });
});
