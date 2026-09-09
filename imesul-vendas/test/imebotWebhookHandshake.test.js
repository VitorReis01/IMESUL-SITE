import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

// Handshake GET de verificação do webhook Meta - antes comparava hub.verify_token com "!=="
// simples (achado da auditoria FULL-SCOPE); a remediação trocou para safeCompare (tempo
// constante), mesma função usada por sessão admin/PDF Bridge/cron do IMEbot. Este teste cobre só
// o comportamento externo (aceita/rejeita), não o tempo de execução - o que importa aqui é que
// nenhuma regressão foi introduzida na lógica de aceite/rejeição do handshake.
describe("GET /api/imebot/webhook - handshake de verificação (remediação FULL-SCOPE)", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.IMEBOT_ENABLED = "true";
    process.env.META_WHATSAPP_VERIFY_TOKEN = "verify-token-de-teste";
    // Dependencias pesadas do resto da rota (POST) mockadas por seguranca - o handshake GET nao
    // as usa, mas o modulo do route.js as importa no topo do arquivo.
    vi.doMock("../Backend.js/db", () => ({ query: vi.fn(), isDatabaseConfigured: () => false, withTransaction: vi.fn() }));
  });
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.doUnmock("../Backend.js/db");
  });

  const makeUrl = (params) => `https://exemplo.vercel.app/api/imebot/webhook?${new URLSearchParams(params).toString()}`;

  it("aceita o handshake com o verify_token correto e devolve o challenge", async () => {
    const { GET } = await import("../app/api/imebot/webhook/route");
    const request = { url: makeUrl({ "hub.mode": "subscribe", "hub.verify_token": "verify-token-de-teste", "hub.challenge": "abc123" }) };

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("abc123");
  });

  it("rejeita com 403 quando o verify_token está incorreto", async () => {
    const { GET } = await import("../app/api/imebot/webhook/route");
    const request = { url: makeUrl({ "hub.mode": "subscribe", "hub.verify_token": "token-errado", "hub.challenge": "abc123" }) };

    const response = await GET(request);

    expect(response.status).toBe(403);
  });

  it("rejeita com 403 quando o verify_token tem tamanho diferente do esperado (edge case do safeCompare)", async () => {
    const { GET } = await import("../app/api/imebot/webhook/route");
    const request = { url: makeUrl({ "hub.mode": "subscribe", "hub.verify_token": "curto", "hub.challenge": "abc123" }) };

    const response = await GET(request);

    expect(response.status).toBe(403);
  });

  it("rejeita com 403 quando hub.mode não é 'subscribe'", async () => {
    const { GET } = await import("../app/api/imebot/webhook/route");
    const request = { url: makeUrl({ "hub.mode": "unsubscribe", "hub.verify_token": "verify-token-de-teste", "hub.challenge": "abc123" }) };

    const response = await GET(request);

    expect(response.status).toBe(403);
  });
});
