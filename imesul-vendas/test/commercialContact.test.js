import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COMMERCIAL_UNITS } from "../lib/leadFlow";

// requestCommercialContact é o ponto único para CTAs que ainda não conhecem a região (ver
// lib/commercialContact.js) - estes testes cobrem só a DECISÃO (pula ou abre o seletor de
// região), sem tocar rede/DOM real: leadWhatsApp/unitPickerBridge/unitPreference são mockados.
describe("requestCommercialContact", () => {
  const openWhatsAppWithLead = vi.fn(async () => undefined);
  const requestUnitChoice = vi.fn(async () => COMMERCIAL_UNITS.DOURADOS);
  const setStoredUnit = vi.fn();
  let getStoredUnit;

  beforeEach(() => {
    vi.resetModules();
    openWhatsAppWithLead.mockClear();
    requestUnitChoice.mockClear();
    setStoredUnit.mockClear();
    getStoredUnit = vi.fn(() => "");

    vi.doMock("../lib/leadWhatsApp", () => ({ openWhatsAppWithLead }));
    vi.doMock("../lib/unitPickerBridge", () => ({ requestUnitChoice }));
    vi.doMock("../lib/unitPreference", () => ({
      getStoredUnit: (...args) => getStoredUnit(...args),
      setStoredUnit,
    }));
  });

  afterEach(() => {
    vi.doUnmock("../lib/leadWhatsApp");
    vi.doUnmock("../lib/unitPickerBridge");
    vi.doUnmock("../lib/unitPreference");
  });

  it("região já conhecida (preferência salva) - NÃO abre o seletor, segue direto", async () => {
    getStoredUnit.mockReturnValue(COMMERCIAL_UNITS.CAMPO_GRANDE);
    const { requestCommercialContact } = await import("../lib/commercialContact");

    await requestCommercialContact({ message: "oi", pagePath: "teste" });

    expect(requestUnitChoice).not.toHaveBeenCalled();
    expect(openWhatsAppWithLead).toHaveBeenCalledWith(
      expect.objectContaining({ unit: COMMERCIAL_UNITS.CAMPO_GRANDE })
    );
  });

  it("unit explícito no argumento tem prioridade sobre a preferência salva", async () => {
    getStoredUnit.mockReturnValue(COMMERCIAL_UNITS.CAMPO_GRANDE);
    const { requestCommercialContact } = await import("../lib/commercialContact");

    await requestCommercialContact({ message: "oi", unit: COMMERCIAL_UNITS.DOURADOS, pagePath: "teste" });

    expect(requestUnitChoice).not.toHaveBeenCalled();
    expect(openWhatsAppWithLead).toHaveBeenCalledWith(
      expect.objectContaining({ unit: COMMERCIAL_UNITS.DOURADOS })
    );
  });

  it("região desconhecida - abre o seletor, persiste a escolha e só então prossegue", async () => {
    getStoredUnit.mockReturnValue("");
    const { requestCommercialContact } = await import("../lib/commercialContact");

    await requestCommercialContact({ message: "oi", pagePath: "teste" });

    expect(requestUnitChoice).toHaveBeenCalledTimes(1);
    expect(setStoredUnit).toHaveBeenCalledWith(COMMERCIAL_UNITS.DOURADOS);
    expect(openWhatsAppWithLead).toHaveBeenCalledWith(
      expect.objectContaining({ unit: COMMERCIAL_UNITS.DOURADOS })
    );
  });
});

// --- ?unidade= (hint) nunca é autoridade -------------------------------------------------------
// Estes cenários usam lib/unitPreference.js REAL (não mockado) para provar de ponta a ponta que
// um hint capturado da URL nunca vaza para a decisão de requestCommercialContact - só
// leadWhatsApp/unitPickerBridge são mockados (o modal de verdade não pode ser renderizado neste
// projeto - sem React Testing Library/jsdom, ver relatório desta fase).
class FakeLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
}

const installWindowStub = (search = "") => {
  const listeners = new Map();
  globalThis.window = {
    localStorage: new FakeLocalStorage(),
    sessionStorage: new FakeLocalStorage(),
    location: { search },
    addEventListener: (type, handler) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener: (type, handler) => {
      listeners.get(type)?.delete(handler);
    },
    dispatchEvent: (event) => {
      listeners.get(event.type)?.forEach((handler) => handler(event));
      return true;
    },
  };
};

describe("requestCommercialContact - ?unidade= é só hint, nunca autoridade", () => {
  const openWhatsAppWithLead = vi.fn(async () => undefined);
  let deferredResolve;
  const requestUnitChoice = vi.fn(
    () =>
      new Promise((resolve) => {
        deferredResolve = resolve;
      })
  );

  beforeEach(() => {
    vi.resetModules();
    openWhatsAppWithLead.mockClear();
    requestUnitChoice.mockClear();
    deferredResolve = undefined;
    installWindowStub();

    vi.doMock("../lib/leadWhatsApp", () => ({ openWhatsAppWithLead }));
    vi.doMock("../lib/unitPickerBridge", () => ({ requestUnitChoice }));
  });

  afterEach(() => {
    vi.doUnmock("../lib/leadWhatsApp");
    vi.doUnmock("../lib/unitPickerBridge");
    delete globalThis.window;
  });

  it("A) ?unidade=campo-grande sem cidade confirmada -> abre o seletor, NÃO abre WhatsApp ainda", async () => {
    globalThis.window.location.search = "?unidade=campo-grande";
    const { captureUnitHintFromUrl } = await import("../lib/unitPreference");
    captureUnitHintFromUrl();

    const { requestCommercialContact } = await import("../lib/commercialContact");
    requestCommercialContact({ message: "oi", pagePath: "teste" });
    await Promise.resolve(); // deixa o microtask do "if (!unit)" rodar

    expect(requestUnitChoice).toHaveBeenCalledTimes(1);
    expect(openWhatsAppWithLead).not.toHaveBeenCalled();

    deferredResolve(COMMERCIAL_UNITS.CAMPO_GRANDE);
  });

  it("B) ?unidade=dourados sem cidade confirmada -> abre o seletor", async () => {
    globalThis.window.location.search = "?unidade=dourados";
    const { captureUnitHintFromUrl } = await import("../lib/unitPreference");
    captureUnitHintFromUrl();

    const { requestCommercialContact } = await import("../lib/commercialContact");
    requestCommercialContact({ message: "oi", pagePath: "teste" });
    await Promise.resolve();

    expect(requestUnitChoice).toHaveBeenCalledTimes(1);
    expect(openWhatsAppWithLead).not.toHaveBeenCalled();

    deferredResolve(COMMERCIAL_UNITS.DOURADOS);
  });

  it("C) ?unidade=campo-grande + cliente informa Ivinhema -> DOURADOS prevalece sobre o hint", async () => {
    globalThis.window.location.search = "?unidade=campo-grande";
    const { captureUnitHintFromUrl, setStoredUnit, getStoredUnit } = await import("../lib/unitPreference");
    captureUnitHintFromUrl();

    // Simula QuoteBuilder.jsx resolvendo Ivinhema -> dourados e persistindo (mesmo mecanismo real).
    const { getCommercialRegionByCity } = await import("../lib/commercialRegions");
    setStoredUnit(getCommercialRegionByCity("Ivinhema"));
    expect(getStoredUnit()).toBe(COMMERCIAL_UNITS.DOURADOS);

    const { requestCommercialContact } = await import("../lib/commercialContact");
    await requestCommercialContact({ message: "oi", pagePath: "teste" });

    expect(requestUnitChoice).not.toHaveBeenCalled();
    expect(openWhatsAppWithLead).toHaveBeenCalledWith(expect.objectContaining({ unit: COMMERCIAL_UNITS.DOURADOS }));
  });

  it("D) ?unidade=dourados + cliente informa Coxim -> CAMPO GRANDE prevalece sobre o hint", async () => {
    globalThis.window.location.search = "?unidade=dourados";
    const { captureUnitHintFromUrl, setStoredUnit, getStoredUnit } = await import("../lib/unitPreference");
    captureUnitHintFromUrl();

    const { getCommercialRegionByCity } = await import("../lib/commercialRegions");
    setStoredUnit(getCommercialRegionByCity("Coxim"));
    expect(getStoredUnit()).toBe(COMMERCIAL_UNITS.CAMPO_GRANDE);

    const { requestCommercialContact } = await import("../lib/commercialContact");
    await requestCommercialContact({ message: "oi", pagePath: "teste" });

    expect(requestUnitChoice).not.toHaveBeenCalled();
    expect(openWhatsAppWithLead).toHaveBeenCalledWith(
      expect.objectContaining({ unit: COMMERCIAL_UNITS.CAMPO_GRANDE })
    );
  });

  it("E) cidade já confirmada (Coxim) - novo clique não reabre o seletor e segue para Campo Grande", async () => {
    const { setStoredUnit } = await import("../lib/unitPreference");
    const { getCommercialRegionByCity } = await import("../lib/commercialRegions");
    setStoredUnit(getCommercialRegionByCity("Coxim"));

    const { requestCommercialContact } = await import("../lib/commercialContact");
    await requestCommercialContact({ message: "primeiro clique", pagePath: "teste" });
    await requestCommercialContact({ message: "segundo clique", pagePath: "teste" });

    expect(requestUnitChoice).not.toHaveBeenCalled();
    expect(openWhatsAppWithLead).toHaveBeenCalledTimes(2);
    openWhatsAppWithLead.mock.calls.forEach((call) => {
      expect(call[0]).toEqual(expect.objectContaining({ unit: COMMERCIAL_UNITS.CAMPO_GRANDE }));
    });
  });

  it("G) Corumbá nunca resolve para campo-grande (divisão é comercial, não geográfica/GPS)", async () => {
    const { getCommercialRegionByCity } = await import("../lib/commercialRegions");
    expect(getCommercialRegionByCity("Corumbá")).toBe(COMMERCIAL_UNITS.DOURADOS);
    expect(getCommercialRegionByCity("Corumbá")).not.toBe(COMMERCIAL_UNITS.CAMPO_GRANDE);
  });
});
