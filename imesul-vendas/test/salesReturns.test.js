import { describe, expect, it } from "vitest";
import {
  buildReturnsSummary,
  computeFinancialStatus,
  computeNetSale,
  FINANCIAL_STATUS,
  validateNewReturnAmount,
} from "../lib/salesReturns";

describe("computeNetSale", () => {
  it("10.000 bruto, 4.000 devolvido -> líquido 6.000", () => {
    expect(computeNetSale({ grossSale: 10000, returnsTotal: 4000 })).toBe(6000);
  });

  it("10.000 bruto, 10.000 devolvido -> líquido 0", () => {
    expect(computeNetSale({ grossSale: 10000, returnsTotal: 10000 })).toBe(0);
  });

  it("nunca fica negativo mesmo com dado inconsistente vindo de fora", () => {
    expect(computeNetSale({ grossSale: 100, returnsTotal: 500 })).toBe(0);
  });
});

describe("computeFinancialStatus", () => {
  it("sem devolução -> NO_RETURN", () => {
    expect(computeFinancialStatus({ grossSale: 10000, returnsTotal: 0 })).toBe(FINANCIAL_STATUS.NO_RETURN);
  });

  it("devolução parcial -> PARTIAL_RETURN", () => {
    expect(computeFinancialStatus({ grossSale: 10000, returnsTotal: 4000 })).toBe(FINANCIAL_STATUS.PARTIAL_RETURN);
  });

  it("devolução total -> FULL_RETURN", () => {
    expect(computeFinancialStatus({ grossSale: 10000, returnsTotal: 10000 })).toBe(FINANCIAL_STATUS.FULL_RETURN);
  });
});

describe("buildReturnsSummary", () => {
  it("monta o resumo completo (bruto/devolvido/líquido/status)", () => {
    expect(buildReturnsSummary({ grossSale: 10000, existingReturnsTotal: 3500 })).toEqual({
      grossSale: 10000,
      returnsTotal: 3500,
      netSale: 6500,
      financialStatus: FINANCIAL_STATUS.PARTIAL_RETURN,
    });
  });
});

describe("validateNewReturnAmount - segurança de devolução", () => {
  it("aceita uma devolução dentro do limite", () => {
    const result = validateNewReturnAmount({ amount: 2000, grossSale: 10000, existingReturnsTotal: 0 });
    expect(result).toEqual({ ok: true, amount: 2000 });
  });

  it("aceita quando o total exato bate com a venda (devolução total)", () => {
    const result = validateNewReturnAmount({ amount: 10000, grossSale: 10000, existingReturnsTotal: 0 });
    expect(result.ok).toBe(true);
  });

  it("rejeita quando o total ultrapassaria a venda original", () => {
    const result = validateNewReturnAmount({ amount: 1, grossSale: 10000, existingReturnsTotal: 10000 });
    expect(result.ok).toBe(false);
  });

  it("acumula devoluções anteriores antes de checar o limite (10k -> 2k -> +1.5k = 3.5k, dentro do limite)", () => {
    const result = validateNewReturnAmount({ amount: 1500, grossSale: 10000, existingReturnsTotal: 2000 });
    expect(result).toEqual({ ok: true, amount: 1500 });
  });

  it("rejeita valor zero", () => {
    expect(validateNewReturnAmount({ amount: 0, grossSale: 10000, existingReturnsTotal: 0 }).ok).toBe(false);
  });

  it("rejeita valor negativo", () => {
    expect(validateNewReturnAmount({ amount: -500, grossSale: 10000, existingReturnsTotal: 0 }).ok).toBe(false);
  });

  it("rejeita quando o lead não tem venda registrada (sale_amount ausente)", () => {
    expect(validateNewReturnAmount({ amount: 100, grossSale: null, existingReturnsTotal: 0 }).ok).toBe(false);
    expect(validateNewReturnAmount({ amount: 100, grossSale: 0, existingReturnsTotal: 0 }).ok).toBe(false);
  });

  it("documenta por que o backend precisa de FOR UPDATE: validar contra o MESMO snapshot desatualizado deixaria duas devoluções concorrentes passarem juntas", () => {
    // Simula duas requisições concorrentes de R$ 6.000 cada, para uma venda de R$ 10.000, as
    // duas lendo "existingReturnsTotal = 0" (o snapshot ANTES de qualquer uma commitar) - sem o
    // lock de linha (FOR UPDATE) usado em Backend.js/salesReturnsStore.js, as duas passariam
    // nesta validação pura porque nenhuma delas via a outra ainda. Isso é exatamente por que o
    // registro real (não este teste) tem que rodar dentro de uma transação com lock: a segunda
    // chamada só pode enxergar o resultado da primeira DEPOIS que ela commitar.
    const staleSnapshot = { grossSale: 10000, existingReturnsTotal: 0 };
    const first = validateNewReturnAmount({ amount: 6000, ...staleSnapshot });
    const second = validateNewReturnAmount({ amount: 6000, ...staleSnapshot });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true); // ambas passam contra o MESMO snapshot - a race condition real
    expect(first.amount + second.amount).toBeGreaterThan(staleSnapshot.grossSale); // 12.000 > 10.000: por isso o lock é obrigatório

    // Com o snapshot ATUALIZADO (como o FOR UPDATE garante na prática, a segunda leitura só
    // acontece depois da primeira commitar), a segunda devolução é corretamente rejeitada.
    const secondWithUpdatedSnapshot = validateNewReturnAmount({ amount: 6000, grossSale: 10000, existingReturnsTotal: 6000 });
    expect(secondWithUpdatedSnapshot.ok).toBe(false);
  });

  it("nunca lança para entrada inesperada", () => {
    expect(() => validateNewReturnAmount({ amount: "abc", grossSale: 10000, existingReturnsTotal: 0 })).not.toThrow();
    expect(() => validateNewReturnAmount({})).not.toThrow();
  });
});
