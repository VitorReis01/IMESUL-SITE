import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// GET /api/health/imebot deixou de revelar publicamente o estado enabled/disabled do IMEbot
// nesta rodada de hardening (nenhuma dependência interna nem do Better Stack configurado neste
// projeto foi encontrada nessa exposição específica - ver comentário em route.js). Continua
// respondendo 200 sempre que alcançável (não quebra nenhum monitor de uptime que só olhe o
// status HTTP); quem já usa o mesmo x-monitoring-key de /api/health/database vê o detalhe real.
const originalEnv = { ...process.env };

const fakeRequest = (key) => ({
  headers: { get: (name) => (name.toLowerCase() === "x-monitoring-key" ? key : null) },
});

describe("GET /api/health/imebot - hardening", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.MONITORING_HEALTH_SECRET = "segredo-monitoring-de-teste";
  });
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.doUnmock("../Backend.js/imebotFeatureGate");
  });

  it("sem secret (público): resposta genérica {status:'ok'}, nunca revela enabled/disabled", async () => {
    vi.doMock("../Backend.js/imebotFeatureGate", () => ({ isImebotEnabled: vi.fn().mockReturnValue(true) }));
    const { GET } = await import("../app/api/health/imebot/route");

    const response = GET(fakeRequest(null));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ status: "ok" });
    expect(data.imebot).toBeUndefined();
  });

  it("secret errado (público): mesma resposta genérica, HTTP 200 preservado (não quebra uptime check)", async () => {
    vi.doMock("../Backend.js/imebotFeatureGate", () => ({ isImebotEnabled: vi.fn().mockReturnValue(false) }));
    const { GET } = await import("../app/api/health/imebot/route");

    const response = GET(fakeRequest("secret-errado"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("com o monitoring secret correto: revela o detalhe real quando habilitado", async () => {
    vi.doMock("../Backend.js/imebotFeatureGate", () => ({ isImebotEnabled: vi.fn().mockReturnValue(true) }));
    const { GET } = await import("../app/api/health/imebot/route");

    const response = GET(fakeRequest("segredo-monitoring-de-teste"));
    expect(await response.json()).toEqual({ status: "ok", imebot: "enabled" });
  });

  it("com o monitoring secret correto: revela o detalhe real quando desabilitado", async () => {
    vi.doMock("../Backend.js/imebotFeatureGate", () => ({ isImebotEnabled: vi.fn().mockReturnValue(false) }));
    const { GET } = await import("../app/api/health/imebot/route");

    const response = GET(fakeRequest("segredo-monitoring-de-teste"));
    expect(await response.json()).toEqual({ status: "disabled", imebot: "disabled" });
  });

  it("resposta continua sempre Cache-Control: no-store", async () => {
    vi.doMock("../Backend.js/imebotFeatureGate", () => ({ isImebotEnabled: vi.fn().mockReturnValue(true) }));
    const { GET } = await import("../app/api/health/imebot/route");

    expect(GET(fakeRequest(null)).headers.get("Cache-Control")).toBe("no-store");
  });
});
