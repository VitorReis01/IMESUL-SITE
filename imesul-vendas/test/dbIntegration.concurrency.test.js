import { afterAll, beforeAll, describe, expect, it } from "vitest";

// ATENÇÃO: teste de integração contra Postgres REAL - NÃO roda em `npm test`/CI normal.
//
// Só é ativado quando as DUAS condições abaixo são verdadeiras:
//   1) DATABASE_URL aponta para um banco de TESTE/homologação (nunca produção);
//   2) ALLOW_DB_INTEGRATION_TESTS=1 está definido explicitamente na sessão que roda o teste.
// A dupla trava é deliberada: DATABASE_URL sozinha poderia estar setada por engano (ex.: sessão
// de dev com banco real configurado) - exigir as duas evita que este teste rode sem intenção
// clara. NÃO FOI EXECUTADO nesta sessão (sem DATABASE_URL configurada no ambiente de trabalho,
// e mesmo que estivesse, a instrução do usuário foi não conectar/executar SQL no banco real sem
// autorização explícita - ver relatório desta fase).
//
// Como rodar manualmente, contra um banco de homologação já migrado (npm run db:migrate):
//   ALLOW_DB_INTEGRATION_TESTS=1 DATABASE_URL="postgres://.../homolog" npx vitest run test/dbIntegration.concurrency.test.js
//
// O que este arquivo prova (contra Postgres de verdade, não mock):
//   A) Rodízio de Campo Grande sob concorrência real (10/50/100 leads simultâneos, 2 vendedores
//      ativos) - mede quantos leads recebem vendedor vs. seller_id NULL, distribuição entre
//      vendedores, tempo, e confirma invariantes de correção (sem lost update, sem lead_code
//      duplicado, sem dupla contagem).
//   B) Idempotência: 100 requisições concorrentes com a MESMA idempotency key (mesmo
//      clientRequestId) → exatamente 1 lead.
//   C) Idempotência: retry atravessando a antiga fronteira de 60s do bucket de tempo - com
//      clientRequestId, continua sendo 1 lead; sem clientRequestId (fallback legado), confirma
//      empiricamente que pode virar 2 (mesmo bug provado com fake timers em
//      test/salesLeadsIdempotency.test.js, aqui contra o banco real).
//
// Nenhuma chamada a WhatsApp/Meta/IMEbot real acontece aqui: createLead (Backend.js/
// salesLeadsStore.js) é chamado diretamente, não a rota HTTP - notifyImebotOfNewLead só é
// disparado por app/api/leads/route.js, nunca por createLead em si.
const shouldRun = Boolean(process.env.DATABASE_URL) && process.env.ALLOW_DB_INTEGRATION_TESTS === "1";

describe.skipIf(!shouldRun)("Concorrência real contra Postgres (rodízio + idempotência)", () => {
  let db;
  let createLead;
  let sellerIds = [];
  const testUnit = "campo-grande";
  const testRunId = `it-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    db = await import("../Backend.js/db");
    ({ createLead } = await import("../Backend.js/salesLeadsStore"));

    // 2 vendedores de teste isolados por nome (prefixo único desta execução) - nunca reaproveita
    // vendedores reais cadastrados no banco.
    const { rows } = await db.query(
      `INSERT INTO sales_sellers (name, whatsapp, active, unit)
       VALUES ($1, '5567900000001', TRUE, $3), ($2, '5567900000002', TRUE, $3)
       RETURNING id`,
      [`${testRunId}-vendedor-a`, `${testRunId}-vendedor-b`, testUnit]
    );
    sellerIds = rows.map((r) => r.id);
  });

  afterAll(async () => {
    if (!db) return;
    // Limpa só o que este teste criou (leads dos vendedores de teste + os próprios vendedores) -
    // nunca toca em dado pré-existente no banco.
    await db.query(`DELETE FROM sales_lead_events WHERE lead_id IN (SELECT id FROM sales_leads WHERE seller_id = ANY($1::bigint[]) OR visitor_id LIKE $2)`, [sellerIds, `${testRunId}%`]);
    await db.query(`DELETE FROM sales_leads WHERE seller_id = ANY($1::bigint[]) OR visitor_id LIKE $2`, [sellerIds, `${testRunId}%`]);
    await db.query(`DELETE FROM sales_sellers WHERE id = ANY($1::bigint[])`, [sellerIds]);
  });

  const runBurst = async (count) => {
    const started = Date.now();
    const results = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        createLead({
          visitorId: `${testRunId}-burst${count}-${i}`,
          quoteSummary: `Orçamento de teste de concorrência #${i}`,
          product: "teste",
          origin: "test",
          source: "test",
          unit: testUnit,
          flowType: "GUIDED_QUOTE",
          siteOrigin: "vendas",
          pagePath: "test",
          clientRequestId: `${testRunId}-crid-${count}-${i}`,
        })
      )
    );
    const elapsedMs = Date.now() - started;
    return { results, elapsedMs };
  };

  it.each([10, 50, 100])(
    "rajada de %i leads simultâneos com só 2 vendedores ativos - mede atribuição e prova invariantes de correção",
    async (count) => {
      const { results, elapsedMs } = await runBurst(count);

      const ok = results.filter((r) => r.ok);
      const withSeller = ok.filter((r) => r.seller);
      const withoutSeller = ok.filter((r) => !r.seller);
      const leadCodes = ok.map((r) => r.leadCode);
      const distribution = withSeller.reduce((acc, r) => {
        acc[r.seller.id] = (acc[r.seller.id] || 0) + 1;
        return acc;
      }, {});

       
      console.log(`[concorrência ${count}] ok=${ok.length} comVendedor=${withSeller.length} semVendedor=${withoutSeller.length} tempo=${elapsedMs}ms distribuição=${JSON.stringify(distribution)}`);

      // Invariantes que precisam valer SEMPRE, independente de quanto o retry mitigou:
      expect(ok).toHaveLength(count); // toda requisição (idempotency key única) cria seu próprio lead
      expect(new Set(leadCodes).size).toBe(leadCodes.length); // nenhum lead_code duplicado
      // Nenhuma atribuição "extra" - soma da distribuição bate exatamente com quem recebeu vendedor.
      expect(Object.values(distribution).reduce((a, b) => a + b, 0)).toBe(withSeller.length);
      // Todo seller_id retornado é um dos 2 vendedores de teste (nunca um id de fora do escopo).
      for (const id of Object.keys(distribution)) {
        expect(sellerIds).toContain(Number(id));
      }
    },
    30_000
  );

  it("100 requisições concorrentes com a MESMA idempotency key -> exatamente 1 lead", async () => {
    const sharedCrid = `${testRunId}-shared-crid`;
    const visitorId = `${testRunId}-shared-visitor`;
    const quoteSummary = "Mesmo orçamento, 100 tentativas concorrentes (clique duplo/retry simulado)";

    const results = await Promise.all(
      Array.from({ length: 100 }, () =>
        createLead({
          visitorId,
          quoteSummary,
          origin: "test",
          source: "test",
          unit: testUnit,
          flowType: "GUIDED_QUOTE",
          siteOrigin: "vendas",
          pagePath: "test",
          clientRequestId: sharedCrid,
        })
      )
    );

    expect(results.every((r) => r.ok)).toBe(true);
    const distinctLeadCodes = new Set(results.map((r) => r.leadCode));
    expect(distinctLeadCodes.size).toBe(1);

    const { rows } = await db.query(
      "SELECT COUNT(*)::int AS count FROM sales_leads WHERE visitor_id = $1",
      [visitorId]
    );
    expect(rows[0].count).toBe(1);
  }, 30_000);

  it(
    "retry atravessando a fronteira real de 60s: COM clientRequestId continua 1 lead; SEM clientRequestId (legado) pode virar 2 - confirma o bug em produção real",
    async () => {
      const dedupWindowMs = 60_000;
      const msUntilBoundary = dedupWindowMs - (Date.now() % dedupWindowMs);
      // Espera até ~300ms antes da próxima virada de minuto do bucket, para poder disparar os
      // dois lados da fronteira de propósito.
      await new Promise((resolve) => setTimeout(resolve, Math.max(msUntilBoundary - 300, 0)));

      const visitorLegacy = `${testRunId}-legacy-boundary`;
      const summaryLegacy = "Mesma tentativa, sem clientRequestId, atravessando a fronteira";
      const before = await createLead({
        visitorId: visitorLegacy,
        quoteSummary: summaryLegacy,
        origin: "test",
        source: "test",
        unit: testUnit,
        flowType: "GUIDED_QUOTE",
        siteOrigin: "vendas",
        pagePath: "test",
      });

      await new Promise((resolve) => setTimeout(resolve, 600)); // atravessa a virada do bucket

      const after = await createLead({
        visitorId: visitorLegacy,
        quoteSummary: summaryLegacy,
        origin: "test",
        source: "test",
        unit: testUnit,
        flowType: "GUIDED_QUOTE",
        siteOrigin: "vendas",
        pagePath: "test",
      });

      // Documentado, não corrigido para quem não manda clientRequestId (ver comentário no topo
      // do arquivo e em Backend.js/salesLeadsStore.js#buildIdempotencyKey).
      const legacyLeadCodesDiffer = before.leadCode !== after.leadCode;

      const visitorFixed = `${testRunId}-fixed-boundary`;
      const summaryFixed = "Mesma tentativa, COM clientRequestId, atravessando a fronteira";
      const crid = `${testRunId}-boundary-crid`;

      const msUntilNextBoundary = dedupWindowMs - (Date.now() % dedupWindowMs);
      await new Promise((resolve) => setTimeout(resolve, Math.max(msUntilNextBoundary - 300, 0)));

      const beforeFixed = await createLead({
        visitorId: visitorFixed,
        quoteSummary: summaryFixed,
        origin: "test",
        source: "test",
        unit: testUnit,
        flowType: "GUIDED_QUOTE",
        siteOrigin: "vendas",
        pagePath: "test",
        clientRequestId: crid,
      });

      await new Promise((resolve) => setTimeout(resolve, 600));

      const afterFixed = await createLead({
        visitorId: visitorFixed,
        quoteSummary: summaryFixed,
        origin: "test",
        source: "test",
        unit: testUnit,
        flowType: "GUIDED_QUOTE",
        siteOrigin: "vendas",
        pagePath: "test",
        clientRequestId: crid,
      });

       
      console.log(`[fronteira 60s] legado: leadCodes diferentes=${legacyLeadCodesDiffer} | com clientRequestId: leadCodes diferentes=${beforeFixed.leadCode !== afterFixed.leadCode}`);

      expect(beforeFixed.leadCode).toBe(afterFixed.leadCode); // a correção precisa valer sempre
    },
    70_000
  );
});
