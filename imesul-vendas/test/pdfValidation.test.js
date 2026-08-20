import { describe, expect, it } from "vitest";
import {
  buildLeadPdfRelativePath,
  hasValidPdfMagicBytes,
  isPdfSizeValid,
  isRelativePathSafe,
  maxPdfSizeBytes,
  sanitizeFileNameSegment,
} from "../lib/pdfValidation";

describe("hasValidPdfMagicBytes", () => {
  it("aceita bytes reais de PDF (%PDF)", () => {
    expect(hasValidPdfMagicBytes(Buffer.from("%PDF-1.7 resto do arquivo"))).toBe(true);
  });

  it("rejeita um .exe renomeado para .pdf (magic bytes MZ)", () => {
    expect(hasValidPdfMagicBytes(Buffer.from([0x4d, 0x5a, 0x90, 0x00]))).toBe(false);
  });

  it("rejeita um PNG renomeado para .pdf", () => {
    expect(hasValidPdfMagicBytes(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
  });

  it("rejeita arquivo vazio ou curto demais", () => {
    expect(hasValidPdfMagicBytes(Buffer.from([]))).toBe(false);
    expect(hasValidPdfMagicBytes(Buffer.from([0x25, 0x50]))).toBe(false);
  });

  it("nunca lança para entrada inesperada", () => {
    expect(() => hasValidPdfMagicBytes(null)).not.toThrow();
    expect(() => hasValidPdfMagicBytes(undefined)).not.toThrow();
  });
});

describe("isPdfSizeValid", () => {
  it("aceita tamanhos dentro do limite", () => {
    expect(isPdfSizeValid(1024)).toBe(true);
    expect(isPdfSizeValid(maxPdfSizeBytes)).toBe(true);
  });

  it("rejeita arquivo grande demais (acima do limite)", () => {
    expect(isPdfSizeValid(maxPdfSizeBytes + 1)).toBe(false);
  });

  it("rejeita tamanho zero, negativo ou não numérico", () => {
    expect(isPdfSizeValid(0)).toBe(false);
    expect(isPdfSizeValid(-10)).toBe(false);
    expect(isPdfSizeValid(NaN)).toBe(false);
    expect(isPdfSizeValid("1000")).toBe(false);
  });
});

describe("isRelativePathSafe - proteção contra path traversal", () => {
  it("aceita um caminho relativo bem formado", () => {
    expect(isRelativePathSafe("2026/08/IMESUL-ABC12345/ORCAMENTO_JOAO.pdf")).toBe(true);
  });

  it("rejeita '..' em qualquer posição", () => {
    expect(isRelativePathSafe("../../etc/passwd")).toBe(false);
    expect(isRelativePathSafe("2026/../08/arquivo.pdf")).toBe(false);
    expect(isRelativePathSafe("2026\\..\\08\\arquivo.pdf")).toBe(false);
  });

  it("rejeita barra/barra invertida inicial (caminho absoluto unix/windows)", () => {
    expect(isRelativePathSafe("/etc/passwd")).toBe(false);
    expect(isRelativePathSafe("\\Windows\\System32")).toBe(false);
  });

  it("rejeita letra de drive (C:, D:, Y:)", () => {
    expect(isRelativePathSafe("Y:\\ORC-SITE-IMESUL\\arquivo.pdf")).toBe(false);
    expect(isRelativePathSafe("C:/arquivo.pdf")).toBe(false);
  });

  it("rejeita caminho UNC (\\\\servidor\\...)", () => {
    expect(isRelativePathSafe("\\\\192.168.0.8\\erp\\arquivo.pdf")).toBe(false);
  });

  it("rejeita vazio/não-string", () => {
    expect(isRelativePathSafe("")).toBe(false);
    expect(isRelativePathSafe("   ")).toBe(false);
    expect(isRelativePathSafe(null)).toBe(false);
    expect(isRelativePathSafe(undefined)).toBe(false);
  });
});

describe("sanitizeFileNameSegment", () => {
  it("remove acentos e caracteres especiais", () => {
    expect(sanitizeFileNameSegment("João da Silva Ção!!")).toBe("Joao_da_Silva_Cao");
  });

  it("nunca deixa o segmento vazio", () => {
    expect(sanitizeFileNameSegment("")).toBe("ARQUIVO");
    expect(sanitizeFileNameSegment("///...")).toBe("ARQUIVO");
  });

  it("nunca permite '..' sobreviver no resultado", () => {
    const result = sanitizeFileNameSegment("../../etc/passwd");
    expect(result).not.toMatch(/\.\./);
  });
});

describe("buildLeadPdfRelativePath", () => {
  it("gera a estrutura oficial ANO/MES/LEAD-ID/ORCAMENTO_NOME.pdf", () => {
    const result = buildLeadPdfRelativePath({
      createdAt: new Date("2026-08-15T10:00:00Z"),
      leadCode: "IMESUL-ABC12345",
      customerName: "João Silva",
    });
    expect(result).toBe("2026/08/IMESUL_ABC12345/ORCAMENTO_Joao_Silva.pdf");
  });

  it("o resultado é sempre um caminho relativo seguro", () => {
    const result = buildLeadPdfRelativePath({
      createdAt: new Date("2026-01-05T10:00:00Z"),
      leadCode: "../../etc/passwd",
      customerName: "../../evil",
    });
    expect(isRelativePathSafe(result)).toBe(true);
  });
});
