import "server-only";
import { query, withTransaction } from "./db";
import {
  FEEDBACK_JOB_STATUS,
  FEEDBACK_JOB_TYPE,
  IMEBOT_POST_SALE_DELAY_MINUTES,
  IMEBOT_STATE,
  LEAD_STATUS,
  isCommercialAutomationEnabledForUnit,
} from "../lib/leadFlow";
import { computeNextImebotState, resolveLeadFromContext, IMEBOT_EVENTS } from "../lib/imebotStateMachine";
import { buildLeadPdfRelativePath } from "../lib/pdfValidation";
import { validateCnpj } from "../lib/cnpjValidation";

// Camada de persistência do IMEbot (Fase 2). SÓ atua sobre leads de unit = "campo-grande" (ver
// isCommercialAutomationEnabledForUnit em lib/leadFlow.js) - toda função aqui reconfirma isso
// antes de qualquer escrita, nunca confia que quem chamou já filtrou certo (defesa em
// profundidade, mesmo espírito do CHECK constraint direto no Postgres usado em outras tabelas).
//
// Sem credenciais Meta reais configuradas, o ENVIO de mensagens nunca acontece de verdade -
// as funções abaixo gravam o estado/intenção corretamente no banco (auditável, testável) e
// marcam a notificação como FAILED com o motivo, em vez de fingir sucesso. A falha do IMEbot
// NUNCA impede o cliente de falar com o vendedor: o WhatsApp do vendedor já foi aberto pelo
// frontend antes disso (ver lib/leadWhatsApp.js) - o que acontece aqui é só o acompanhamento
// interno complementar.

const isMetaConfigured = () =>
  Boolean(process.env.META_WHATSAPP_TOKEN && process.env.META_WHATSAPP_PHONE_NUMBER_ID);

// --- Auditoria (append-only) -------------------------------------------------------------------

// runQuery opcional: passe client.query.bind(client) para gravar DENTRO da mesma transação de
// quem chamou (ex.: salesReturnsStore.js registerReturn); sem isso, usa uma conexão avulsa.
// metadata é sempre serializado - nunca aceitar PDF/segredo/token aqui (ver relatório desta
// fase, seção privacidade/segurança).
export const recordLeadEvent = async (
  clientOrOptions,
  maybeOptions
) => {
  // Assinatura flexível: recordLeadEvent(options) OU recordLeadEvent(client, options) - evita
  // forçar todo chamador a passar um client quando uma conexão avulsa já basta.
  const hasClient = maybeOptions !== undefined;
  const runQuery = hasClient ? clientOrOptions.query.bind(clientOrOptions) : query;
  const { leadId, eventType, actorType = "system", actorId = null, metadata = {} } = hasClient ? maybeOptions : clientOrOptions;

  await runQuery(
    `INSERT INTO sales_lead_events (lead_id, event_type, actor_type, actor_id, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [leadId, eventType, actorType, actorId, JSON.stringify(metadata || {})]
  );
};

// --- Notificação de novo lead ao vendedor (via IMEbot) ----------------------------------------

// Chamado depois que um lead de Campo Grande é criado COM vendedor atribuído (ver
// salesLeadsStore.js createLead). Nunca lança - qualquer falha fica registrada no próprio lead
// (imebot_notification_status), nunca propaga para quebrar a resposta ao cliente.
export const notifyImebotOfNewLead = async ({ leadId, unit }) => {
  if (!isCommercialAutomationEnabledForUnit(unit)) return;

  try {
    // SELLER_ASSIGNED já é registrado em salesLeadsStore.js createLead, no exato momento da
    // atribuição (vale para qualquer unidade, não só Campo Grande) - não duplicar aqui.
    await query(
      `UPDATE sales_leads
       SET imebot_state = $2, imebot_notification_status = 'PENDING'
       WHERE id = $1`,
      [leadId, IMEBOT_STATE.WAITING_CUSTOMER_NAME]
    );

    if (!isMetaConfigured()) {
      // Documentado, não escondido: sem credenciais reais, não existe forma de enviar a
      // mensagem de verdade. Marca FAILED com o motivo em vez de deixar PENDING para sempre
      // (não há job/cron nesta fase para reprocessar - ver relatório).
      await query(
        `UPDATE sales_leads
         SET imebot_notification_status = 'FAILED', imebot_notified_at = NOW()
         WHERE id = $1`,
        [leadId]
      );
      return;
    }

    // Envio real via Meta Cloud API - fora do escopo sem credenciais para testar. Quando as
    // credenciais existirem, implementar aqui a chamada HTTP e, em caso de sucesso, chamar
    // recordOutboundMessage() com o wamid retornado pela Meta antes de marcar SENT.
    await query(
      `UPDATE sales_leads
       SET imebot_notification_status = 'FAILED', imebot_notified_at = NOW()
       WHERE id = $1`,
      [leadId]
    );
  } catch (err) {
    console.error("[imebot] falha ao registrar notificação de novo lead:", err.message);
  }
};

// --- Mapeamento de mensagens (contexto seguro por Lead ID) -------------------------------------

// Registra uma mensagem ENVIADA pelo IMEbot (wamid retornado pela Meta) para permitir relacionar
// a resposta do vendedor de volta ao lead certo, mesmo com vários leads simultâneos.
export const recordOutboundMessage = async ({ wamid, leadId, sellerId, purpose, state }) => {
  await query(
    `INSERT INTO imebot_messages (wamid, lead_id, seller_id, purpose, state)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (wamid) DO NOTHING`,
    [wamid, leadId, sellerId ?? null, purpose || "", state || null]
  );
};

const findLeadIdByWamid = async (wamid) => {
  if (!wamid) return null;
  const { rows } = await query("SELECT lead_id FROM imebot_messages WHERE wamid = $1", [wamid]);
  return rows[0]?.lead_id ?? null;
};

const leadRowToPending = (row) => ({
  id: row.id,
  leadCode: row.lead_code,
  flowType: row.flow_type,
  unit: row.unit,
  customerName: row.customer_name,
  imebotState: row.imebot_state,
  buyerType: row.buyer_type,
  buyerName: row.buyer_name,
  buyerCnpj: row.buyer_cnpj,
  saleAmount: row.sale_amount,
});

const findPendingLeadsForSeller = async (sellerId) => {
  const { rows } = await query(
    `SELECT id, flow_type, unit, customer_name, imebot_state, lead_code, buyer_type, buyer_name, buyer_cnpj, sale_amount
       FROM sales_leads
      WHERE seller_id = $1 AND unit = 'campo-grande'
        AND imebot_state IS NOT NULL
        AND imebot_state NOT IN ('COMPLETED', 'REJECTED')
      ORDER BY created_at ASC`,
    [sellerId]
  );
  return rows.map(leadRowToPending);
};

// Núcleo da resolução "a qual lead esta resposta pertence" - NUNCA usa só "último lead do
// vendedor" (ver relatório desta fase, seção concorrência de leads). contextWamid vem do
// context.id da mensagem inbound da Meta, quando presente.
export const resolveInboundLeadContext = async ({ sellerId, contextWamid }) => {
  const contextLeadId = await findLeadIdByWamid(contextWamid);
  const pendingLeads = await findPendingLeadsForSeller(sellerId);
  return resolveLeadFromContext({ contextLeadId, pendingLeads });
};

// Payload de botão gerado pelo próprio IMEbot já carrega o Lead ID (ex.: "RESULT_VENDEU:IMESUL-
// ABC12345") - a forma mais direta e segura de identificar o lead em uma resposta por botão,
// sem depender só de context.id. Só aceita leads pendentes deste vendedor (nunca confia
// cegamente no código vindo do botão sem confirmar que ainda pertence a este vendedor).
export const findPendingLeadByCode = async ({ sellerId, leadCode }) => {
  if (!leadCode) return null;
  const { rows } = await query(
    `SELECT id, flow_type, unit, customer_name, imebot_state, lead_code, buyer_type, buyer_name, buyer_cnpj, sale_amount
       FROM sales_leads
      WHERE seller_id = $1 AND lead_code = $2
        AND imebot_state IS NOT NULL AND imebot_state NOT IN ('COMPLETED', 'REJECTED')
      LIMIT 1`,
    [sellerId, leadCode]
  );
  return rows[0] ? leadRowToPending(rows[0]) : null;
};

// Vendedores são identificados pelo próprio número de WhatsApp (from da mensagem inbound) - só
// vendedores já cadastrados em sales_sellers podem acionar transições do IMEbot.
export const findSellerIdByWhatsapp = async (whatsapp) => {
  const seller = await findSellerBySenderPhone(whatsapp);
  return seller?.active ? seller.id : null;
};

// Versão completa (id/nome/unit/active) - usada para decidir se um remetente é um VENDEDOR
// INTERNO (ativo + unit campo-grande) antes de tratar a mensagem como cliente (ver relatório
// desta fase, "IMEbot - mensagem iniciada pelo vendedor"). Retorna null se o telefone não
// pertence a nenhum vendedor cadastrado, mesmo que inativo.
export const findSellerBySenderPhone = async (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  const { rows } = await query("SELECT id, name, unit, active FROM sales_sellers WHERE whatsapp = $1 LIMIT 1", [digits]);
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, name: row.name, unit: row.unit, active: row.active };
};

// --- Transições de estado ------------------------------------------------------------------

const getLeadForImebot = async (leadId) => {
  const { rows } = await query(
    `SELECT id, flow_type, unit, imebot_state, buyer_type, seller_id FROM sales_leads WHERE id = $1`,
    [leadId]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    flowType: row.flow_type,
    unit: row.unit,
    imebotState: row.imebot_state,
    buyerType: row.buyer_type,
    sellerId: row.seller_id,
  };
};

// Confere que um lead pertence de fato ao vendedor que está tentando agir sobre ele - NUNCA
// permite um vendedor consultar/alterar lead de outro (ver relatório desta fase, "Buscar Lead").
// Em caso de tentativa negada, registra SELLER_UNAUTHORIZED_ATTEMPT para auditoria, sem revelar
// ao vendedor quem é o dono real do lead.
export const assertLeadOwnedBySeller = async ({ leadId, sellerId }) => {
  const { rows } = await query("SELECT id, seller_id FROM sales_leads WHERE id = $1", [leadId]);
  const lead = rows[0];
  if (!lead) return { ok: false, reason: "Lead não encontrado." };

  if (lead.seller_id !== sellerId) {
    await recordLeadEvent({
      leadId,
      eventType: "SELLER_UNAUTHORIZED_ATTEMPT",
      actorType: "seller",
      actorId: String(sellerId),
    });
    return { ok: false, reason: "Este lead não pertence a este vendedor." };
  }

  return { ok: true };
};

// Aplica um evento da máquina de estados PURA (lib/imebotStateMachine.js) e persiste o novo
// estado. Nunca lança em transição inválida - devolve {ok:false, reason} para o webhook decidir
// (ex.: pedir esclarecimento ao vendedor em vez de quebrar a requisição). buyerName/buyerCnpj
// SEMPRE revalidados aqui (nunca confia em validação já feita por quem chamou).
export const applyImebotEvent = async ({ leadId, event, customerName, buyerName, buyerCnpj, saleAmount, actorId }) => {
  const lead = await getLeadForImebot(leadId);
  if (!lead) return { ok: false, reason: "Lead não encontrado." };
  if (!isCommercialAutomationEnabledForUnit(lead.unit)) {
    return { ok: false, reason: "IMEbot não está ativo para esta unidade." };
  }

  let normalizedCnpj = null;
  if (event === IMEBOT_EVENTS.BUYER_CNPJ_RECEIVED) {
    const validation = validateCnpj(buyerCnpj);
    if (!validation.ok) return { ok: false, reason: validation.reason };
    normalizedCnpj = validation.cnpj;
  }

  const transition = computeNextImebotState({
    currentState: lead.imebotState,
    event,
    flowType: lead.flowType,
    buyerType: lead.buyerType,
  });
  if (!transition.ok) return transition;

  return withTransaction(async (client) => {
    await client.query("UPDATE sales_leads SET imebot_state = $2 WHERE id = $1", [leadId, transition.nextState]);

    const logEvent = (eventType, metadata) =>
      recordLeadEvent(client, { leadId, eventType, actorType: "seller", actorId: actorId ? String(actorId) : null, metadata });

    if (event === IMEBOT_EVENTS.NAME_RECEIVED && customerName) {
      await client.query("UPDATE sales_leads SET customer_name = $2 WHERE id = $1", [leadId, customerName.slice(0, 120)]);
      await logEvent("CONTACT_NAME_SET", {});
    }

    if (event === IMEBOT_EVENTS.RESULT_VENDEU) {
      await client.query("UPDATE sales_leads SET status = $2 WHERE id = $1", [leadId, LEAD_STATUS.VENDEU]);
      await logEvent("STATUS_CHANGED", { status: LEAD_STATUS.VENDEU });
    }

    if (event === IMEBOT_EVENTS.RESULT_NAO_VENDEU) {
      await client.query("UPDATE sales_leads SET status = $2 WHERE id = $1", [leadId, LEAD_STATUS.NAO_VENDEU]);
      await logEvent("STATUS_CHANGED", { status: LEAD_STATUS.NAO_VENDEU });
    }

    if (event === IMEBOT_EVENTS.BUYER_TYPE_PERSON || event === IMEBOT_EVENTS.BUYER_TYPE_COMPANY) {
      const buyerType = event === IMEBOT_EVENTS.BUYER_TYPE_PERSON ? "PERSON" : "COMPANY";
      await client.query("UPDATE sales_leads SET buyer_type = $2 WHERE id = $1", [leadId, buyerType]);
      await logEvent("BUYER_TYPE_SET", { buyerType });
    }

    if (event === IMEBOT_EVENTS.BUYER_NAME_RECEIVED && buyerName) {
      await client.query("UPDATE sales_leads SET buyer_name = $2 WHERE id = $1", [leadId, buyerName.slice(0, 200)]);
      await logEvent("BUYER_SET", {});
    }

    if (event === IMEBOT_EVENTS.BUYER_CNPJ_RECEIVED) {
      await client.query("UPDATE sales_leads SET buyer_cnpj = $2 WHERE id = $1", [leadId, normalizedCnpj]);
      await logEvent("CNPJ_SET", {});
    }

    if (event === IMEBOT_EVENTS.SALE_VALUE_RECEIVED && saleAmount) {
      await client.query("UPDATE sales_leads SET sale_amount = $2, sold_at = NOW() WHERE id = $1", [leadId, saleAmount]);
      await logEvent("SALE_RECORDED", { saleAmount });

      const { rows: phoneRows } = await client.query("SELECT customer_phone FROM sales_leads WHERE id = $1", [leadId]);
      const customerPhone = String(phoneRows[0]?.customer_phone || "").replace(/\D/g, "");
      const postSaleStatus = customerPhone ? FEEDBACK_JOB_STATUS.PENDING : FEEDBACK_JOB_STATUS.WAITING_CUSTOMER_PHONE;
      await client.query(
        `INSERT INTO sales_feedback_jobs
           (lead_id, seller_id, job_type, status, run_after, max_attempts, idempotency_key)
         VALUES ($1, $2, $3, $4, NOW() + $5::interval, 3, $6)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          leadId,
          lead.sellerId ?? null,
          FEEDBACK_JOB_TYPE.POST_SALE,
          postSaleStatus,
          `${IMEBOT_POST_SALE_DELAY_MINUTES} minutes`,
          `post-sale:${leadId}`,
        ]
      );
      await logEvent(customerPhone ? "POST_SALE_QUEUED" : "POST_SALE_PENDING_PHONE", {});
    }

    if (event === IMEBOT_EVENTS.PDF_RECEIVED) {
      await logEvent("PDF_RECEIVED", {});
    }

    return { ok: true, nextState: transition.nextState, buyerType: lead.buyerType };
  });
};

// --- Deduplicação/idempotência de eventos do webhook -------------------------------------------

// A Meta reentrega webhooks (retry normal em caso de timeout/erro) - sem isso, o mesmo evento
// processaria duas vezes (ex.: pedir o valor da venda de novo, ou marcar VENDEU duas vezes).
// Retorna true se este é um evento NOVO (deve processar); false se já foi visto (ignorar).
export const registerWebhookEventOnce = async (eventId, runQuery = query) => {
  const { rowCount } = await runQuery(
    "INSERT INTO imebot_webhook_events (event_id) VALUES ($1) ON CONFLICT (event_id) DO NOTHING",
    [eventId]
  );
  return rowCount > 0;
};

// --- PDF (fluxos DIRECT_CONTACT e WHATSAPP_IMEBOT) ---------------------------------------------

// Registra que um PDF foi recebido da Meta (media_id) - metadados apenas, nunca o arquivo em si
// (ver migration 004, sales_lead_files). O caminho relativo final é gerado aqui, no servidor,
// nunca aceito de fora (ver lib/pdfValidation.js buildLeadPdfRelativePath).
export const registerIncomingPdf = async ({ leadId, metaMediaId, originalName, mime, leadCode, customerName }) => {
  const relativePath = buildLeadPdfRelativePath({ leadCode, customerName });
  if (!relativePath) {
    throw new Error("Não foi possível gerar um caminho relativo seguro para o PDF.");
  }

  const { rows } = await query(
    `INSERT INTO sales_lead_files (lead_id, type, meta_media_id, original_name, mime, storage_status, relative_path)
     VALUES ($1, 'orcamento_pdf', $2, $3, $4, 'PENDING', $5)
     RETURNING id`,
    [leadId, metaMediaId || null, (originalName || "").slice(0, 200), (mime || "").slice(0, 120), relativePath]
  );

  await recordLeadEvent({ leadId, eventType: "PDF_STORED", actorType: "system", metadata: { fileId: rows[0].id } });

  return { ok: true, fileId: rows[0].id, relativePath };
};

// Busca um lead PELO CODIGO, SEM filtrar por vendedor nem por imebot_state - o chamador SEMPRE
// confere ownership depois via assertLeadOwnedBySeller (que registra a tentativa negada para
// auditoria, sem revelar a identidade do outro vendedor - ver relatório desta fase, "Buscar
// Lead"). Nunca filtrar por imebot_state aqui: uma devolução ou pedido de PDF pode acontecer bem
// depois do acompanhamento do IMEbot já ter concluído para aquele lead (ex.: cliente devolve
// dias depois da venda).
export const findLeadByCode = async (leadCode) => {
  const { rows } = await query(
    `SELECT id, lead_code, flow_type, unit, seller_id, customer_name, buyer_name, buyer_cnpj, status, sale_amount
       FROM sales_leads
      WHERE lead_code = $1
      LIMIT 1`,
    [leadCode]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    leadCode: row.lead_code,
    flowType: row.flow_type,
    unit: row.unit,
    sellerId: row.seller_id,
    customerName: row.customer_name,
    buyerName: row.buyer_name,
    buyerCnpj: row.buyer_cnpj,
    status: row.status,
    saleAmount: row.sale_amount,
  };
};

// Cliente que já mandou mensagem para o numero oficial do IMEbot recentemente - evita criar um
// segundo lead so porque ele mandou uma segunda mensagem na mesma conversa (ver relatorio desta
// fase, "uma mensagem inicial nao pode gerar dois leads"). "Recente" = lead ainda nao concluido
// (imebot_state fora de COMPLETED/REJECTED) - uma vez concluido, uma nova mensagem do mesmo
// telefone conta como um NOVO atendimento.
export const findActiveWhatsappImebotLeadByPhone = async (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;

  const { rows } = await query(
    `SELECT id, lead_code, seller_id FROM sales_leads
      WHERE flow_type = 'WHATSAPP_IMEBOT' AND customer_phone = $1
        AND imebot_state IS NOT NULL AND imebot_state NOT IN ('COMPLETED', 'REJECTED')
      ORDER BY created_at DESC
      LIMIT 1`,
    [digits]
  );
  const row = rows[0];
  return row ? { id: row.id, leadCode: row.lead_code, sellerId: row.seller_id } : null;
};

// --- Menu do vendedor: "Meus Clientes" / "Buscar Lead" / "Meu Desempenho" -----------------------

// Lista curta dos leads mais recentes do vendedor - NUNCA todos de uma vez (ver relatório desta
// fase, "não enviar centenas de resultados").
export const getSellerRecentLeads = async (sellerId, { limit = 10 } = {}) => {
  const { rows } = await query(
    `SELECT lead_code, customer_name, buyer_name, status, sale_amount, created_at
       FROM sales_leads
      WHERE seller_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [sellerId, Math.min(Math.max(Number(limit) || 10, 1), 25)]
  );
  return rows.map((row) => ({
    leadCode: row.lead_code,
    contactName: row.customer_name,
    buyerName: row.buyer_name,
    status: row.status,
    saleAmount: row.sale_amount,
    createdAt: row.created_at,
  }));
};

// Busca só dentro dos leads AUTORIZADOS do vendedor (WHERE seller_id = $1 sempre presente -
// nunca uma busca global) por Lead ID, nome do contato, nome do comprador ou CNPJ.
export const searchSellerLeads = async (sellerId, { searchTerm = "" } = {}) => {
  const term = String(searchTerm || "").trim().slice(0, 120);
  if (!term) return [];

  const cnpjDigits = term.replace(/\D/g, "");
  const { rows } = await query(
    `SELECT lead_code, customer_name, buyer_name, status, sale_amount, created_at
       FROM sales_leads
      WHERE seller_id = $1
        AND (
          lead_code ILIKE $2
          OR customer_name ILIKE $2
          OR buyer_name ILIKE $2
          OR ($3 <> '' AND buyer_cnpj = $3)
        )
      ORDER BY created_at DESC
      LIMIT 10`,
    [sellerId, `%${term}%`, cnpjDigits]
  );
  return rows.map((row) => ({
    leadCode: row.lead_code,
    contactName: row.customer_name,
    buyerName: row.buyer_name,
    status: row.status,
    saleAmount: row.sale_amount,
    createdAt: row.created_at,
  }));
};

// "Meu Desempenho" - só dados do próprio vendedor, nunca de outro.
export const getSellerPerformanceSummary = async (sellerId) => {
  const { rows } = await query(
    `SELECT
       COUNT(sl.id)::int AS leads,
       COUNT(sl.id) FILTER (WHERE sl.status = 'VENDEU')::int AS vendidos,
       COUNT(sl.id) FILTER (WHERE sl.status = 'NEGOCIANDO')::int AS negociando,
       COUNT(sl.id) FILTER (WHERE sl.status = 'NAO_VENDEU')::int AS nao_vendidos,
       COALESCE(SUM(sl.sale_amount) FILTER (WHERE sl.status = 'VENDEU'), 0)::numeric AS venda_bruta,
       COALESCE((
         SELECT SUM(sr.amount) FROM sales_returns sr
          WHERE sr.lead_id IN (SELECT id FROM sales_leads WHERE seller_id = $1)
       ), 0)::numeric AS devolucoes
     FROM sales_leads sl
     WHERE sl.seller_id = $1`,
    [sellerId]
  );

  const row = rows[0];
  const leads = row.leads || 0;
  const sold = row.vendidos || 0;
  const grossSale = Number(row.venda_bruta) || 0;
  const returnsTotal = Number(row.devolucoes) || 0;
  const netSale = Math.max(Math.round((grossSale - returnsTotal) * 100) / 100, 0);

  return {
    leads,
    sold,
    negotiating: row.negociando || 0,
    notSold: row.nao_vendidos || 0,
    conversionRate: leads > 0 ? Math.round((sold / leads) * 10000) / 100 : 0,
    grossSale,
    returnsTotal,
    netSale,
    averageNetTicket: sold > 0 ? Math.round((netSale / sold) * 100) / 100 : 0,
  };
};
