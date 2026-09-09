import { describe, expect, it, vi } from "vitest";
import { readJsonBodyWithLimit, readRawBodyWithLimit } from "../Backend.js/requestGuards";

// Requisicao minima o bastante para exercitar readRawBodyWithLimit/readJsonBodyWithLimit sem
// depender de um servidor HTTP real - controla Content-Length e os bytes reais do stream de
// forma INDEPENDENTE, exatamente para reproduzir o achado da auditoria FULL-SCOPE: um cliente
// pode omitir/mentir sobre Content-Length (ex.: Transfer-Encoding: chunked) e ainda assim enviar
// um corpo maior que o limite pretendido - so a contagem real de bytes do stream pega isso.
const makeRequest = ({ contentLength, chunks = [] } = {}) => {
  let index = 0;
  const cancel = vi.fn(async () => {});

  return {
    headers: {
      get: (name) => (name.toLowerCase() === "content-length" ? (contentLength ?? null) : null),
    },
    body: {
      getReader: () => ({
        read: async () => {
          if (index < chunks.length) {
            const value = chunks[index];
            index += 1;
            return { done: false, value };
          }
          return { done: true, value: undefined };
        },
        cancel,
      }),
    },
    __cancel: cancel,
  };
};

const bytes = (text) => new TextEncoder().encode(text);

describe("readJsonBodyWithLimit", () => {
  it("body abaixo do limite: JSON válido é parseado normalmente", async () => {
    const json = JSON.stringify({ a: 1, b: "ok" });
    const request = makeRequest({ contentLength: String(bytes(json).length), chunks: [bytes(json)] });

    const result = await readJsonBodyWithLimit(request, 1_000);

    expect(result).toEqual({ status: "ok", body: { a: 1, b: "ok" } });
  });

  it("body exatamente no limite: continua aceito (limite é inclusivo)", async () => {
    const json = JSON.stringify({ value: "x".repeat(90) }); // tamanho controlado abaixo
    const exactSize = bytes(json).length;
    const request = makeRequest({ contentLength: String(exactSize), chunks: [bytes(json)] });

    const result = await readJsonBodyWithLimit(request, exactSize);

    expect(result.status).toBe("ok");
    expect(result.body.value).toHaveLength(90);
  });

  it("body acima do limite, COM Content-Length correto: rejeitado antecipadamente, nunca lê o stream", async () => {
    const request = makeRequest({ contentLength: "50000", chunks: [] });
    // Nao deveria nem chamar getReader() - o corte antecipado por Content-Length acontece antes.
    const getReaderSpy = vi.spyOn(request.body, "getReader");

    const result = await readJsonBodyWithLimit(request, 1_000);

    expect(result).toEqual({ status: "too_large" });
    expect(getReaderSpy).not.toHaveBeenCalled();
  });

  it("body acima do limite, SEM Content-Length (simula chunked/streaming): detectado pela contagem real de bytes do stream", async () => {
    // Content-Length ausente (null) - exatamente o cenario que contornava o corte antigo
    // (Number(null) === 0, nunca > maxBytes). O corpo real, porem, excede o limite.
    const bigChunk = bytes("x".repeat(2_000));
    const request = makeRequest({ contentLength: null, chunks: [bigChunk] });

    const result = await readJsonBodyWithLimit(request, 1_000);

    expect(result).toEqual({ status: "too_large" });
    expect(request.__cancel).toHaveBeenCalledTimes(1);
  });

  it("body acima do limite, distribuído em múltiplos chunks do stream (soma ultrapassa o limite)", async () => {
    const request = makeRequest({
      contentLength: null,
      chunks: [bytes("x".repeat(600)), bytes("y".repeat(600))], // soma = 1200 > limite de 1000
    });

    const result = await readJsonBodyWithLimit(request, 1_000);

    expect(result).toEqual({ status: "too_large" });
  });

  it("JSON inválido dentro do limite: invalid_json", async () => {
    const raw = "isto não é json";
    const request = makeRequest({ contentLength: String(bytes(raw).length), chunks: [bytes(raw)] });

    const result = await readJsonBodyWithLimit(request, 1_000);

    expect(result).toEqual({ status: "invalid_json" });
  });

  it("corpo vazio: invalid_json (nunca 'ok' com body undefined)", async () => {
    const request = makeRequest({ contentLength: "0", chunks: [] });

    const result = await readJsonBodyWithLimit(request, 1_000);

    expect(result).toEqual({ status: "invalid_json" });
  });
});

describe("readRawBodyWithLimit (usado pelo webhook do Meta - precisa dos bytes crus para o HMAC)", () => {
  it("retorna o texto cru dentro do limite, sem tentar fazer parse de JSON", async () => {
    const raw = "corpo=qualquer&coisa=nao-json";
    const request = makeRequest({ contentLength: String(bytes(raw).length), chunks: [bytes(raw)] });

    const result = await readRawBodyWithLimit(request, 1_000);

    expect(result).toEqual({ status: "ok", raw });
  });

  it("body acima do limite via chunked (sem Content-Length): too_large, mesmo sendo texto cru", async () => {
    const request = makeRequest({ contentLength: null, chunks: [bytes("z".repeat(2_000_000))] });

    const result = await readRawBodyWithLimit(request, 1_000_000);

    expect(result).toEqual({ status: "too_large" });
  });
});
