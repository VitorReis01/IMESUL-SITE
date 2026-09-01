import { afterEach, describe, expect, it, vi } from "vitest";
import { hashAdminPassword, verifyAdminPassword } from "../lib/adminPasswordHash";
import {
  ADMIN_SESSION_COOKIE,
  clearAdminSessionCookie,
  createAdminSession,
  invalidateAdminSession,
  isAdminRequest,
  safeCompare,
  setAdminSessionCookie,
} from "../Backend.js/adminSecurity";
import { checkOrigin } from "../Backend.js/requestGuards";

// Objetos minimos que satisfazem so o contrato que adminSecurity.js realmente usa
// (request.cookies.get / response.cookies.set) - nao precisam ser NextRequest/NextResponse reais.
const fakeRequestWithCookie = (token) => ({
  cookies: {
    get: (name) => (name === ADMIN_SESSION_COOKIE && token ? { value: token } : undefined),
  },
});

const fakeResponse = () => {
  const calls = [];
  return {
    cookies: { set: (name, value, options) => calls.push({ name, value, options }) },
    calls,
  };
};

const originalEnv = { ...process.env };

describe("hash de senha admin (scrypt) - lib/adminPasswordHash.js", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // A) senha correta via hash -> autorizado
  it("verifica corretamente a senha certa contra o hash gerado", async () => {
    const hash = await hashAdminPassword("uma-senha-bem-forte-123");
    await expect(verifyAdminPassword("uma-senha-bem-forte-123", hash)).resolves.toBe(true);
  });

  // B) senha errada -> nao autorizado
  it("rejeita a senha errada contra o hash", async () => {
    const hash = await hashAdminPassword("uma-senha-bem-forte-123");
    await expect(verifyAdminPassword("senha-errada", hash)).resolves.toBe(false);
  });

  it("rejeita hash ausente ou malformado (fail-closed) sem lançar", async () => {
    await expect(verifyAdminPassword("qualquer-coisa", "")).resolves.toBe(false);
    await expect(verifyAdminPassword("qualquer-coisa", "não-é-um-hash-scrypt")).resolves.toBe(false);
    await expect(verifyAdminPassword("qualquer-coisa", "scrypt:16384:8:1:zz:zz")).resolves.toBe(false);
  });

  it("gera hashes diferentes para a mesma senha (salt aleatório) mas ambos verificam", async () => {
    const hashA = await hashAdminPassword("outra-senha-123456");
    const hashB = await hashAdminPassword("outra-senha-123456");

    expect(hashA).not.toBe(hashB);
    await expect(verifyAdminPassword("outra-senha-123456", hashA)).resolves.toBe(true);
    await expect(verifyAdminPassword("outra-senha-123456", hashB)).resolves.toBe(true);
  });

  // H) nenhum secret aparece em log/saída
  it("o hash resultante nunca contém a senha original em texto puro", async () => {
    const password = "senha-super-secreta-distinta-xyz";
    const hash = await hashAdminPassword(password);
    expect(hash).not.toContain(password);
  });
});

describe("sessão admin - Backend.js/adminSecurity.js (fallback em memória, sem DATABASE_URL)", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("username e senha usam comparação em tempo constante (safeCompare)", () => {
    expect(safeCompare("admin", "admin")).toBe(true);
    expect(safeCompare("admin", "outro")).toBe(false);
    expect(safeCompare("admin", "admin-mais-comprido")).toBe(false);
  });

  // A/E) sessão criada -> autorizado; sem cookie -> não autorizado
  it("cria uma sessão e isAdminRequest autoriza somente com o cookie certo", async () => {
    const token = await createAdminSession();

    await expect(isAdminRequest(fakeRequestWithCookie(token))).resolves.toBe(true);
    await expect(isAdminRequest(fakeRequestWithCookie(undefined))).resolves.toBe(false);
  });

  // F) cookie inválido/nunca emitido -> bloqueado
  it("token que nunca foi emitido nunca autoriza", async () => {
    await expect(isAdminRequest(fakeRequestWithCookie("token-forjado-que-nunca-existiu"))).resolves.toBe(false);
  });

  // D/F) logout revoga a sessão no servidor -> cookie antigo passa a ser bloqueado
  it("invalidateAdminSession revoga a sessão - o mesmo token para de autorizar depois", async () => {
    const token = await createAdminSession();
    await expect(isAdminRequest(fakeRequestWithCookie(token))).resolves.toBe(true);

    await invalidateAdminSession(fakeRequestWithCookie(token));

    await expect(isAdminRequest(fakeRequestWithCookie(token))).resolves.toBe(false);
  });

  it("invalidateAdminSession sem cookie é idempotente (não lança)", async () => {
    await expect(invalidateAdminSession(fakeRequestWithCookie(undefined))).resolves.toBeUndefined();
  });

  // C) cookie HttpOnly, SameSite, Path, expiração coerente com o TTL de 8h
  it("setAdminSessionCookie grava HttpOnly, SameSite=strict, Path=/ e maxAge de 8h", () => {
    const response = fakeResponse();
    setAdminSessionCookie(response, "token-de-teste");

    expect(response.calls).toHaveLength(1);
    const [{ name, value, options }] = response.calls;
    expect(name).toBe(ADMIN_SESSION_COOKIE);
    expect(value).toBe("token-de-teste");
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("strict");
    expect(options.path).toBe("/");
    expect(options.maxAge).toBe(8 * 60 * 60);
  });

  // C) Secure só em produção
  it("cookie é Secure em produção e não-Secure fora de produção", () => {
    process.env.NODE_ENV = "production";
    const prodResponse = fakeResponse();
    setAdminSessionCookie(prodResponse, "token-prod");
    expect(prodResponse.calls[0].options.secure).toBe(true);

    process.env.NODE_ENV = "development";
    const devResponse = fakeResponse();
    setAdminSessionCookie(devResponse, "token-dev");
    expect(devResponse.calls[0].options.secure).toBe(false);
  });

  // D) logout apaga o cookie (maxAge 0)
  it("clearAdminSessionCookie zera o maxAge para apagar o cookie no navegador", () => {
    const response = fakeResponse();
    clearAdminSessionCookie(response);

    const [{ name, value, options }] = response.calls;
    expect(name).toBe(ADMIN_SESSION_COOKIE);
    expect(value).toBe("");
    expect(options.maxAge).toBe(0);
    expect(options.httpOnly).toBe(true);
  });
});

describe("CSRF - Origin allowlist em ação admin mutável (Backend.js/requestGuards.js)", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const fakeRequestWithOrigin = (origin) => ({
    headers: { get: (name) => (name.toLowerCase() === "origin" ? origin : null) },
  });

  // G) Origin inválida em ação mutável -> bloqueada
  it("bloqueia Origin fora da allowlist em produção quando Origin é exigida", () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOWED_ORIGINS = "https://imesul-vendas.vercel.app";

    const result = checkOrigin(fakeRequestWithOrigin("https://attacker.example"), { requireOriginInProduction: true });
    expect(result.allowed).toBe(false);
  });

  it("permite Origin dentro da allowlist", () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOWED_ORIGINS = "https://imesul-vendas.vercel.app";

    const result = checkOrigin(fakeRequestWithOrigin("https://imesul-vendas.vercel.app"), { requireOriginInProduction: true });
    expect(result.allowed).toBe(true);
  });

  it("bloqueia Origin ausente em produção quando Origin é exigida (ação mutável)", () => {
    process.env.NODE_ENV = "production";

    const result = checkOrigin(fakeRequestWithOrigin(null), { requireOriginInProduction: true });
    expect(result.allowed).toBe(false);
  });
});

// I) nenhuma regressão no rate limit existente (checkIpRateLimit/checkUsernameRateLimit não foram
// alterados nesta rodada - este teste só prova que continuam funcionando contra um Postgres
// simulado com o mesmo UPSERT atômico real, mesmo padrão usado em imebotAbuseGuard.test.js).
describe("rate limit do login admin - sem regressão (Postgres simulado)", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("checkIpRateLimit continua bloqueando após esgotar a camada de burst (5 em 10s)", async () => {
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
    const { checkIpRateLimit } = await import("../Backend.js/adminSecurity");

    const results = [];
    for (let index = 0; index < 6; index += 1) {
      results.push(await checkIpRateLimit("203.0.113.10"));
    }

    expect(results.slice(0, 5).every((result) => result.allowed)).toBe(true);
    expect(results[5].allowed).toBe(false);

    vi.doUnmock("../Backend.js/db");
  });
});
