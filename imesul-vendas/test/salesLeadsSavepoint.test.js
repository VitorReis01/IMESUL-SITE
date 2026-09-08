import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Regressão do bug encontrado numa rodada de teste de carga: sem SAVEPOINT em volta de cada
// tentativa de INSERT em Backend.js/salesLeadsStore.js#createLead, um erro 23505 (unique_violation
// - colisão de idempotency_key OU de lead_code) deixava a transação INTEIRA em estado "aborted".
// Qualquer instrução seguinte na MESMA transação (inclusive a busca pelo lead concorrente, que é
// exatamente o que deveria tratar essa colisão) falhava com "current transaction is aborted,
// commands ignored until end of transaction block" - mascarando o erro real e quebrando o próprio
// tratamento de corrida concorrente de idempotency_key, fazendo o request perdedor devolver
// {ok:false} (503) em vez do lead já criado pela requisição concorrente vencedora.
//
// Testado aqui contra o caminho LEGADO (sem unit/fora de campo-grande) - a rodada seguinte
// (correção do gargalo do rodízio) removeu o SAVEPOINT do caminho de Campo Grande, porque o
// acoplamento lock-do-cursor+dedup na mesma instrução (ver
// sellerRotationStore.js#lockAndPickRotationCandidate) já torna uma colisão de idempotency_key
// ali praticamente inatingível - o cenário de bug original só continua existindo de verdade no
// caminho legado, que não tem esse lock. Ver test/salesLeadsRodizio.test.js para a confirmação de
// que o caminho de Campo Grande nunca emite SAVEPOINT.
describe("createLead - SAVEPOINT em volta do INSERT (regressão, caminho legado)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("../Backend.js/db");
    vi.doUnmock("../Backend.js/imebotStore");
  });

  it("colisão de idempotency_key durante o INSERT usa SAVEPOINT antes de buscar o lead concorrente - nunca deixa a transação abortada", async () => {
    vi.doMock("../Backend.js/imebotStore", () => ({ recordLeadEvent: vi.fn(async () => {}) }));

    const calls = [];
    let insertAttempted = false;

    const fakeClient = {
      query: vi.fn(async (sql) => {
        const text = String(sql);
        calls.push(text.trim().split("\n")[0].trim());

        if (text.includes("SELECT last_seller_id")) return { rows: [{ last_seller_id: null }] };
        if (text.includes("SELECT id, name, whatsapp FROM sales_sellers")) return { rows: [{ id: 7, name: "Vendedor Teste", whatsapp: "5567900000000" }] };

        if (text.startsWith("SAVEPOINT")) return { rows: [] };
        if (text.startsWith("ROLLBACK TO SAVEPOINT")) return { rows: [] };
        if (text.startsWith("RELEASE SAVEPOINT")) return { rows: [] };

        if (text.startsWith("INSERT INTO sales_leads")) {
          if (!insertAttempted) {
            insertAttempted = true;
            const err = new Error('duplicate key value violates unique constraint "sales_leads_idempotency_key_key"');
            err.code = "23505";
            err.constraint = "sales_leads_idempotency_key_key";
            throw err;
          }
          // Nunca deveria chegar numa segunda tentativa neste cenário - a busca pelo lead
          // concorrente deveria interceptar e devolver antes disso.
          return { rows: [{ id: 999, lead_code: "IMESUL-NAO-DEVERIA-ACONTECER" }] };
        }

        if (text.includes("SELECT sl.id, sl.lead_code")) {
          if (!insertAttempted) return { rows: [] };
          // Busca do lead concorrente (findLeadByIdempotencyKey com client) - só funciona se a
          // transação NÃO estiver abortada nesse ponto (ou seja, só se o ROLLBACK TO SAVEPOINT
          // já tiver rodado antes desta chamada).
          return {
            rows: [
              {
                id: 42,
                lead_code: "IMESUL-WINNER",
                seller_id: 7,
                unit: "campo-grande",
                flow_type: "GUIDED_QUOTE",
                seller_name: "Vendedor Teste",
                seller_whatsapp: "5567900000000",
              },
            ],
          };
        }

        return { rows: [] };
      }),
    };

    const outerQuery = vi.fn(async (sql) => {
      const text = String(sql);
      if (text.includes("SELECT sl.id, sl.lead_code")) return { rows: [] }; // dedup antes da transação: nada ainda
      if (text.includes("FOR UPDATE SKIP LOCKED")) return { rows: [{ id: 7, name: "Vendedor Teste", whatsapp: "5567900000000" }] };
      return { rows: [] };
    });

    const withTransaction = vi.fn(async (callback) => callback(fakeClient));

    vi.doMock("../Backend.js/db", () => ({
      isDatabaseConfigured: () => true,
      query: outerQuery,
      withTransaction,
    }));

    const { createLead } = await import("../Backend.js/salesLeadsStore");

    const result = await createLead({
      visitorId: "visitor-1",
      quoteSummary: "teste savepoint",
      flowType: "GUIDED_QUOTE",
      clientRequestId: "regressao-savepoint-crid",
    });

    // Resultado correto: devolve o lead da requisição CONCORRENTE vencedora - nunca {ok:false}.
    expect(result).toEqual(
      expect.objectContaining({ ok: true, leadCode: "IMESUL-WINNER", deduped: true })
    );

    // Sequência exigida na mesma transação: SAVEPOINT -> INSERT (falha 23505) ->
    // ROLLBACK TO SAVEPOINT -> RELEASE SAVEPOINT -> SELECT (busca do concorrente). Sem o
    // ROLLBACK TO SAVEPOINT ANTES do SELECT, o Postgres real rejeitaria esse SELECT com
    // "current transaction is aborted" - este teste garante que o código sempre emite o
    // ROLLBACK TO SAVEPOINT antes de qualquer outra instrução na transação.
    const savepointIndex = calls.findIndex((c) => c.startsWith("SAVEPOINT"));
    const insertIndex = calls.findIndex((c) => c.startsWith("INSERT INTO sales_leads"));
    const rollbackToIndex = calls.findIndex((c) => c.startsWith("ROLLBACK TO SAVEPOINT"));
    const selectConcurrentIndex = calls.findIndex((c, index) => index > rollbackToIndex && c.includes("SELECT sl.id, sl.lead_code"));

    expect(savepointIndex).toBeGreaterThanOrEqual(0);
    expect(insertIndex).toBeGreaterThan(savepointIndex);
    expect(rollbackToIndex).toBeGreaterThan(insertIndex);
    expect(selectConcurrentIndex).toBeGreaterThan(rollbackToIndex);

    // A segunda tentativa de INSERT nunca deveria ter rodado (a busca pelo concorrente já
    // resolveu e retornou antes disso).
    const insertCalls = calls.filter((c) => c.startsWith("INSERT INTO sales_leads"));
    expect(insertCalls).toHaveLength(1);
  });

  it("colisão de lead_code (não idempotency_key) também usa SAVEPOINT e consegue tentar de novo com sucesso", async () => {
    vi.doMock("../Backend.js/imebotStore", () => ({ recordLeadEvent: vi.fn(async () => {}) }));

    const calls = [];
    let insertAttempts = 0;

    const fakeClient = {
      query: vi.fn(async (sql) => {
        const text = String(sql);
        calls.push(text.trim().split("\n")[0].trim());

        if (text.includes("SELECT last_seller_id")) return { rows: [{ last_seller_id: null }] };
        if (text.includes("SELECT id, name, whatsapp FROM sales_sellers")) return { rows: [{ id: 7, name: "Vendedor Teste", whatsapp: "5567900000000" }] };

        if (text.startsWith("SAVEPOINT")) return { rows: [] };
        if (text.startsWith("ROLLBACK TO SAVEPOINT")) return { rows: [] };
        if (text.startsWith("RELEASE SAVEPOINT")) return { rows: [] };

        if (text.startsWith("INSERT INTO sales_leads")) {
          insertAttempts += 1;
          if (insertAttempts === 1) {
            const err = new Error('duplicate key value violates unique constraint "sales_leads_lead_code_key"');
            err.code = "23505";
            err.constraint = "sales_leads_lead_code_key";
            throw err;
          }
          return { rows: [{ id: 100, lead_code: "IMESUL-SEGUNDA-TENTATIVA" }] };
        }

        return { rows: [] };
      }),
    };

    const outerQuery = vi.fn(async (sql) => {
      const text = String(sql);
      if (text.includes("SELECT sl.id, sl.lead_code")) return { rows: [] };
      if (text.includes("FOR UPDATE SKIP LOCKED")) return { rows: [{ id: 7, name: "Vendedor Teste", whatsapp: "5567900000000" }] };
      return { rows: [] };
    });

    const withTransaction = vi.fn(async (callback) => callback(fakeClient));

    vi.doMock("../Backend.js/db", () => ({
      isDatabaseConfigured: () => true,
      query: outerQuery,
      withTransaction,
    }));

    const { createLead } = await import("../Backend.js/salesLeadsStore");

    const result = await createLead({
      visitorId: "visitor-2",
      quoteSummary: "teste savepoint lead_code",
      flowType: "GUIDED_QUOTE",
      clientRequestId: "regressao-savepoint-crid-2",
    });

    expect(result).toEqual(expect.objectContaining({ ok: true, leadCode: "IMESUL-SEGUNDA-TENTATIVA" }));
    expect(insertAttempts).toBe(2); // 1ª colidiu, 2ª (com novo lead_code) funcionou - só possível com SAVEPOINT
  });
});
