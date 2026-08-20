import "server-only";
import { query, withTransaction } from "./db";
import { recordLeadEvent } from "./imebotStore";
import { createHandoffToken, hashHandoffToken } from "../lib/handoffTokens";
import {
  FEEDBACK_JOB_TYPE,
  HANDOFF_LINK_STATUS,
  IMEBOT_HANDOFF_CHECK_DELAY_MINUTES,
  IMEBOT_HANDOFF_MAX_RETRIES,
} from "../lib/leadFlow";

const tokenTtlHours = 72;

export const createHandoffLink = async ({ leadId, sellerId }) => {
  const token = createHandoffToken();
  const tokenHash = hashHandoffToken(token);

  const { rows } = await query(
    `INSERT INTO sales_handoff_links (lead_id, seller_id, token_hash, expires_at)
     VALUES ($1, $2, $3, NOW() + $4::interval)
     RETURNING id`,
    [leadId, sellerId, tokenHash, `${tokenTtlHours} hours`]
  );

  const handoffLinkId = rows[0].id;
  await recordLeadEvent({
    leadId,
    eventType: "HANDOFF_OFFERED",
    actorType: "system",
    actorId: sellerId ? String(sellerId) : null,
    metadata: { handoffLinkId },
  });

  await enqueueHandoffCheckJob({ leadId, sellerId, handoffLinkId });

  return { token, handoffLinkId };
};

export const enqueueHandoffCheckJob = async ({ leadId, sellerId, handoffLinkId }) => {
  const idempotencyKey = `handoff-check:${handoffLinkId}`;
  await query(
    `INSERT INTO sales_feedback_jobs
       (lead_id, seller_id, handoff_link_id, job_type, run_after, max_attempts, idempotency_key)
     VALUES ($1, $2, $3, $4, NOW() + $5::interval, $6, $7)
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [
      leadId,
      sellerId,
      handoffLinkId,
      FEEDBACK_JOB_TYPE.HANDOFF_CHECK,
      `${IMEBOT_HANDOFF_CHECK_DELAY_MINUTES} minutes`,
      IMEBOT_HANDOFF_MAX_RETRIES,
      idempotencyKey,
    ]
  );
};

export const consumeHandoffToken = async (token) => {
  const tokenHash = hashHandoffToken(token);

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT hl.id, hl.lead_id, hl.seller_id, hl.expires_at, hl.status,
              ss.whatsapp AS seller_whatsapp, ss.active AS seller_active, ss.unit AS seller_unit
         FROM sales_handoff_links hl
         JOIN sales_sellers ss ON ss.id = hl.seller_id
        WHERE hl.token_hash = $1
        LIMIT 1
        FOR UPDATE`,
      [tokenHash]
    );

    const link = rows[0];
    if (!link) return { ok: false, status: 404, reason: "Link não encontrado." };
    if (link.status !== HANDOFF_LINK_STATUS.ACTIVE || new Date(link.expires_at).getTime() <= Date.now()) {
      return { ok: false, status: 410, reason: "Link expirado." };
    }
    if (!link.seller_active || link.seller_unit !== "campo-grande") {
      return { ok: false, status: 410, reason: "Vendedor indisponível." };
    }

    await client.query(
      `UPDATE sales_handoff_links
          SET first_clicked_at = COALESCE(first_clicked_at, NOW()),
              last_clicked_at = NOW(),
              click_count = click_count + 1
        WHERE id = $1`,
      [link.id]
    );

    await recordLeadEvent(client, {
      leadId: link.lead_id,
      eventType: "HANDOFF_LINK_CLICKED",
      actorType: "system",
      actorId: String(link.seller_id),
      metadata: { handoffLinkId: link.id },
    });

    return {
      ok: true,
      leadId: link.lead_id,
      sellerId: link.seller_id,
      redirectUrl: `https://wa.me/${String(link.seller_whatsapp).replace(/\D/g, "")}`,
    };
  });
};
