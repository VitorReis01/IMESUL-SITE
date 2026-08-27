import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Cobre os dois caminhos de Backend.js/douradosAlternatorStore.js: o fallback de arquivo (usado
// em dev sem DATABASE_URL - mesmo cenário deste ambiente de teste) e o caminho do Postgres, aqui
// simulado com um mock que reproduz fielmente a semântica do UPDATE atômico real (lê e grava o
// novo valor na MESMA "instrução", sem passo intermediário) - garante que o código nunca dependa
// de um padrão ler-depois-escrever, que teria corrida entre acessos concorrentes.
const statePath = path.join(os.tmpdir(), "imesul-vendas-dourados-alternator.json");
const resetFileState = () => fs.rm(statePath, { force: true });

describe("getNextDouradosDestination - fallback local (sem DATABASE_URL)", () => {
  beforeEach(resetFileState);
  afterEach(resetFileState);

  it("primeiro cliente vai para Centro", async () => {
    const { getNextDouradosDestination } = await import("../Backend.js/douradosAlternatorStore");
    expect(await getNextDouradosDestination()).toBe("centro");
  });

  it("alterna estritamente 1 por 1: Centro, Fábrica, Centro, Fábrica, Centro, Fábrica", async () => {
    const { getNextDouradosDestination } = await import("../Backend.js/douradosAlternatorStore");
    const sequence = [];
    for (let i = 0; i < 6; i += 1) {
      sequence.push(await getNextDouradosDestination());
    }
    expect(sequence).toEqual(["centro", "fabrica", "centro", "fabrica", "centro", "fabrica"]);
  });

  it("nunca é 'ocupado'/'disponível' - só os dois destinos existem", async () => {
    const { getNextDouradosDestination } = await import("../Backend.js/douradosAlternatorStore");
    for (let i = 0; i < 8; i += 1) {
      expect(["centro", "fabrica"]).toContain(await getNextDouradosDestination());
    }
  });
});

describe("getNextDouradosDestination - Postgres (mock do UPDATE atômico)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("../Backend.js/db", () => {
      let lastDestination = "fabrica";
      return {
        isDatabaseConfigured: () => true,
        // Reproduz o UPDATE ... RETURNING real: le e grava o novo valor na mesma chamada, sem
        // await no meio - a mesma garantia que o lock de linha do Postgres da na tabela real
        // (ver migration 005_dourados_alternator.sql).
        query: async () => {
          lastDestination = lastDestination === "centro" ? "fabrica" : "centro";
          return { rows: [{ last_destination: lastDestination }] };
        },
      };
    });
  });

  afterEach(() => {
    vi.doUnmock("../Backend.js/db");
    vi.resetModules();
  });

  it("primeiro cliente vai para Centro", async () => {
    const { getNextDouradosDestination } = await import("../Backend.js/douradosAlternatorStore");
    expect(await getNextDouradosDestination()).toBe("centro");
  });

  it("alterna estritamente 1 por 1 em chamadas sequenciais", async () => {
    const { getNextDouradosDestination } = await import("../Backend.js/douradosAlternatorStore");
    const sequence = [];
    for (let i = 0; i < 6; i += 1) {
      sequence.push(await getNextDouradosDestination());
    }
    expect(sequence).toEqual(["centro", "fabrica", "centro", "fabrica", "centro", "fabrica"]);
  });

  it("acessos concorrentes nunca repetem o mesmo destino em sequência (sem corrida ler-depois-escrever)", async () => {
    const { getNextDouradosDestination } = await import("../Backend.js/douradosAlternatorStore");
    const results = await Promise.all(Array.from({ length: 20 }, () => getNextDouradosDestination()));

    for (let i = 1; i < results.length; i += 1) {
      expect(results[i]).not.toBe(results[i - 1]);
    }
    expect(results.filter((store) => store === "centro")).toHaveLength(10);
    expect(results.filter((store) => store === "fabrica")).toHaveLength(10);
  });
});
