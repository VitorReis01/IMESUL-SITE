import "server-only";
import { query } from "./db";

// HISTORICO DO GARGALO (para contexto, ver ROUND_ROBIN.md e CAPACITY_PLANNING.md para os numeros
// completos de cada rodada):
// - Original: 9 round-trips Node<->Supabase por lead (BEGIN + lock + dedup + escolha + SAVEPOINT
//   + INSERT + RELEASE + avanco + COMMIT), todos presos atras de UM lock global -> ~230ms/lead,
//   100 requisicoes simultaneas completavam so ~28 antes do connectionTimeoutMillis.
// - 1a otimizacao: reduziu para 5 round-trips (lock separado + dedup/escolha combinado +
//   insert/avanco combinado) -> ~85ms/lead, 100 simultaneas foram para 93/100 numa instancia, mas
//   2 instancias x 100 ainda dava 51% de erro (throughput serializado nao escala com instancias).
//
// CORRECAO ATUAL: a regiao critica inteira (dedup + lock do cursor + escolha do vendedor + INSERT
// + avanco do cursor) roda dentro de UMA FUNCAO PL/pgSQL server-side
// (campo_grande_create_lead, ver db/migrations/008_campo_grande_create_lead_function.sql) -
// 1 UNICA chamada Node<->Supabase, sem BEGIN/COMMIT explicito do lado do Node (a propria chamada
// de funcao ja e atomica). Dentro da funcao, cada comando SQL recebe seu proprio snapshot MVCC
// fresco em READ COMMITTED (diferente de uma unica instrucao SQL com CTEs, que compartilha UM
// snapshot fixado no inicio - essa foi a armadilha real da 1a otimizacao, corrigida la e evitada
// aqui por construcao): SELECT...FOR UPDATE bloqueia, e o proximo comando dentro da MESMA funcao
// ja enxerga qualquer commit que aconteceu enquanto esperava o lock, sem round-trip de rede entre
// os passos.
export const createCampoGrandeLead = async ({
  idempotencyKey, leadCode, visitorId, customerName, customerPhone, customerEmail,
  origin, source, utm, product, quoteSummary, flowType, siteOrigin, pagePath, customerPhoneSource,
}) => {
  const { rows } = await query(
    `SELECT * FROM campo_grande_create_lead($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15)`,
    [
      idempotencyKey, leadCode, visitorId, customerName, customerPhone, customerEmail,
      origin, source, utm, product, quoteSummary, flowType, siteOrigin, pagePath, customerPhoneSource,
    ]
  );

  const row = rows[0];

  if (row.deduped) {
    return {
      existingLead: {
        ok: true,
        leadId: row.lead_id,
        leadCode: row.lead_code,
        unit: "campo-grande",
        flowType,
        deduped: true,
        seller: row.seller_id ? { id: row.seller_id, name: row.seller_name, whatsapp: row.seller_whatsapp } : null,
      },
    };
  }

  if (row.no_active_seller) {
    return { noActiveSeller: true };
  }

  return {
    inserted: {
      leadId: row.lead_id,
      leadCode: row.lead_code,
      seller: { id: row.seller_id, name: row.seller_name, whatsapp: row.seller_whatsapp },
    },
  };
};

// Durable audit intent is stored on the lead during its INSERT. This separate statement
// drains a bounded batch after COMMIT; SKIP LOCKED is appropriate for this work queue only.
// Events and clearing the intent are atomic. A failed batch remains available for retry.
export const flushRotationCreationAudit = async () => {
  const { rowCount } = await query(`
    WITH pending AS MATERIALIZED (
      SELECT id, created_at, rotation_creation_audit AS audit
        FROM sales_leads
       WHERE unit = 'campo-grande' AND rotation_creation_audit IS NOT NULL
       ORDER BY id LIMIT 25 FOR UPDATE SKIP LOCKED
    ), events AS (
      INSERT INTO sales_lead_events (lead_id, event_type, actor_type, actor_id, metadata, created_at)
      SELECT p.id, e.event_type, 'system', e.actor_id, e.metadata, p.created_at
        FROM pending p CROSS JOIN LATERAL (
          VALUES ('LEAD_CREATED', NULL::text, p.audit - 'sellerId'),
                 ('SELLER_ASSIGNED', p.audit->>'sellerId', '{}'::jsonb)
        ) AS e(event_type, actor_id, metadata)
      RETURNING lead_id
    )
    UPDATE sales_leads sl SET rotation_creation_audit = NULL
      FROM pending p WHERE sl.id = p.id
       AND EXISTS (SELECT 1 FROM events WHERE lead_id = p.id)
  `);
  return rowCount;
};
