import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildIdempotencyKey } from "../Backend.js/salesLeadsStore";

// Cobre Backend.js/salesLeadsStore.js#buildIdempotencyKey: confirma o bug de borda do bucket de
// tempo no caminho legado (sem clientRequestId) e confirma que o caminho novo (com
// clientRequestId valido) nao tem essa borda, sem abrir mao de continuar isolando corretamente
// tentativas realmente diferentes. Pura funcao de hash - sem I/O, sem mock de banco necessario.
describe("buildIdempotencyKey", () => {
  const dedupWindowMs = 60_000;
  // Fronteira exata de um bucket, para testar os dois lados dela de proposito.
  const boundary = Math.ceil(1_700_000_000_000 / dedupWindowMs) * dedupWindowMs;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("BUG CONFIRMADO: sem clientRequestId, a mesma tentativa a poucos ms da fronteira do bucket gera chaves diferentes", () => {
    vi.setSystemTime(boundary - 2);
    const before = buildIdempotencyKey("visitor-1", "resumo do orcamento");

    vi.setSystemTime(boundary + 2);
    const after = buildIdempotencyKey("visitor-1", "resumo do orcamento");

    // Mesmo visitante, mesmo resumo, 4ms de diferenca - deveria ser a MESMA tentativa, mas o
    // bucket mudou e a chave muda junto. Documenta o comportamento legado, nao o corrige aqui
    // (so quem nao manda clientRequestId ainda passa por isso - ver teste seguinte).
    expect(before).not.toBe(after);
  });

  it("CORRIGIDO: com clientRequestId valido, a mesma tentativa atravessando a fronteira do bucket gera a MESMA chave", () => {
    const clientRequestId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

    vi.setSystemTime(boundary - 2);
    const before = buildIdempotencyKey("visitor-1", "resumo do orcamento", clientRequestId);

    vi.setSystemTime(boundary + 2);
    const after = buildIdempotencyKey("visitor-1", "resumo do orcamento", clientRequestId);

    expect(before).toBe(after);
  });

  it("clientRequestId invalido (curto demais) cai no fallback legado, sem quebrar", () => {
    vi.setSystemTime(boundary - 2);
    const withInvalidCrid = buildIdempotencyKey("visitor-1", "resumo do orcamento", "abc");
    const legacy = buildIdempotencyKey("visitor-1", "resumo do orcamento");

    expect(withInvalidCrid).toBe(legacy);
  });

  it("clientRequestId invalido (caracteres fora do padrao) cai no fallback legado", () => {
    vi.setSystemTime(boundary - 2);
    const withInvalidCrid = buildIdempotencyKey("visitor-1", "resumo do orcamento", "chave com espaço e acentuação!");
    const legacy = buildIdempotencyKey("visitor-1", "resumo do orcamento");

    expect(withInvalidCrid).toBe(legacy);
  });

  it("clientRequestId diferente para o mesmo visitante/resumo gera chaves diferentes (tentativas realmente distintas continuam isoladas)", () => {
    vi.setSystemTime(boundary - 2);
    const first = buildIdempotencyKey("visitor-1", "resumo do orcamento", "11111111-1111-1111-1111-111111111111");
    const second = buildIdempotencyKey("visitor-1", "resumo do orcamento", "22222222-2222-2222-2222-222222222222");

    expect(first).not.toBe(second);
  });

  it("mesmo clientRequestId para visitantes diferentes gera chaves diferentes (nunca cola dedup entre visitantes)", () => {
    const clientRequestId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
    const a = buildIdempotencyKey("visitor-a", "resumo do orcamento", clientRequestId);
    const b = buildIdempotencyKey("visitor-b", "resumo do orcamento", clientRequestId);

    expect(a).not.toBe(b);
  });
});
