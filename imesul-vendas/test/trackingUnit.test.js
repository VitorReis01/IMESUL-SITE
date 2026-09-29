import { beforeEach, describe, expect, it, vi } from "vitest";

// Mesmo padrao de test/cart.test.js: window minimo com storages em memoria (sem jsdom).
class MemoryStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
}

class BlockedStorage {
  getItem() {
    throw new Error("SecurityError");
  }
  setItem() {
    throw new Error("SecurityError");
  }
  removeItem() {
    throw new Error("SecurityError");
  }
}

const setup = (overrides = {}) => {
  globalThis.window = Object.assign(new EventTarget(), {
    sessionStorage: new MemoryStorage(),
    localStorage: new MemoryStorage(),
    ...overrides,
  });
  vi.resetModules();
};

const importUnit = () => import("../lib/analyticsUnit.js");

describe("GA4 por rota (lib/analyticsUnit.js)", () => {
  beforeEach(() => setup());

  it("rota decide: / e /campogrande -> Campo Grande; /dourados e /douradosmatriz -> Dourados", async () => {
    const { resolveAnalyticsUnit } = await importUnit();
    expect(resolveAnalyticsUnit("/", "")).toBe("campo-grande");
    expect(resolveAnalyticsUnit("/campogrande", "")).toBe("campo-grande");
    expect(resolveAnalyticsUnit("/campo-grande", "")).toBe("campo-grande");
    expect(resolveAnalyticsUnit("/dourados", "")).toBe("dourados");
    expect(resolveAnalyticsUnit("/douradosmatriz", "")).toBe("dourados");
    expect(resolveAnalyticsUnit("/Dourados/", "")).toBe("dourados");
  });

  it("a rota SEMPRE vence a unidade guardada (nunca Campo Grande em /dourados)", async () => {
    const { resolveAnalyticsUnit } = await importUnit();
    expect(resolveAnalyticsUnit("/dourados", "campo-grande")).toBe("dourados");
    expect(resolveAnalyticsUnit("/douradosmatriz", "campo-grande")).toBe("dourados");
    expect(resolveAnalyticsUnit("/campogrande", "dourados")).toBe("campo-grande");
  });

  it("rotas sem unidade mantem a da sessao; sem sessao, Campo Grande", async () => {
    const { resolveAnalyticsUnit, getAnalyticsUnitForPath } = await importUnit();
    expect(getAnalyticsUnitForPath("/")).toBe("");
    expect(getAnalyticsUnitForPath("/materiais/tubos-e-metalons")).toBe("");
    expect(getAnalyticsUnitForPath("/dourados-fake")).toBe("");
    expect(resolveAnalyticsUnit("/", "dourados")).toBe("dourados");
    expect(resolveAnalyticsUnit("/materiais/chapas", "dourados")).toBe("dourados");
    expect(resolveAnalyticsUnit("/", "")).toBe("campo-grande");
    expect(resolveAnalyticsUnit("/", "matriz")).toBe("campo-grande");
    expect(resolveAnalyticsUnit(undefined, undefined)).toBe("campo-grande");
  });

  it("unidade da sessao: grava, le, ignora invalida e avisa assinantes so quando muda", async () => {
    const { setSessionAnalyticsUnit, getSessionAnalyticsUnit, subscribeToAnalyticsUnit } = await importUnit();
    const callback = vi.fn();
    subscribeToAnalyticsUnit(callback);
    expect(getSessionAnalyticsUnit()).toBe("");
    setSessionAnalyticsUnit("matriz");
    expect(getSessionAnalyticsUnit()).toBe("");
    setSessionAnalyticsUnit("dourados");
    setSessionAnalyticsUnit("dourados");
    expect(getSessionAnalyticsUnit()).toBe("dourados");
    expect(callback).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem("imesul_analytics_unit")).toBe("dourados");
  });

  it("navegador fechado (sessionStorage vazio): volta a regra da rota, nada persiste", async () => {
    const { setSessionAnalyticsUnit } = await importUnit();
    setSessionAnalyticsUnit("dourados");
    window.sessionStorage = new MemoryStorage();
    vi.resetModules();
    const { getSessionAnalyticsUnit, resolveAnalyticsUnit } = await importUnit();
    expect(getSessionAnalyticsUnit()).toBe("");
    expect(resolveAnalyticsUnit("/", getSessionAnalyticsUnit())).toBe("campo-grande");
    expect(window.localStorage.getItem("imesul_analytics_unit")).toBeNull();
  });

  it("localStorage antigo e removido e nunca influencia a decisao", async () => {
    window.localStorage.setItem("imesul_analytics_unit", "campo-grande");
    const { purgeLegacyAnalyticsUnit, resolveAnalyticsUnit, getSessionAnalyticsUnit } = await importUnit();
    expect(getSessionAnalyticsUnit()).toBe("");
    expect(resolveAnalyticsUnit("/dourados", getSessionAnalyticsUnit())).toBe("dourados");
    purgeLegacyAnalyticsUnit();
    expect(window.localStorage.getItem("imesul_analytics_unit")).toBeNull();
  });

  it("storage bloqueado (SecurityError) nunca lanca", async () => {
    setup({ sessionStorage: new BlockedStorage(), localStorage: new BlockedStorage() });
    const { setSessionAnalyticsUnit, getSessionAnalyticsUnit, purgeLegacyAnalyticsUnit, resolveAnalyticsUnit } =
      await importUnit();
    expect(() => setSessionAnalyticsUnit("dourados")).not.toThrow();
    expect(() => purgeLegacyAnalyticsUnit()).not.toThrow();
    expect(getSessionAnalyticsUnit()).toBe("");
    expect(resolveAnalyticsUnit("/dourados", "")).toBe("dourados");
    expect(resolveAnalyticsUnit("/", "")).toBe("campo-grande");
  });
});

describe("regiao comercial continua separada (lib/unitPreference.js)", () => {
  beforeEach(() => setup());

  it("setStoredUnit grava so imesul_commercial_unit (sessao) e nunca a unidade do GA4", async () => {
    const { setStoredUnit, getStoredUnit } = await import("../lib/unitPreference.js");
    setStoredUnit("dourados");
    expect(getStoredUnit()).toBe("dourados");
    expect(window.sessionStorage.getItem("imesul_commercial_unit")).toBe("dourados");
    expect(window.sessionStorage.getItem("imesul_analytics_unit")).toBeNull();
    expect(window.localStorage.getItem("imesul_analytics_unit")).toBeNull();
  });

  it("a unidade do GA4 nunca altera a regiao comercial", async () => {
    const { setSessionAnalyticsUnit } = await importUnit();
    const { getStoredUnit } = await import("../lib/unitPreference.js");
    setSessionAnalyticsUnit("dourados");
    expect(getStoredUnit()).toBe("");
    expect(window.sessionStorage.getItem("imesul_commercial_unit")).toBeNull();
  });
});

describe("cidades -> unidade (lib/commercialRegions.js, inalterado)", () => {
  const campoGrande = ["Campo Grande", "Jaraguari", "Bandeirantes", "São Gabriel do Oeste", "Rio Verde de Mato Grosso", "Coxim", "Alcinópolis", "Figueirão", "Costa Rica", "Chapadão do Sul", "Paraíso das Águas", "Camapuã", "Ribas do Rio Pardo", "Água Clara", "Três Lagoas", "Selvíria", "Aparecida do Taboado", "Inocência", "Brasilândia", "Cassilândia", "Pedro Gomes", "Sonora"];
  const dourados = ["Dourados", "Anaurilândia", "Nova Andradina", "Bataguassu", "Deodápolis", "Vicentina", "Fátima do Sul", "Batayporã", "Angélica", "Glória de Dourados", "Ivinhema", "Mundo Novo", "Itaquiraí", "Eldorado", "Naviraí", "Amambai", "Caarapó", "Tacuru", "Laguna Carapã", "Iguatemi", "Juti", "Corumbá", "Miranda", "Ladário", "Anastácio", "Bodoquena", "Nioaque", "Aquidauana", "Bela Vista", "Nova Alvorada do Sul", "Bonito", "Antônio João", "Maracaju", "Jardim", "Guia Lopes da Laguna", "Rio Brilhante", "Ponta Porã", "Caracol"];

  it("todas as cidades confirmadas resolvem para a regiao certa e as listas oficiais batem exatamente", async () => {
    const { getCommercialRegionByCity, ALL_MS_COMMERCIAL_CITIES } = await import("../lib/commercialRegions.js");
    expect(campoGrande).toHaveLength(22);
    expect(dourados).toHaveLength(38);
    campoGrande.forEach((city) => expect(getCommercialRegionByCity(city)).toBe("campo-grande"));
    dourados.forEach((city) => expect(getCommercialRegionByCity(city)).toBe("dourados"));
    expect([...ALL_MS_COMMERCIAL_CITIES].sort()).toEqual([...campoGrande, ...dourados].sort());
  });

  it("Laguna Carapa e Guia Lopes da Laguna sao cidades diferentes; localidades nao oficiais nao entram", async () => {
    const { getCommercialRegionByCity, ALL_MS_COMMERCIAL_CITIES } = await import("../lib/commercialRegions.js");
    expect(ALL_MS_COMMERCIAL_CITIES).toContain("Laguna Carapã");
    expect(ALL_MS_COMMERCIAL_CITIES).toContain("Guia Lopes da Laguna");
    ["Garcias", "Morangas", "Baús"].forEach((name) => {
      expect(ALL_MS_COMMERCIAL_CITIES).not.toContain(name);
      expect(getCommercialRegionByCity(name)).toBeNull();
    });
  });
});
