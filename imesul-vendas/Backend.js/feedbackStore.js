import "server-only";
import { query, withTransaction } from "./db";
import { recordLeadEvent } from "./imebotStore";
import {
  FEEDBACK_JOB_STATUS,
  FEEDBACK_JOB_TYPE,
  FEEDBACK_TYPE,
  IMEBOT_CONVERSATION_ACTOR,
  IMEBOT_CONVERSATION_TYPE,
  IMEBOT_POST_SALE_DELAY_MINUTES,
  CUSTOMER_PHONE_SOURCE,
} from "../lib/leadFlow";
import { parseFeedbackRating, normalizeFeedbackObservation } from "../lib/customerFeedback";

export const enqueuePostSaleJob = async ({ leadId, sellerId }) => {
  const { rows } = await query("SELECT customer_phone FROM sales_leads WHERE id = $1", [leadId]);
  const phone = String(rows[0]?.customer_phone || "").replace(/\D/g, "");
  const status = phone ? FEEDBACK_JOB_STATUS.PENDING : FEEDBACK_JOB_STATUS.WAITING_CUSTOMER_PHONE;
  const idempotencyKey = `post-sale:${leadId}`;

  await query(
    `INSERT INTO sales_feedback_jobs
       (lead_id, seller_id, job_type, status, run_after, max_attempts, idempotency_key)
     VALUES ($1, $2, $3, $4, NOW() + $5::interval, 3, $6)
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [leadId, sellerId ?? null, FEEDBACK_JOB_TYPE.POST_SALE, status, `${IMEBOT_POST_SALE_DELAY_MINUTES} minutes`, idempotencyKey]
  );

  await recordLeadEvent({
    leadId,
    eventType: phone ? "POST_SALE_QUEUED" : "POST_SALE_PENDING_PHONE",
    actorType: "system",
    actorId: sellerId ? String(sellerId) : null,
  });
};

export const setCustomerPhoneForPostSale = async ({ leadId, sellerId, customerPhone }) => {
  const digits = String(customerPhone || "").replace(/\D/g, "");
  if (!/^55\d{10,11}$/.test(digits)) return { ok: false, reason: "WhatsApp inválido. Use formato E.164 do Brasil." };

  await query(
    `UPDATE sales_leads
        SET customer_phone = $2, customer_phone_source = $3
      WHERE id = $1`,
    [leadId, digits, CUSTOMER_PHONE_SOURCE.SELLER_PROVIDED]
  );

  await query(
    `UPDATE sales_feedback_jobs
        SET status = $2, updated_at = NOW()
      WHERE lead_id = $1 AND job_type = $3 AND status = $4`,
    [leadId, FEEDBACK_JOB_STATUS.PENDING, FEEDBACK_JOB_TYPE.POST_SALE, FEEDBACK_JOB_STATUS.WAITING_CUSTOMER_PHONE]
  );

  await recordLeadEvent({
    leadId,
    eventType: "POST_SALE_QUEUED",
    actorType: "seller",
    actorId: sellerId ? String(sellerId) : null,
    metadata: { customerPhoneSource: CUSTOMER_PHONE_SOURCE.SELLER_PROVIDED },
  });

  return { ok: true };
};

export const processDueFeedbackJobs = async ({ limit = 20 } = {}) => {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT fj.id, fj.lead_id, fj.seller_id, fj.handoff_link_id, fj.job_type, fj.attempts, fj.max_attempts,
              sl.flow_type, sl.unit, sl.customer_phone, hl.first_clicked_at
         FROM sales_feedback_jobs fj
         JOIN sales_leads sl ON sl.id = fj.lead_id
         LEFT JOIN sales_handoff_links hl ON hl.id = fj.handoff_link_id
        WHERE fj.status = 'PENDING' AND fj.run_after <= NOW()
        ORDER BY fj.run_after ASC, fj.id ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED`,
      [Math.min(Math.max(Number(limit) || 20, 1), 100)]
    );

    const results = [];
    for (const job of rows) {
      if (job.job_type === FEEDBACK_JOB_TYPE.HANDOFF_CHECK) {
        if (job.flow_type !== "WHATSAPP_IMEBOT" || job.unit !== "campo-grande" || job.first_clicked_at) {
          await client.query("UPDATE sales_feedback_jobs SET status = $2, updated_at = NOW() WHERE id = $1", [job.id, FEEDBACK_JOB_STATUS.CANCELLED]);
          results.push({ id: job.id, status: FEEDBACK_JOB_STATUS.CANCELLED });
          continue;
        }

        if (job.attempts >= job.max_attempts) {
          await client.query("UPDATE sales_feedback_jobs SET status = $2, updated_at = NOW() WHERE id = $1", [job.id, FEEDBACK_JOB_STATUS.COMPLETED]);
          await client.query(
            `UPDATE sales_handoff_links
                SET status = 'EXPIRED'
              WHERE id = $1 AND first_clicked_at IS NULL`,
            [job.handoff_link_id]
          );
          await recordLeadEvent(client, {
            leadId: job.lead_id,
            eventType: "HANDOFF_FOLLOWUP_UNRESPONSIVE",
            actorType: "system",
            actorId: job.seller_id ? String(job.seller_id) : null,
            metadata: { handoffLinkId: job.handoff_link_id, attempts: job.attempts },
          });
          results.push({ id: job.id, status: FEEDBACK_JOB_STATUS.COMPLETED });
          continue;
        }

        await client.query(
          `UPDATE sales_handoff_links
              SET followup_attempts = followup_attempts + 1
            WHERE id = $1`,
          [job.handoff_link_id]
        );
        await client.query(
          `UPDATE sales_feedback_jobs
              SET status = $2,
                  attempts = attempts + 1,
                  run_after = NOW() + $3::interval,
                  updated_at = NOW()
            WHERE id = $1`,
          [job.id, FEEDBACK_JOB_STATUS.PENDING, `${IMEBOT_HANDOFF_CHECK_DELAY_MINUTES} minutes`]
        );
        await recordLeadEvent(client, {
          leadId: job.lead_id,
          eventType: "HANDOFF_FOLLOWUP_SENT",
          actorType: "system",
          actorId: job.seller_id ? String(job.seller_id) : null,
          metadata: { handoffLinkId: job.handoff_link_id },
        });
        results.push({ id: job.id, status: FEEDBACK_JOB_STATUS.PENDING });
        continue;
      }

      if (job.job_type === FEEDBACK_JOB_TYPE.POST_SALE) {
        const phone = String(job.customer_phone || "").replace(/\D/g, "");
        if (!phone) {
          await client.query("UPDATE sales_feedback_jobs SET status = $2, updated_at = NOW() WHERE id = $1", [job.id, FEEDBACK_JOB_STATUS.WAITING_CUSTOMER_PHONE]);
          await recordLeadEvent(client, { leadId: job.lead_id, eventType: "POST_SALE_PENDING_PHONE", actorType: "system" });
          results.push({ id: job.id, status: FEEDBACK_JOB_STATUS.WAITING_CUSTOMER_PHONE });
          continue;
        }

        await client.query("UPDATE sales_feedback_jobs SET status = $2, attempts = attempts + 1, updated_at = NOW() WHERE id = $1", [job.id, FEEDBACK_JOB_STATUS.PENDING_TEMPLATE]);
        await recordLeadEvent(client, { leadId: job.lead_id, eventType: "POST_SALE_PENDING_TEMPLATE", actorType: "system" });
        results.push({ id: job.id, status: FEEDBACK_JOB_STATUS.PENDING_TEMPLATE });
      }
    }

    return { ok: true, processed: results };
  });
};

export const startFeedback = async ({ leadId, sellerId, feedbackType }) => {
  const { rows } = await query(
    `INSERT INTO sales_customer_feedback (lead_id, seller_id, feedback_type)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [leadId, sellerId ?? null, feedbackType]
  );
  await recordLeadEvent({
    leadId,
    eventType: feedbackType === FEEDBACK_TYPE.HANDOFF_SERVICE ? "SERVICE_FEEDBACK_STARTED" : "POST_SALE_SENT",
    actorType: "system",
    actorId: sellerId ? String(sellerId) : null,
  });
  return { ok: true, feedbackId: rows[0]?.id ?? null };
};

export const upsertCustomerConversation = async ({ leadId, customerPhone, conversationType, state, context = {} }) => {
  const phone = String(customerPhone || "").replace(/\D/g, "");
  const { rows } = await query(
    `INSERT INTO imebot_conversations
       (lead_id, actor_type, actor_phone, conversation_type, state, context)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (lead_id, actor_type, actor_phone, conversation_type)
       WHERE state NOT IN ('COMPLETED', 'CANCELLED', 'EXPIRED')
     DO UPDATE SET state = EXCLUDED.state, context = EXCLUDED.context, updated_at = NOW()
     RETURNING id, state, context`,
    [
      leadId,
      IMEBOT_CONVERSATION_ACTOR.CUSTOMER,
      phone,
      conversationType,
      state,
      JSON.stringify(context || {}),
    ]
  );
  return rows[0] || null;
};

export const getActiveCustomerConversation = async ({ leadId, customerPhone }) => {
  const phone = String(customerPhone || "").replace(/\D/g, "");
  const { rows } = await query(
    `SELECT id, conversation_type, state, context
       FROM imebot_conversations
      WHERE lead_id = $1 AND actor_type = $2 AND actor_phone = $3
        AND state NOT IN ('COMPLETED', 'CANCELLED', 'EXPIRED')
      ORDER BY updated_at DESC
      LIMIT 1`,
    [leadId, IMEBOT_CONVERSATION_ACTOR.CUSTOMER, phone]
  );
  return rows[0] || null;
};

export const updateConversationState = async ({ conversationId, state, context = {} }) => {
  await query(
    "UPDATE imebot_conversations SET state = $2, context = $3::jsonb, updated_at = NOW() WHERE id = $1",
    [conversationId, state, JSON.stringify(context || {})]
  );
};

export const startHandoffServiceFeedback = async ({ leadId, sellerId, customerPhone }) => {
  await startFeedback({ leadId, sellerId, feedbackType: FEEDBACK_TYPE.HANDOFF_SERVICE });
  await upsertCustomerConversation({
    leadId,
    customerPhone,
    conversationType: IMEBOT_CONVERSATION_TYPE.HANDOFF_SERVICE,
    state: "WAITING_RATING",
    context: { feedbackType: FEEDBACK_TYPE.HANDOFF_SERVICE },
  });
};

export const recordFeedbackRating = async ({ leadId, feedbackType, rating }) => {
  const parsed = parseFeedbackRating(rating);
  if (!parsed.ok) return parsed;

  await query(
    `UPDATE sales_customer_feedback
        SET rating = $3
      WHERE id = (
        SELECT id FROM sales_customer_feedback
         WHERE lead_id = $1 AND feedback_type = $2 AND completed_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1
      )`,
    [leadId, feedbackType, parsed.rating]
  );

  await recordLeadEvent({
    leadId,
    eventType: feedbackType === FEEDBACK_TYPE.HANDOFF_SERVICE ? "SERVICE_RATING_RECORDED" : "POST_SALE_RATING_RECORDED",
    actorType: "customer",
    metadata: { rating: parsed.rating },
  });

  return { ok: true, rating: parsed.rating };
};

export const completeFeedbackObservation = async ({ leadId, feedbackType, hasObservation, observation = "" }) => {
  let safeObservation = "";
  if (hasObservation) {
    const normalized = normalizeFeedbackObservation(observation);
    if (!normalized.ok) return normalized;
    safeObservation = normalized.observation;
  }

  await query(
    `UPDATE sales_customer_feedback
        SET has_observation = $3, observation = $4, completed_at = NOW()
      WHERE id = (
        SELECT id FROM sales_customer_feedback
         WHERE lead_id = $1 AND feedback_type = $2 AND completed_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1
      )`,
    [leadId, feedbackType, Boolean(hasObservation), safeObservation]
  );

  await recordLeadEvent({
    leadId,
    eventType: feedbackType === FEEDBACK_TYPE.HANDOFF_SERVICE
      ? hasObservation ? "SERVICE_OBSERVATION_RECORDED" : "SERVICE_FEEDBACK_COMPLETED"
      : hasObservation ? "POST_SALE_OBSERVATION_RECORDED" : "POST_SALE_COMPLETED",
    actorType: "customer",
    metadata: hasObservation ? { observationLength: safeObservation.length } : {},
  });

  return { ok: true };
};
