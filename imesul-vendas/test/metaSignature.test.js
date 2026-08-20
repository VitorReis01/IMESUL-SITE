import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyMetaSignature } from "../Backend.js/metaSignature";

const secret = "segredo-de-teste-nao-real";

describe("verifyMetaSignature", () => {
  const originalSecret = process.env.META_APP_SECRET;

  beforeEach(() => {
    process.env.META_APP_SECRET = secret;
  });

  afterEach(() => {
    process.env.META_APP_SECRET = originalSecret;
  });

  it("aceita uma assinatura válida", () => {
    const body = JSON.stringify({ hello: "world" });
    const signature = "sha256=" + createHmac("sha256", secret).update(body, "utf8").digest("hex");
    expect(verifyMetaSignature(body, signature)).toEqual({ ok: true });
  });

  it("rejeita uma assinatura incorreta", () => {
    const body = JSON.stringify({ hello: "world" });
    const wrongSignature = "sha256=" + "0".repeat(64);
    const result = verifyMetaSignature(body, wrongSignature);
    expect(result.ok).toBe(false);
  });

  it("rejeita quando o corpo foi alterado depois de assinado", () => {
    const originalBody = JSON.stringify({ amount: 100 });
    const tamperedBody = JSON.stringify({ amount: 100000 });
    const signature = "sha256=" + createHmac("sha256", secret).update(originalBody, "utf8").digest("hex");
    expect(verifyMetaSignature(tamperedBody, signature).ok).toBe(false);
  });

  it("rejeita header ausente", () => {
    expect(verifyMetaSignature("{}", "").ok).toBe(false);
    expect(verifyMetaSignature("{}", undefined).ok).toBe(false);
  });

  it("rejeita header em formato inválido (sem prefixo sha256=)", () => {
    expect(verifyMetaSignature("{}", "abcdef").ok).toBe(false);
  });

  it("rejeita hex malformado", () => {
    expect(verifyMetaSignature("{}", "sha256=nao-e-hex-valido").ok).toBe(false);
  });

  it("nunca lança mesmo com entrada maliciosa", () => {
    expect(() => verifyMetaSignature("{}", "sha256=" + "z".repeat(64))).not.toThrow();
    expect(() => verifyMetaSignature(null, null)).not.toThrow();
  });

  it("falha fechado quando META_APP_SECRET não está configurado", () => {
    delete process.env.META_APP_SECRET;
    const body = "{}";
    const signature = "sha256=" + createHmac("sha256", secret).update(body, "utf8").digest("hex");
    const result = verifyMetaSignature(body, signature);
    expect(result.ok).toBe(false);
  });
});
