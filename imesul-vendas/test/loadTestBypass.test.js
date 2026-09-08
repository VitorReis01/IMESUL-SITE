import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isLoadTestBypassAllowed } from "../Backend.js/loadTestBypass";

// Bypass extremamente restrito do rate limiter de /api/leads, so para o load test controlado da
// Vercel Preview (ver Backend.js/loadTestBypass.js). As 4 condicoes (VERCEL_ENV, flag, secret
// configurado, header correto) precisam valer AO MESMO TEMPO - qualquer uma faltando aplica o
// rate limiter normalmente. O caso mais importante desta suite: Production NUNCA consegue
// bypassar, mesmo com flag/secret/header corretos.
const makeRequest = (headers = {}) => ({
  headers: { get: (name) => headers[name.toLowerCase()] ?? null },
});

const originalEnv = {
  VERCEL_ENV: process.env.VERCEL_ENV,
  ALLOW_LOAD_TEST_BYPASS: process.env.ALLOW_LOAD_TEST_BYPASS,
  LOAD_TEST_BYPASS_SECRET: process.env.LOAD_TEST_BYPASS_SECRET,
};

const restoreEnv = () => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
};

describe("isLoadTestBypassAllowed", () => {
  beforeEach(() => {
    delete process.env.VERCEL_ENV;
    delete process.env.ALLOW_LOAD_TEST_BYPASS;
    delete process.env.LOAD_TEST_BYPASS_SECRET;
  });

  afterEach(restoreEnv);

  it("Production nunca bypassa, mesmo com flag + secret + header corretos", () => {
    process.env.VERCEL_ENV = "production";
    process.env.ALLOW_LOAD_TEST_BYPASS = "true";
    process.env.LOAD_TEST_BYPASS_SECRET = "segredo-teste";

    const request = makeRequest({ "x-imesul-load-test": "segredo-teste" });
    expect(isLoadTestBypassAllowed(request)).toBe(false);
  });

  it("Development nunca bypassa (so 'preview' e aceito), mesmo com flag + secret + header corretos", () => {
    process.env.VERCEL_ENV = "development";
    process.env.ALLOW_LOAD_TEST_BYPASS = "true";
    process.env.LOAD_TEST_BYPASS_SECRET = "segredo-teste";

    const request = makeRequest({ "x-imesul-load-test": "segredo-teste" });
    expect(isLoadTestBypassAllowed(request)).toBe(false);
  });

  it("Preview sem ALLOW_LOAD_TEST_BYPASS -> rate limit normal (bypass negado)", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.LOAD_TEST_BYPASS_SECRET = "segredo-teste";
    // ALLOW_LOAD_TEST_BYPASS ausente de proposito.

    const request = makeRequest({ "x-imesul-load-test": "segredo-teste" });
    expect(isLoadTestBypassAllowed(request)).toBe(false);
  });

  it("Preview + flag, mas ALLOW_LOAD_TEST_BYPASS com valor diferente de 'true' -> rate limit normal", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.ALLOW_LOAD_TEST_BYPASS = "1";
    process.env.LOAD_TEST_BYPASS_SECRET = "segredo-teste";

    const request = makeRequest({ "x-imesul-load-test": "segredo-teste" });
    expect(isLoadTestBypassAllowed(request)).toBe(false);
  });

  it("Preview + flag, mas SEM LOAD_TEST_BYPASS_SECRET configurado -> rate limit normal", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.ALLOW_LOAD_TEST_BYPASS = "true";
    // LOAD_TEST_BYPASS_SECRET ausente de proposito.

    const request = makeRequest({ "x-imesul-load-test": "qualquer-coisa" });
    expect(isLoadTestBypassAllowed(request)).toBe(false);
  });

  it("Preview + flag + secret configurado, mas SEM o header -> rate limit normal", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.ALLOW_LOAD_TEST_BYPASS = "true";
    process.env.LOAD_TEST_BYPASS_SECRET = "segredo-teste";

    const request = makeRequest({});
    expect(isLoadTestBypassAllowed(request)).toBe(false);
  });

  it("Preview + flag + secret configurado, mas com secret ERRADO no header -> rate limit normal", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.ALLOW_LOAD_TEST_BYPASS = "true";
    process.env.LOAD_TEST_BYPASS_SECRET = "segredo-teste";

    const request = makeRequest({ "x-imesul-load-test": "segredo-errado" });
    expect(isLoadTestBypassAllowed(request)).toBe(false);
  });

  it("Preview + flag + secret correto -> bypass concedido (SOMENTE quando as 4 condicoes valem)", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.ALLOW_LOAD_TEST_BYPASS = "true";
    process.env.LOAD_TEST_BYPASS_SECRET = "segredo-teste";

    const request = makeRequest({ "x-imesul-load-test": "segredo-teste" });
    expect(isLoadTestBypassAllowed(request)).toBe(true);
  });
});
