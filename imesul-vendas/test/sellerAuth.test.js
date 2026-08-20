import { describe, expect, it } from "vitest";
import { groupLeadsByCompanyCnpj, isActiveInternalSeller } from "../lib/sellerAuth";

describe("isActiveInternalSeller - vendedor vs cliente no webhook do IMEbot", () => {
  it("Felipe/Bruniely (ativos, campo-grande) são tratados como vendedor interno", () => {
    expect(isActiveInternalSeller({ active: true, unit: "campo-grande" })).toBe(true);
  });

  it("vendedor inativo é tratado como cliente (nunca aciona o menu funcional)", () => {
    expect(isActiveInternalSeller({ active: false, unit: "campo-grande" })).toBe(false);
  });

  it("vendedor de Dourados é tratado como cliente (IMEbot só atua em Campo Grande)", () => {
    expect(isActiveInternalSeller({ active: true, unit: "dourados" })).toBe(false);
  });

  it("telefone que não é de nenhum vendedor cadastrado (null) é tratado como cliente", () => {
    expect(isActiveInternalSeller(null)).toBe(false);
    expect(isActiveInternalSeller(undefined)).toBe(false);
  });
});

describe("groupLeadsByCompanyCnpj - consolida por CNPJ, nunca pelo texto do nome", () => {
  it("mesmo CNPJ com contatos diferentes consolida em um grupo só", () => {
    const leads = [
      { buyerType: "COMPANY", buyerCnpj: "11222333000181", buyerName: "Garcia's", contactName: "Márcio", sellerName: "Felipe", saleAmount: 8500 },
      { buyerType: "COMPANY", buyerCnpj: "11222333000181", buyerName: "Garcia's", contactName: "João", sellerName: "Felipe", saleAmount: 5000 },
    ];
    const groups = groupLeadsByCompanyCnpj(leads);
    expect(groups).toHaveLength(1);
    expect(groups[0].contacts.sort()).toEqual(["João", "Márcio"]);
    expect(groups[0].totalSales).toBe(2);
    expect(groups[0].grossSale).toBe(13500);
  });

  it("mesmo CNPJ com razão social digitada de formas diferentes ainda consolida (agrupa pelo CNPJ, não pelo nome)", () => {
    const leads = [
      { buyerType: "COMPANY", buyerCnpj: "11222333000181", buyerName: "Garcia's Materiais LTDA", contactName: "Márcio", saleAmount: 1000 },
      { buyerType: "COMPANY", buyerCnpj: "11222333000181", buyerName: "GARCIAS MATERIAIS", contactName: "Ana", saleAmount: 2000 },
    ];
    const groups = groupLeadsByCompanyCnpj(leads);
    expect(groups).toHaveLength(1);
    expect(groups[0].totalSales).toBe(2);
  });

  it("CNPJs diferentes nunca se misturam", () => {
    const leads = [
      { buyerType: "COMPANY", buyerCnpj: "11222333000181", buyerName: "Empresa A", contactName: "X", saleAmount: 100 },
      { buyerType: "COMPANY", buyerCnpj: "44555666000199", buyerName: "Empresa B", contactName: "Y", saleAmount: 200 },
    ];
    expect(groupLeadsByCompanyCnpj(leads)).toHaveLength(2);
  });

  it("leads de pessoa física (sem CNPJ) nunca entram em nenhum grupo de empresa", () => {
    const leads = [
      { buyerType: "PERSON", buyerCnpj: null, buyerName: "João Silva", contactName: "João", saleAmount: 500 },
    ];
    expect(groupLeadsByCompanyCnpj(leads)).toEqual([]);
  });

  it("nunca lança para lista vazia ou entrada inesperada", () => {
    expect(() => groupLeadsByCompanyCnpj([])).not.toThrow();
    expect(groupLeadsByCompanyCnpj([])).toEqual([]);
  });
});
