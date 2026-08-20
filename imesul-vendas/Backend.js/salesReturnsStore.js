import "server-only";
import { query, withTransaction } from "./db";
import { LEAD_STATUS } from "../lib/leadFlow";
import { validateNewReturnAmount, buildReturnsSummary } from "../lib/salesReturns";
import { recordLeadEvent } from "./imebotStore";
import { createHandoffToken, hashHandoffToken } from "../lib/handoffTokens";

// Persistência de devoluções (Backend.js/salesReturnsStore.js) - cada devolução é um evento
// próprio (nunca sobrescreve sales_leads.sale_amount, ver relatório desta fase). Toda escrita
// roda dentro de uma transação com FOR UPDATE na linha do lead, para nunca permitir duas
// devoluções concorrentes ultrapassarem juntas o valor da venda (condição de corrida clássica:
// duas transações leem "0 devolvido" ao mesmo tempo e as duas aprovam uma devolução de 100% -
// FOR UPDATE serializa isso, a segunda espera a primeira commitar e vê o total já atualizado).

// runQuery: aceita tanto o client de uma transação (client.query) quanto o query() de conexão
// avulsa - a mesma assinatura (text, params) funciona nos dois casos.
const getReturnsTotalForLead = async (runQuery, leadId) => {
  const { rows } = await runQuery(
    "SELECT COALESCE(SUM(amount), 0)::numeric AS total FROM sales_returns WHERE lead_id = $1",
    [leadId]
  );
  return Number(rows[0]?.total) || 0;
};

// Resumo financeiro de um lead (bruto/devolvido/líquido/status) - usado pelo painel e pelo
// IMEbot antes de pedir confirmação de uma nova devolução.
export const getLeadReturnsSummary = async (leadId) => {
  const { rows } = await query("SELECT sale_amount, status FROM sales_leads WHERE id = $1", [leadId]);
  const lead = rows[0];
  if (!lead) return { ok: false, reason: "Lead não encontrado." };

  const returnsTotal = await getReturnsTotalForLead(query, leadId);
  return { ok: true, ...buildReturnsSummary({ grossSale: lead.sale_amount, existingReturnsTotal: returnsTotal }) };
};

// Registra uma devolução dentro de uma transação com lock de linha (FOR UPDATE) - nunca permite
// o total devolvido ultrapassar sale_amount, mesmo sob duas requisições concorrentes para o
// mesmo lead. sellerId: quem está autorizado a registrar (ver ownership check no chamador -
// Backend.js/imebotStore.js/webhook - esta função não valida ownership sozinha, só a
// matemática/concorrência).
export const registerReturn = async ({ leadId, sellerId, amount, reason, source, metaMessageId, idempotencyKey }) => {
  return withTransaction(async (client) => {
    if (idempotencyKey) {
      const { rows: existingRows } = await client.query(
        "SELECT id FROM sales_returns WHERE idempotency_key = $1",
        [idempotencyKey]
      );
      if (existingRows[0]) return { ok: true, returnId: existingRows[0].id, deduped: true };
    }

    const { rows: leadRows } = await client.query(
      "SELECT id, status, sale_amount FROM sales_leads WHERE id = $1 FOR UPDATE",
      [leadId]
    );
    const lead = leadRows[0];
    if (!lead) return { ok: false, reason: "Lead não encontrado." };
    if (lead.status !== LEAD_STATUS.VENDEU) {
      return { ok: false, reason: "Só é possível registrar devolução para um lead marcado como VENDEU." };
    }

    const existingReturnsTotal = await getReturnsTotalForLead(client.query.bind(client), leadId);
    const validation = validateNewReturnAmount({
      amount,
      grossSale: lead.sale_amount,
      existingReturnsTotal,
    });
    if (!validation.ok) return validation;

    const { rows: insertedRows } = await client.query(
      `INSERT INTO sales_returns (lead_id, seller_id, amount, reason, source, meta_message_id, idempotency_key, confirmed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id`,
      [leadId, sellerId ?? null, validation.amount, String(reason || "").slice(0, 300), String(source || "").slice(0, 40), metaMessageId || null, idempotencyKey || null]
    );

    const returnId = insertedRows[0].id;

    await recordLeadEvent(client, {
      leadId,
      eventType: "RETURN_RECORDED",
      actorType: source === "admin" ? "admin" : "seller",
      actorId: sellerId ? String(sellerId) : null,
      metadata: { amount: validation.amount, returnId },
    });

    return { ok: true, returnId, deduped: false };
  });
};

export const requestReturnConfirmation = async ({ leadId, sellerId, amount, reason = "" }) => {
  const token = createHandoffToken();
  const tokenHash = hashHandoffToken(token);

  return withTransaction(async (client) => {
    const { rows: leadRows } = await client.query(
      "SELECT id, status, sale_amount FROM sales_leads WHERE id = $1 FOR UPDATE",
      [leadId]
    );
    const lead = leadRows[0];
    if (!lead) return { ok: false, reason: "Lead não encontrado." };
    if (lead.status !== LEAD_STATUS.VENDEU) {
      return { ok: false, reason: "Só é possível solicitar devolução para um lead marcado como VENDEU." };
    }

    const existingReturnsTotal = await getReturnsTotalForLead(client.query.bind(client), leadId);
    const validation = validateNewReturnAmount({ amount, grossSale: lead.sale_amount, existingReturnsTotal });
    if (!validation.ok) return validation;

    const { rows } = await client.query(
      `INSERT INTO sales_return_confirmations
         (lead_id, seller_id, amount, reason, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '15 minutes')
       RETURNING id, expires_at`,
      [leadId, sellerId, validation.amount, String(reason || "").slice(0, 300), tokenHash]
    );

    await recordLeadEvent(client, {
      leadId,
      eventType: "RETURN_REQUESTED",
      actorType: "seller",
      actorId: sellerId ? String(sellerId) : null,
      metadata: { amount: validation.amount, confirmationId: rows[0].id },
    });

    return {
      ok: true,
      confirmationId: rows[0].id,
      token,
      expiresAt: rows[0].expires_at,
      preview: buildReturnsSummary({
        grossSale: lead.sale_amount,
        existingReturnsTotal: existingReturnsTotal + validation.amount,
      }),
      current: buildReturnsSummary({ grossSale: lead.sale_amount, existingReturnsTotal }),
      newReturnAmount: validation.amount,
    };
  });
};

export const confirmReturn = async ({ token, sellerId, metaMessageId }) => {
  const tokenHash = hashHandoffToken(token);

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, lead_id, seller_id, amount, reason, status, expires_at, confirmed_return_id
         FROM sales_return_confirmations
        WHERE token_hash = $1
        LIMIT 1
        FOR UPDATE`,
      [tokenHash]
    );
    const pending = rows[0];
    if (!pending) return { ok: false, reason: "Confirmação não encontrada." };
    if (pending.seller_id !== sellerId) return { ok: false, reason: "Esta confirmação pertence a outro vendedor." };
    if (pending.status === "CONFIRMED" && pending.confirmed_return_id) {
      return { ok: true, returnId: pending.confirmed_return_id, deduped: true };
    }
    if (pending.status !== "PENDING") return { ok: false, reason: "Confirmação não está pendente." };
    if (new Date(pending.expires_at).getTime() <= Date.now()) {
      await client.query("UPDATE sales_return_confirmations SET status = 'EXPIRED' WHERE id = $1", [pending.id]);
      return { ok: false, reason: "Confirmação expirada." };
    }

    const { rows: leadRows } = await client.query(
      "SELECT id, status, sale_amount FROM sales_leads WHERE id = $1 FOR UPDATE",
      [pending.lead_id]
    );
    const lead = leadRows[0];
    if (!lead) return { ok: false, reason: "Lead não encontrado." };

    const existingReturnsTotal = await getReturnsTotalForLead(client.query.bind(client), pending.lead_id);
    const validation = validateNewReturnAmount({
      amount: pending.amount,
      grossSale: lead.sale_amount,
      existingReturnsTotal,
    });
    if (!validation.ok) return validation;

    const idempotencyKey = `return-confirmation:${pending.id}`;
    const { rows: insertedRows } = await client.query(
      `INSERT INTO sales_returns (lead_id, seller_id, amount, reason, source, meta_message_id, idempotency_key, confirmed_at)
       VALUES ($1, $2, $3, $4, 'imebot', $5, $6, NOW())
       ON CONFLICT (idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
       RETURNING id`,
      [pending.lead_id, sellerId, validation.amount, pending.reason, metaMessageId || null, idempotencyKey]
    );
    const returnId = insertedRows[0].id;

    await client.query(
      "UPDATE sales_return_confirmations SET status = 'CONFIRMED', confirmed_at = NOW(), confirmed_return_id = $2 WHERE id = $1",
      [pending.id, returnId]
    );
    await recordLeadEvent(client, {
      leadId: pending.lead_id,
      eventType: "RETURN_CONFIRMED",
      actorType: "seller",
      actorId: String(sellerId),
      metadata: { amount: validation.amount, returnId, confirmationId: pending.id },
    });
    await recordLeadEvent(client, {
      leadId: pending.lead_id,
      eventType: "RETURN_RECORDED",
      actorType: "seller",
      actorId: String(sellerId),
      metadata: { amount: validation.amount, returnId },
    });

    return { ok: true, returnId, deduped: false };
  });
};

export const cancelReturnConfirmation = async ({ token, sellerId }) => {
  const tokenHash = hashHandoffToken(token);
  const { rows } = await query(
    `UPDATE sales_return_confirmations
        SET status = 'CANCELLED', cancelled_at = NOW()
      WHERE token_hash = $1 AND seller_id = $2 AND status = 'PENDING'
      RETURNING lead_id, id`,
    [tokenHash, sellerId]
  );

  if (!rows[0]) return { ok: false, reason: "Confirmação não encontrada ou não está pendente." };
  await recordLeadEvent({
    leadId: rows[0].lead_id,
    eventType: "RETURN_REQUESTED",
    actorType: "seller",
    actorId: String(sellerId),
    metadata: { cancelled: true, confirmationId: rows[0].id },
  });
  return { ok: true };
};
