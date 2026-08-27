import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  captureUnitHintFromUrl,
  getStoredUnit,
  getUnitHint,
  setStoredUnit,
} from "../lib/unitPreference";
import { COMMERCIAL_UNITS } from "../lib/leadFlow";

// Regiao CONFIRMADA (getStoredUnit/setStoredUnit) usa sessionStorage de proposito (instrucao
// explicita do usuario - vale so durante a sessao de navegacao, nunca indefinidamente); hint de
// ?unidade= (getUnitHint/captureUnitHintFromUrl) usa localStorage separado. Os dois nunca podem
// escrever um no outro. Ambiente de teste e "node" puro (sem jsdom - ver vitest.config.mjs),
// entao simulamos window/localStorage/sessionStorage aqui, sem instalar nada novo.
class FakeStorage {
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
    localStorage: new FakeStorage(),
    sessionStorage: new FakeStorage(),
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

describe("unitPreference - regiao confirmada x hint (?unidade=) são independentes", () => {
  beforeEach(() => installWindowStub());
  afterEach(() => delete globalThis.window);

  it("capturar um hint NUNCA escreve na regiao confirmada", () => {
    globalThis.window.location.search = "?unidade=campo-grande";
    captureUnitHintFromUrl();

    expect(getUnitHint()).toBe(COMMERCIAL_UNITS.CAMPO_GRANDE);
    expect(getStoredUnit()).toBe(""); // continua vazia - hint não é confirmação
  });

  it("confirmar uma regiao (cidade) NUNCA altera o hint", () => {
    globalThis.window.location.search = "?unidade=dourados";
    captureUnitHintFromUrl();
    expect(getUnitHint()).toBe(COMMERCIAL_UNITS.DOURADOS);

    setStoredUnit(COMMERCIAL_UNITS.CAMPO_GRANDE);

    expect(getStoredUnit()).toBe(COMMERCIAL_UNITS.CAMPO_GRANDE);
    expect(getUnitHint()).toBe(COMMERCIAL_UNITS.DOURADOS); // hint antigo preservado, não é sobrescrito
  });

  it("hint e regiao confirmada podem divergir (ex.: hint campo-grande, cliente confirma dourados)", () => {
    globalThis.window.location.search = "?unidade=campo-grande";
    captureUnitHintFromUrl();
    setStoredUnit(COMMERCIAL_UNITS.DOURADOS);

    expect(getUnitHint()).toBe(COMMERCIAL_UNITS.CAMPO_GRANDE);
    expect(getStoredUnit()).toBe(COMMERCIAL_UNITS.DOURADOS);
  });

  it("sem ?unidade= na URL, captureUnitHintFromUrl não apaga um hint já guardado", () => {
    globalThis.window.location.search = "?unidade=dourados";
    captureUnitHintFromUrl();

    globalThis.window.location.search = "";
    expect(captureUnitHintFromUrl()).toBe(COMMERCIAL_UNITS.DOURADOS);
  });
});

describe("unitPreference - região confirmada vale só durante a sessão de navegação", () => {
  beforeEach(() => installWindowStub());
  afterEach(() => delete globalThis.window);

  it("setStoredUnit grava em sessionStorage, não em localStorage", () => {
    setStoredUnit(COMMERCIAL_UNITS.CAMPO_GRANDE);

    expect(globalThis.window.sessionStorage.getItem("imesul_commercial_unit")).toBe(
      COMMERCIAL_UNITS.CAMPO_GRANDE
    );
    expect(globalThis.window.localStorage.getItem("imesul_commercial_unit")).toBeNull();
  });

  it("nova sessão (sessionStorage vazia) não conhece uma região confirmada em sessão anterior", () => {
    setStoredUnit(COMMERCIAL_UNITS.CAMPO_GRANDE);
    expect(getStoredUnit()).toBe(COMMERCIAL_UNITS.CAMPO_GRANDE);

    // Simula fechar o navegador e abrir de novo: sessionStorage começa vazia, mas o hint (em
    // localStorage) sobrevive normalmente entre sessões.
    globalThis.window.location.search = "?unidade=campo-grande";
    captureUnitHintFromUrl();
    globalThis.window.sessionStorage = new FakeStorage();

    expect(getStoredUnit()).toBe(""); // região confirmada não sobrevive à "nova sessão"
    expect(getUnitHint()).toBe(COMMERCIAL_UNITS.CAMPO_GRANDE); // hint continua (localStorage)
  });
});
