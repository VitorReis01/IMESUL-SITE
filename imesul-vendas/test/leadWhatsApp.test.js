import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COMMERCIAL_UNITS, LEAD_FLOW_TYPES } from "../lib/leadFlow";

// Cobre a decisão central de lib/leadWhatsApp.js: unit === "dourados" desvia inteiramente para o
// alternador (nunca cria lead); qualquer outra unidade segue o fluxo de lead/rodízio já existente.
// window.open é mockado (ambiente de teste é "node" puro, sem jsdom - ver vitest.config.mjs);
// createLead/openDouradosWhatsApp são mockados para isolar só a decisão de roteamento.
describe("openWhatsAppWithLead - roteamento territorial", () => {
  const openDouradosWhatsApp = vi.fn(async () => undefined);
  const createLead = vi.fn(async () => ({ ok: true, leadCode: "IMESUL-TESTE", seller: { name: "Vendedor Teste", whatsapp: "5567900000000" } }));

  beforeEach(() => {
    vi.resetModules();
    openDouradosWhatsApp.mockClear();
    createLead.mockClear();

    vi.doMock("../lib/douradosDispatch", () => ({ openDouradosWhatsApp }));
    vi.doMock("../lib/leads", () => ({ createLead }));
    vi.doMock("../lib/localAnalytics", () => ({ getAnonymousVisitorId: () => "visitor-teste" }));
    vi.doMock("../lib/trackEvent", () => ({ trackEvent: () => {} }));
    vi.doMock("../lib/commercialContactAlert", () => ({ notifyCommercialContactBlocked: () => {} }));

    globalThis.window = {
      open: vi.fn(() => ({ closed: false, location: {} })),
      location: { search: "" },
    };
  });

  afterEach(() => {
    vi.doUnmock("../lib/douradosDispatch");
    vi.doUnmock("../lib/leads");
    vi.doUnmock("../lib/localAnalytics");
    vi.doUnmock("../lib/trackEvent");
    vi.doUnmock("../lib/commercialContactAlert");
    delete globalThis.window;
  });

  it("unit dourados -> delega inteiramente ao alternador, NUNCA cria lead", async () => {
    const { openWhatsAppWithLead } = await import("../lib/leadWhatsApp");

    await openWhatsAppWithLead({
      message: "Olá, quero orçamento",
      flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT,
      unit: COMMERCIAL_UNITS.DOURADOS,
      pagePath: "teste",
    });

    expect(openDouradosWhatsApp).toHaveBeenCalledTimes(1);
    expect(createLead).not.toHaveBeenCalled();
  });

  it("unit campo-grande -> cria lead pelo fluxo normal, NUNCA chama o alternador de Dourados", async () => {
    const { openWhatsAppWithLead } = await import("../lib/leadWhatsApp");

    await openWhatsAppWithLead({
      message: "Olá, quero orçamento",
      flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT,
      unit: COMMERCIAL_UNITS.CAMPO_GRANDE,
      pagePath: "teste",
    });

    expect(createLead).toHaveBeenCalledTimes(1);
    expect(createLead).toHaveBeenCalledWith(expect.objectContaining({ unit: COMMERCIAL_UNITS.CAMPO_GRANDE }));
    expect(openDouradosWhatsApp).not.toHaveBeenCalled();
  });
});
