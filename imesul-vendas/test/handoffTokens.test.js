import { describe, expect, it } from "vitest";
import { createHandoffToken, hashHandoffToken, safeCompareTokenHash } from "../lib/handoffTokens";

describe("handoff tokens", () => {
  it("gera token criptograficamente aleatório e opaco sem lead, telefone ou seller id", () => {
    const token = createHandoffToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(token).not.toContain("IMESUL");
    expect(token).not.toContain("5567");
    expect(token).not.toContain("seller");
    expect(token).not.toContain("lead");
  });

  it("nunca reutiliza token entre chamadas", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => createHandoffToken()));
    expect(tokens.size).toBe(100);
  });

  it("armazena e compara somente hash", () => {
    const token = createHandoffToken();
    const hash = hashHandoffToken(token);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toBe(token);
    expect(safeCompareTokenHash(token, hash)).toBe(true);
    expect(safeCompareTokenHash(`${token}x`, hash)).toBe(false);
  });

  it("falha de forma segura para hash vazio ou inválido", () => {
    const token = createHandoffToken();
    expect(safeCompareTokenHash(token, "")).toBe(false);
    expect(safeCompareTokenHash(token, "nao-e-hex")).toBe(false);
  });
});
