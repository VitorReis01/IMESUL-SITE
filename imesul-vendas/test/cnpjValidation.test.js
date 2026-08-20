import { describe, expect, it } from "vitest";
import { formatCnpj, normalizeCnpj, validateCnpj } from "../lib/cnpjValidation";

// CNPJs reais válidos (dígitos verificadores corretos) usados só como fixture matemática de
// teste - nunca consultados em nenhuma API, nunca usados para inventar razão social.
const validCnpj = "11222333000181"; // CNPJ de teste amplamente conhecido/público, matematicamente válido

describe("normalizeCnpj", () => {
  it("remove pontuação e mantém só dígitos", () => {
    expect(normalizeCnpj("12.345.678/0001-95")).toBe("12345678000195");
  });

  it("nunca lança para entrada inesperada", () => {
    expect(() => normalizeCnpj(null)).not.toThrow();
    expect(() => normalizeCnpj(undefined)).not.toThrow();
    expect(normalizeCnpj(null)).toBe("");
  });
});

describe("validateCnpj", () => {
  it("aceita um CNPJ válido sem formatação", () => {
    expect(validateCnpj(validCnpj)).toEqual({ ok: true, cnpj: validCnpj });
  });

  it("aceita o mesmo CNPJ formatado (normaliza antes de validar)", () => {
    expect(validateCnpj("11.222.333/0001-81")).toEqual({ ok: true, cnpj: validCnpj });
  });

  it("rejeita CNPJ com dígito verificador incorreto", () => {
    expect(validateCnpj("11222333000199").ok).toBe(false);
  });

  it("rejeita CNPJ com menos de 14 dígitos", () => {
    expect(validateCnpj("1122233300018").ok).toBe(false);
  });

  it("rejeita CNPJ com mais de 14 dígitos", () => {
    expect(validateCnpj("112223330001811").ok).toBe(false);
  });

  it("rejeita sequência de dígitos repetidos (obviamente inválido)", () => {
    expect(validateCnpj("00000000000000").ok).toBe(false);
    expect(validateCnpj("11111111111111").ok).toBe(false);
  });

  it("rejeita vazio/não informado", () => {
    expect(validateCnpj("").ok).toBe(false);
    expect(validateCnpj(null).ok).toBe(false);
    expect(validateCnpj(undefined).ok).toBe(false);
  });

  it("nunca lança para entrada maliciosa/inesperada", () => {
    expect(() => validateCnpj("<script>alert(1)</script>")).not.toThrow();
    expect(() => validateCnpj(12345)).not.toThrow();
  });
});

describe("formatCnpj", () => {
  it("formata um CNPJ normalizado para exibição", () => {
    expect(formatCnpj(validCnpj)).toBe("11.222.333/0001-81");
  });
});
