import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

// Processamento de jobs muda estado (efeito colateral real) - a remediacao FULL-SCOPE removeu o
// alias "GET = POST" que existia antes (GET nunca deveria disparar um efeito colateral, mesmo
// nao sendo explorável via CSRF de navegador aqui, ja que a rota exige Authorization: Bearer).
describe("GET/POST /api/imebot/jobs/process - mudança de método (remediação FULL-SCOPE)", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.IMEBOT_ENABLED = "true";
    process.env.IMEBOT_CRON_SECRET = "segredo-cron-de-teste";
  });
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.doUnmock("../Backend.js/feedbackStore");
  });

  it("GET agora retorna 405 (Método não permitido) - antes disparava o mesmo processamento de POST", async () => {
    const processDueFeedbackJobs = vi.fn().mockResolvedValue({ ok: true, processed: 0 });
    vi.doMock("../Backend.js/feedbackStore", () => ({ processDueFeedbackJobs }));
    const { GET } = await import("../app/api/imebot/jobs/process/route");

    const request = { headers: { get: (name) => (name.toLowerCase() === "authorization" ? "Bearer segredo-cron-de-teste" : null) } };
    const response = await GET(request);

    expect(response.status).toBe(405);
    expect(processDueFeedbackJobs).not.toHaveBeenCalled();
  });

  it("PUT/PATCH/DELETE também retornam 405", async () => {
    vi.doMock("../Backend.js/feedbackStore", () => ({
      processDueFeedbackJobs: vi.fn().mockResolvedValue({ ok: true, processed: 0 }),
    }));
    const { PUT, PATCH, DELETE } = await import("../app/api/imebot/jobs/process/route");
    const request = { headers: { get: () => null } };

    expect((await PUT(request)).status).toBe(405);
    expect((await PATCH(request)).status).toBe(405);
    expect((await DELETE(request)).status).toBe(405);
  });

  it("POST continua funcionando normalmente com Bearer correto (comportamento preservado)", async () => {
    vi.doMock("../Backend.js/feedbackStore", () => ({
      processDueFeedbackJobs: vi.fn().mockResolvedValue({ ok: true, processed: 3 }),
    }));
    const { POST } = await import("../app/api/imebot/jobs/process/route");

    const request = { headers: { get: (name) => (name.toLowerCase() === "authorization" ? "Bearer segredo-cron-de-teste" : null) } };
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true, processed: 3 });
  });

  it("POST continua rejeitando Bearer incorreto com 401 (comportamento preservado)", async () => {
    vi.doMock("../Backend.js/feedbackStore", () => ({
      processDueFeedbackJobs: vi.fn().mockResolvedValue({ ok: true, processed: 0 }),
    }));
    const { POST } = await import("../app/api/imebot/jobs/process/route");

    const request = { headers: { get: (name) => (name.toLowerCase() === "authorization" ? "Bearer errado" : null) } };
    const response = await POST(request);

    expect(response.status).toBe(401);
  });
});
