import { describe, expect, it } from "vitest";
import {
  ALL_MS_COMMERCIAL_CITIES,
  CAMPO_GRANDE_CITIES,
  DOURADOS_CITIES,
  getCommercialRegionByCity,
} from "../lib/commercialRegions";
import { COMMERCIAL_UNITS } from "../lib/leadFlow";

describe("getCommercialRegionByCity - região de Campo Grande", () => {
  it.each(["Campo Grande", "Coxim", "Três Lagoas", "Costa Rica", "São Gabriel do Oeste"])(
    "%s resolve para campo-grande",
    (city) => {
      expect(getCommercialRegionByCity(city)).toBe(COMMERCIAL_UNITS.CAMPO_GRANDE);
    }
  );

  it("todos os 22 municípios da lista oficial resolvem para campo-grande", () => {
    CAMPO_GRANDE_CITIES.forEach((city) => {
      expect(getCommercialRegionByCity(city)).toBe(COMMERCIAL_UNITS.CAMPO_GRANDE);
    });
    expect(CAMPO_GRANDE_CITIES).toHaveLength(22);
  });
});

describe("getCommercialRegionByCity - região de Dourados", () => {
  it.each(["Dourados", "Ivinhema", "Nova Andradina", "Corumbá", "Ponta Porã", "Mundo Novo", "Bonito"])(
    "%s resolve para dourados",
    (city) => {
      expect(getCommercialRegionByCity(city)).toBe(COMMERCIAL_UNITS.DOURADOS);
    }
  );

  it("todos os 38 municípios da lista oficial resolvem para dourados", () => {
    DOURADOS_CITIES.forEach((city) => {
      expect(getCommercialRegionByCity(city)).toBe(COMMERCIAL_UNITS.DOURADOS);
    });
    expect(DOURADOS_CITIES).toHaveLength(38);
  });
});

describe("getCommercialRegionByCity - normalização (acento, caixa, espaços)", () => {
  it("Corumbá / corumba / CORUMBÁ resolvem igual", () => {
    expect(getCommercialRegionByCity("Corumbá")).toBe(COMMERCIAL_UNITS.DOURADOS);
    expect(getCommercialRegionByCity("corumba")).toBe(COMMERCIAL_UNITS.DOURADOS);
    expect(getCommercialRegionByCity("CORUMBÁ")).toBe(COMMERCIAL_UNITS.DOURADOS);
  });

  it("Três Lagoas / tres lagoas resolvem igual", () => {
    expect(getCommercialRegionByCity("Três Lagoas")).toBe(COMMERCIAL_UNITS.CAMPO_GRANDE);
    expect(getCommercialRegionByCity("tres lagoas")).toBe(COMMERCIAL_UNITS.CAMPO_GRANDE);
  });

  it("espaços extras e caixa mista não atrapalham", () => {
    expect(getCommercialRegionByCity("  Ponta Porã  ")).toBe(COMMERCIAL_UNITS.DOURADOS);
    expect(getCommercialRegionByCity("pOnTa PoRã")).toBe(COMMERCIAL_UNITS.DOURADOS);
  });
});

describe("getCommercialRegionByCity - fora do escopo territorial", () => {
  it("devolve null para cidade desconhecida/fora das duas listas", () => {
    expect(getCommercialRegionByCity("Cidade Que Não Existe")).toBeNull();
  });

  it("devolve null para entrada vazia/ausente", () => {
    expect(getCommercialRegionByCity("")).toBeNull();
    expect(getCommercialRegionByCity(null)).toBeNull();
    expect(getCommercialRegionByCity(undefined)).toBeNull();
  });

  it("devolve null para cidade de outro estado (ex.: São Paulo, Cuiabá)", () => {
    expect(getCommercialRegionByCity("São Paulo")).toBeNull();
    expect(getCommercialRegionByCity("Cuiabá")).toBeNull();
  });

  it("nunca mistura as duas regiões (nenhum município aparece nas duas listas)", () => {
    const normalizedCampoGrande = new Set(CAMPO_GRANDE_CITIES.map((city) => city.toLowerCase()));
    DOURADOS_CITIES.forEach((city) => {
      expect(normalizedCampoGrande.has(city.toLowerCase())).toBe(false);
    });
  });
});

describe("ALL_MS_COMMERCIAL_CITIES", () => {
  it("é a união das duas listas, sem duplicatas, 60 municípios no total", () => {
    expect(ALL_MS_COMMERCIAL_CITIES).toHaveLength(CAMPO_GRANDE_CITIES.length + DOURADOS_CITIES.length);
    expect(new Set(ALL_MS_COMMERCIAL_CITIES).size).toBe(ALL_MS_COMMERCIAL_CITIES.length);
  });
});
