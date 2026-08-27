import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COMMERCIAL_UNITS } from "../lib/leadFlow";

// lib/unitPickerBridge.js só funciona de verdade com um "window" que suporte
// addEventListener/removeEventListener/dispatchEvent (CustomEvent) - o ambiente de teste é
// "node" puro (sem jsdom, ver vitest.config.mjs), então simulamos aqui com o EventTarget nativo
// do Node (disponível desde o Node 19, sem precisar de nenhuma dependência nova) em vez de
// instalar jsdom só para este arquivo.
const installWindowStub = () => {
  const target = new EventTarget();
  globalThis.window = {
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
  };
};

const removeWindowStub = () => {
  delete globalThis.window;
};

describe("unitPickerBridge - sem window (SSR/Node)", () => {
  it("requestUnitChoice resolve direto para campo-grande sem window", async () => {
    const { requestUnitChoice } = await import("../lib/unitPickerBridge");
    await expect(requestUnitChoice()).resolves.toBe(COMMERCIAL_UNITS.CAMPO_GRANDE);
  });

  it("subscribeToUnitRequests devolve um no-op sem window (nunca lança)", async () => {
    const { subscribeToUnitRequests } = await import("../lib/unitPickerBridge");
    const unsubscribe = subscribeToUnitRequests(() => {});
    expect(() => unsubscribe()).not.toThrow();
  });
});

describe("unitPickerBridge - com window (cliente real)", () => {
  beforeEach(() => {
    installWindowStub();
    vi.resetModules();
  });

  afterEach(() => {
    removeWindowStub();
  });

  it("requestUnitChoice dispara o evento e fica pendente até resolveUnitRequests", async () => {
    const { requestUnitChoice, subscribeToUnitRequests, resolveUnitRequests } = await import(
      "../lib/unitPickerBridge"
    );

    let requested = false;
    subscribeToUnitRequests(() => {
      requested = true;
    });

    const pending = requestUnitChoice();
    expect(requested).toBe(true);

    resolveUnitRequests(COMMERCIAL_UNITS.DOURADOS);
    await expect(pending).resolves.toBe(COMMERCIAL_UNITS.DOURADOS);
  });

  it("resolveUnitRequests sem argumento cai no fallback campo-grande (fechar sem escolher)", async () => {
    const { requestUnitChoice, resolveUnitRequests } = await import("../lib/unitPickerBridge");

    const pending = requestUnitChoice();
    resolveUnitRequests();
    await expect(pending).resolves.toBe(COMMERCIAL_UNITS.CAMPO_GRANDE);
  });

  it("múltiplos pedidos concorrentes resolvem juntos com a mesma escolha", async () => {
    const { requestUnitChoice, resolveUnitRequests } = await import("../lib/unitPickerBridge");

    const first = requestUnitChoice();
    const second = requestUnitChoice();

    resolveUnitRequests(COMMERCIAL_UNITS.DOURADOS);

    await expect(first).resolves.toBe(COMMERCIAL_UNITS.DOURADOS);
    await expect(second).resolves.toBe(COMMERCIAL_UNITS.DOURADOS);
  });

  it("unsubscribe para de receber pedidos novos", async () => {
    const { requestUnitChoice, subscribeToUnitRequests, resolveUnitRequests } = await import(
      "../lib/unitPickerBridge"
    );

    let calls = 0;
    const unsubscribe = subscribeToUnitRequests(() => {
      calls += 1;
    });
    unsubscribe();

    const pending = requestUnitChoice();
    resolveUnitRequests(COMMERCIAL_UNITS.CAMPO_GRANDE);
    await pending;

    expect(calls).toBe(0);
  });
});
