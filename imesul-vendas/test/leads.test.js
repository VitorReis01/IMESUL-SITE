import { afterEach, describe, expect, it } from "vitest";
import { createLead } from "../lib/leads";

// Cobre a distinção AMBÍGUO vs DEFINITIVO em lib/leads.js#createLead, usada por
// lib/leadWhatsApp.js para decidir se uma tentativa seguinte deve reaproveitar o mesmo
// clientRequestId (timeout + novo clique não deve duplicar o lead) ou gerar um novo (resultado
// já confirmado, a próxima tentativa é uma tentativa nova de verdade).
describe("createLead (lib/leads.js) - ok vs ambiguous", () => {
  afterEach(() => {
    delete global.fetch;
  });

  it("sucesso (200, ok:true): ambiguous:false", async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ ok: true, leadCode: "IMESUL-TESTE", seller: { name: "Vendedor", whatsapp: "5567900000000" } }),
    });

    const result = await createLead({ visitorId: "v1", quoteSummary: "teste" });

    expect(result).toEqual({ ok: true, ambiguous: false, leadCode: "IMESUL-TESTE", seller: { name: "Vendedor", whatsapp: "5567900000000" } });
  });

  it("falha explícita do servidor (ex.: 429/503, corpo {ok:false} bem formado): ambiguous:false - sabemos que NÃO foi criado", async () => {
    global.fetch = async () => ({
      ok: false,
      json: async () => ({ ok: false, error: "Muitas solicitações." }),
    });

    const result = await createLead({ visitorId: "v1", quoteSummary: "teste" });

    expect(result).toEqual({ ok: false, ambiguous: false });
  });

  it("exceção de rede (fetch rejeita - timeout/conexão caiu ANTES de qualquer resposta): ambiguous:true", async () => {
    global.fetch = async () => {
      throw new Error("network error");
    };

    const result = await createLead({ visitorId: "v1", quoteSummary: "teste" });

    expect(result).toEqual({ ok: false, ambiguous: true });
  });

  it("resposta chegou mas o corpo não é JSON válido (conexão cortada no meio): ambiguous:true", async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    });

    const result = await createLead({ visitorId: "v1", quoteSummary: "teste" });

    expect(result).toEqual({ ok: false, ambiguous: true });
  });

  it("corpo é JSON válido mas sem campo `ok` booleano (formato inesperado): tratado como ambíguo, nunca como sucesso", async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ leadCode: "IMESUL-TESTE" }), // sem `ok`
    });

    const result = await createLead({ visitorId: "v1", quoteSummary: "teste" });

    expect(result).toEqual({ ok: false, ambiguous: true });
  });
});
