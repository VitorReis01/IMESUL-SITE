import { verifyMetaSignature } from "../../../../Backend.js/metaSignature";
import { imebotUnavailable, isImebotEnabled } from "../../../../Backend.js/imebotFeatureGate";
import {
  applyImebotEvent,
  assertLeadOwnedBySeller,
  findActiveWhatsappImebotLeadByPhone,
  findLeadByCode,
  findPendingLeadByCode,
  findSellerBySenderPhone,
  getSellerPerformanceSummary,
  getSellerRecentLeads,
  notifyImebotOfNewLead,
  recordLeadEvent,
  registerIncomingPdf,
  registerWebhookEventOnce,
  resolveInboundLeadContext,
  searchSellerLeads,
} from "../../../../Backend.js/imebotStore";
import { createLead } from "../../../../Backend.js/salesLeadsStore";
import { createHandoffLink } from "../../../../Backend.js/handoffStore";
import {
  completeFeedbackObservation,
  getActiveCustomerConversation,
  recordFeedbackRating,
  startHandoffServiceFeedback,
  updateConversationState,
} from "../../../../Backend.js/feedbackStore";
import {
  cancelReturnConfirmation,
  confirmReturn,
  requestReturnConfirmation,
} from "../../../../Backend.js/salesReturnsStore";
import { IMEBOT_EVENTS, parseSaleAmount, shouldRequestPdf } from "../../../../lib/imebotStateMachine";
import { COMMERCIAL_UNITS, FEEDBACK_TYPE, IMEBOT_STATE, LEAD_SITE_ORIGIN, LEAD_FLOW_TYPES } from "../../../../lib/leadFlow";
import { isAffirmativeAnswer, isNegativeAnswer, parseFeedbackRating } from "../../../../lib/customerFeedback";
import { isActiveInternalSeller } from "../../../../lib/sellerAuth";
import { checkRateLimitLayers } from "../../../../Backend.js/rateLimiter";
import { checkInboundAbuseGuard, reservePaidActionBudget } from "../../../../Backend.js/imebotAbuseGuard";
import { getRequestIp, methodNotAllowed as sharedMethodNotAllowed, noStoreJson } from "../../../../Backend.js/requestGuards";
import { getSalesSiteUrl } from "../../../../lib/siteUrl";

// Webhook do WhatsApp Cloud API (Meta) para o IMEbot - Fase 2, so ativo para leads de unit =
// "campo-grande" (ver isCommercialAutomationEnabledForUnit em lib/leadFlow.js). Server-to-server:
// a Meta assina cada requisicao com x-hub-signature-256 (HMAC do corpo cru + META_APP_SECRET) -
// essa assinatura E a autenticacao real aqui, nunca Origin/Referer/IP (a Meta nao envia headers
// de navegador, e pode chamar de infraestrutura compartilhada). Ver relatorio desta fase.
//
// Sem credenciais Meta reais (META_APP_SECRET etc.) configuradas nesta fase, verifyMetaSignature
// sempre falha "nao configurado" - o codigo abaixo e o desenho completo do endpoint, pronto para
// quando as credenciais existirem, mas nao pode ser testado ponta a ponta sem elas (ver relatorio).
//
// Duas "personas" de remetente sao tratadas de forma diferente (ver processInboundMessage):
// - VENDEDOR INTERNO (numero cadastrado em sales_sellers, active=TRUE, unit=campo-grande): menu
//   funcional (Meus Clientes/Buscar Lead/Registrar Devolucao/Buscar PDF/Meu Desempenho) + fluxo
//   normal de acompanhamento de venda (nome/resultado/comprador/CNPJ/valor/PDF).
// - CLIENTE (qualquer outro numero): tratado como fluxo WHATSAPP_IMEBOT - cria lead, roda o
//   MESMO rodizio de Campo Grande, e o IMEbot so recepciona/registra/distribui/mensura (nunca
//   mantem negociacao comercial longa com o cliente).

const maxBodyBytes = 1_000_000; // payload de webhook e so texto/metadados - nunca o arquivo em si

const methodNotAllowed = () => sharedMethodNotAllowed("GET, POST");

// --- GET: verificacao do webhook (handshake exigido pela Meta ao configurar a URL) -------------
export async function GET(request) {
  if (!isImebotEnabled()) return imebotUnavailable();

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expectedToken = process.env.META_WHATSAPP_VERIFY_TOKEN;
  if (!expectedToken || mode !== "subscribe" || token !== expectedToken || !challenge) {
    return new Response(null, { status: 403 });
  }

  return new Response(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
  });
}

// --- POST: eventos (mensagens inbound de vendedores e clientes) --------------------------------
export async function POST(request) {
  if (!isImebotEnabled()) return imebotUnavailable();

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > maxBodyBytes) {
    return noStoreJson({ ok: false }, { status: 413 });
  }

  // Camada leve de volume, NUNCA a autenticacao (isso e a assinatura HMAC abaixo). Numeros
  // generosos: trafego legitimo da Meta pode vir em rajadas de varias contas ao mesmo tempo.
  // Falha do rate limiter aqui NAO bloqueia (diferente das rotas de cliente): a Meta reentrega
  // automaticamente, e preferimos processar um evento legitimo a perder por instabilidade do
  // Postgres - a assinatura continua obrigatoria de qualquer forma.
  try {
    const rateLimit = await checkRateLimitLayers([
      { key: `imebot-webhook:${getRequestIp(request)}`, windowMs: 60_000, max: 120 },
    ]);
    if (!rateLimit.allowed) return noStoreJson({ ok: false }, { status: 429 });
  } catch {
    // ver comentario acima - segue o processamento mesmo se o rate limiter falhar.
  }

  // SEMPRE le o corpo cru (texto) antes de qualquer parse - a assinatura e calculada sobre os
  // bytes exatos recebidos, nunca sobre um JSON re-serializado (poderia diferir por espacamento).
  const rawBody = await request.text();
  const signatureCheck = verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"));
  if (!signatureCheck.ok) {
    console.warn("[imebot-webhook] assinatura invalida:", signatureCheck.reason);
    return noStoreJson({ ok: false }, { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return noStoreJson({ ok: false }, { status: 400 });
  }

  if (!payload || payload.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) {
    return noStoreJson({ ok: false }, { status: 400 });
  }

  // A partir daqui, SEMPRE responde 200: qualquer erro de processamento fica so em log (nunca
  // stack trace na resposta) - devolver erro faria a Meta reentregar o MESMO evento
  // indefinidamente sem nunca progredir. Dedup (registerWebhookEventOnce) garante que reentregas
  // legitimas nunca sao processadas duas vezes.
  try {
    await processWebhookPayload(payload);
  } catch (err) {
    console.error("[imebot-webhook] falha ao processar payload:", err.message);
  }

  return noStoreJson({ ok: true });
}

export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;

// --- Processamento do payload --------------------------------------------------------------

const safeString = (value, limit = 4000) => (typeof value === "string" ? value.slice(0, limit) : "");

async function processWebhookPayload(payload) {
  for (const entry of payload.entry) {
    if (!Array.isArray(entry?.changes)) continue;

    for (const change of entry.changes) {
      if (change?.field !== "messages") continue;

      const messages = Array.isArray(change?.value?.messages) ? change.value.messages : [];
      for (const message of messages) {
        await processInboundMessage(message);
      }
    }
  }
}

async function processInboundMessage(message) {
  const wamid = safeString(message?.id, 200);
  if (!wamid) return;

  // Idempotencia: usa o proprio wamid da mensagem inbound como chave de dedup do evento -
  // reentregas da Meta (mesmo wamid) nunca sao processadas duas vezes, seja vendedor ou cliente.
  const isNewEvent = await registerWebhookEventOnce(wamid);
  if (!isNewEvent) return;

  const senderPhone = safeString(message?.from, 40);
  const seller = await findSellerBySenderPhone(senderPhone);

  // So trata como VENDEDOR INTERNO se ativo E da unidade com automacao ligada (Campo Grande) -
  // um vendedor de Dourados (ou inativo) escrevendo para este numero e tratado como cliente
  // comum, ja que o menu funcional e o acompanhamento de venda so existem para Campo Grande
  // nesta fase (ver relatorio desta fase, regra "IMEbot so Campo Grande").
  if (isActiveInternalSeller(seller)) {
    await handleSellerMessage({ seller, message });
    return;
  }

  await handleCustomerMessage({ senderPhone, message });
}

// ============================================================================================
// VENDEDOR: fluxo normal de acompanhamento de venda + menu funcional
// ============================================================================================

// Payload do botao gerado pelo IMEbot: "EVENTO:LEAD_CODE" (ex.: "RESULT_VENDEU:IMESUL-ABC12345") -
// identifica o lead diretamente, sem depender so de context.id (ver Backend.js/imebotStore.js).
const buttonEventMap = {
  RESULT_NEGOCIANDO: IMEBOT_EVENTS.RESULT_NEGOCIANDO,
  RESULT_VENDEU: IMEBOT_EVENTS.RESULT_VENDEU,
  RESULT_NAO_VENDEU: IMEBOT_EVENTS.RESULT_NAO_VENDEU,
  BUYER_TYPE_PERSON: IMEBOT_EVENTS.BUYER_TYPE_PERSON,
  BUYER_TYPE_COMPANY: IMEBOT_EVENTS.BUYER_TYPE_COMPANY,
};

async function handleSellerMessage({ seller, message }) {
  const contextWamid = safeString(message?.context?.id, 200);
  const type = safeString(message?.type, 40);

  if (type === "interactive" && message?.interactive?.type === "button_reply") {
    await handleButtonReply({ sellerId: seller.id, buttonId: safeString(message.interactive.button_reply?.id, 200) });
    return;
  }

  if (type === "document") {
    await handleDocumentReply({ sellerId: seller.id, contextWamid, document: message.document });
    return;
  }

  if (type === "text") {
    const text = safeString(message?.text?.body, 4000).trim();
    if (!text) return;

    // Comandos de menu tem prioridade - so caem no fluxo normal de acompanhamento (nome/
    // resultado/comprador/valor) se NAO forem reconhecidos como um comando. Nesta fase, sem
    // componentes interativos reais da Meta, os comandos sao reconhecidos por texto (ver
    // relatorio desta fase - trocar para list/button messages reais quando a Meta estiver
    // configurada).
    const handledAsMenuCommand = await handleSellerMenuCommand({ seller, text });
    if (handledAsMenuCommand) return;

    await handleTextReply({ sellerId: seller.id, contextWamid, text });
  }
}

async function handleButtonReply({ sellerId, buttonId }) {
  const [eventKey, leadCode] = buttonId.split(":");
  const event = buttonEventMap[eventKey];
  if (!event || !leadCode) {
    console.warn("[imebot-webhook] payload de botao invalido:", buttonId);
    return;
  }

  const lead = await findPendingLeadByCode({ sellerId, leadCode });
  if (!lead) {
    console.warn("[imebot-webhook] botao referencia lead nao pendente/nao encontrado:", leadCode);
    return;
  }

  const result = await applyImebotEvent({ leadId: lead.id, event, actorId: sellerId });
  if (!result.ok) console.warn("[imebot-webhook] transicao invalida via botao:", result.reason);
}

async function handleTextReply({ sellerId, contextWamid, text }) {
  const resolution = await resolveInboundLeadContext({ sellerId, contextWamid });
  if (!resolution.ok) {
    // AMBIGUOUS (varios leads pendentes, sem contexto seguro) ou NO_PENDING_LEAD - em nenhum dos
    // dois casos adivinhamos. Quando as credenciais Meta existirem, este e o ponto onde o IMEbot
    // envia ao vendedor a lista de Lead IDs pendentes para ele escolher explicitamente.
    if (resolution.reason === "AMBIGUOUS") {
      console.warn(
        "[imebot-webhook] resposta de texto ambigua - vendedor tem multiplos leads pendentes:",
        resolution.candidates.map((lead) => lead.leadCode)
      );
    }
    return;
  }

  const lead = resolution.lead;

  if (lead.imebotState === IMEBOT_STATE.WAITING_CUSTOMER_NAME) {
    const result = await applyImebotEvent({ leadId: lead.id, event: IMEBOT_EVENTS.NAME_RECEIVED, customerName: text, actorId: sellerId });
    if (!result.ok) console.warn("[imebot-webhook] falha ao registrar nome:", result.reason);
    return;
  }

  if (lead.imebotState === IMEBOT_STATE.WAITING_BUYER_NAME) {
    const result = await applyImebotEvent({ leadId: lead.id, event: IMEBOT_EVENTS.BUYER_NAME_RECEIVED, buyerName: text, actorId: sellerId });
    if (!result.ok) console.warn("[imebot-webhook] falha ao registrar comprador:", result.reason);
    return;
  }

  if (lead.imebotState === IMEBOT_STATE.WAITING_BUYER_CNPJ) {
    // Validacao real (dígitos verificadores) roda dentro de applyImebotEvent - aqui so repassa o
    // texto bruto, nunca confia em validacao feita antes.
    const result = await applyImebotEvent({ leadId: lead.id, event: IMEBOT_EVENTS.BUYER_CNPJ_RECEIVED, buyerCnpj: text, actorId: sellerId });
    if (!result.ok) console.warn("[imebot-webhook] CNPJ invalido/rejeitado:", result.reason);
    return;
  }

  if (lead.imebotState === IMEBOT_STATE.WAITING_SALE_VALUE) {
    const parsed = parseSaleAmount(text);
    if (!parsed.ok) {
      console.warn("[imebot-webhook] valor de venda invalido recebido:", parsed.reason);
      return;
    }
    const result = await applyImebotEvent({ leadId: lead.id, event: IMEBOT_EVENTS.SALE_VALUE_RECEIVED, saleAmount: parsed.amount, actorId: sellerId });
    if (!result.ok) console.warn("[imebot-webhook] falha ao registrar valor:", result.reason);
    return;
  }

  // Texto livre fora de um estado que espera texto (ex.: vendedor mandou algo enquanto o bot
  // espera um botao) - ignorado nesta fase; nao ha envio de mensagem pedindo esclarecimento sem
  // credenciais Meta reais configuradas.
}

async function handleDocumentReply({ sellerId, contextWamid, document }) {
  const resolution = await resolveInboundLeadContext({ sellerId, contextWamid });
  if (!resolution.ok) {
    if (resolution.reason === "AMBIGUOUS") {
      console.warn("[imebot-webhook] PDF recebido de forma ambigua - vendedor tem multiplos leads pendentes.");
    }
    return;
  }

  const lead = resolution.lead;
  if (lead.imebotState !== IMEBOT_STATE.WAITING_PDF) {
    // PDF fora de contexto (fluxo GUIDED_QUOTE/CART nunca chega em WAITING_PDF, ou o lead ainda
    // nao vendeu) - nunca aceito. Reforca a regra "PDF somente DIRECT_CONTACT/WHATSAPP_IMEBOT +
    // VENDEU".
    console.warn("[imebot-webhook] PDF recebido fora do estado WAITING_PDF - ignorado.");
    return;
  }

  await registerIncomingPdf({
    leadId: lead.id,
    metaMediaId: safeString(document?.id, 200),
    originalName: safeString(document?.filename, 200),
    mime: safeString(document?.mime_type, 120),
    leadCode: lead.leadCode,
    customerName: lead.customerName,
  });

  const result = await applyImebotEvent({ leadId: lead.id, event: IMEBOT_EVENTS.PDF_RECEIVED, actorId: sellerId });
  if (!result.ok) console.warn("[imebot-webhook] falha ao concluir apos PDF:", result.reason);
}

// --- Menu funcional do vendedor ("Meus Clientes"/"Buscar Lead"/"Registrar Devolução"/
// "Buscar PDF"/"Meu Desempenho") --------------------------------------------------------------
//
// Reconhecimento por palavra-chave nesta fase (sem componentes interativos reais da Meta para
// testar) - documentado no relatório desta fase como próximo passo trocar para list/button
// messages reais quando as credenciais existirem. Retorna true se o texto foi tratado como
// comando de menu (para o chamador não cair também no fluxo normal de acompanhamento).
async function handleSellerMenuCommand({ seller, text }) {
  const upper = text.toUpperCase();

  if (upper === "MEUS CLIENTES") {
    const leads = await getSellerRecentLeads(seller.id, { limit: 10 });
    console.info(`[imebot-webhook] MEUS CLIENTES (vendedor ${seller.id}):`, leads.map((l) => l.leadCode));
    return true;
  }

  if (upper.startsWith("BUSCAR LEAD")) {
    const term = text.slice("BUSCAR LEAD".length).trim();
    const results = await searchSellerLeads(seller.id, { searchTerm: term });
    console.info(`[imebot-webhook] BUSCAR LEAD "${term}" (vendedor ${seller.id}):`, results.map((l) => l.leadCode));
    return true;
  }

  if (upper === "MEU DESEMPENHO") {
    const summary = await getSellerPerformanceSummary(seller.id);
    console.info(`[imebot-webhook] MEU DESEMPENHO (vendedor ${seller.id}):`, summary);
    return true;
  }

  if (upper.startsWith("BUSCAR PDF")) {
    const leadCode = text.slice("BUSCAR PDF".length).trim();
    await handleSellerPdfRequest({ seller, leadCode });
    return true;
  }

  if (upper.startsWith("DEVOLUCAO") || upper.startsWith("DEVOLUÇÃO")) {
    await handleSellerReturnCommand({ seller, text });
    return true;
  }

  if (upper.startsWith("CONFIRMAR DEVOLUCAO") || upper.startsWith("CONFIRMAR DEVOLUÇÃO")) {
    const token = text.replace(/^confirmar devolu[cç][aã]o/i, "").trim();
    const result = await confirmReturn({ token, sellerId: seller.id });
    if (!result.ok) console.warn("[imebot-webhook] confirmação de devolução recusada:", result.reason);
    return true;
  }

  if (upper.startsWith("CANCELAR DEVOLUCAO") || upper.startsWith("CANCELAR DEVOLUÇÃO")) {
    const token = text.replace(/^cancelar devolu[cç][aã]o/i, "").trim();
    const result = await cancelReturnConfirmation({ token, sellerId: seller.id });
    if (!result.ok) console.warn("[imebot-webhook] cancelamento de devolução recusado:", result.reason);
    return true;
  }

  return false;
}

// Formato aceito nesta fase: "DEVOLUCAO <LEAD_CODE> <VALOR>" (ex.: "DEVOLUCAO IMESUL-ABC12345
// 2000"). Este comando NAO grava a devolução financeira: ele cria uma confirmação pendente com
// expiração. Só "CONFIRMAR DEVOLUCAO <token>" registra o evento financeiro dentro de transação
// com FOR UPDATE e revalidação do total devolvido.
async function handleSellerReturnCommand({ seller, text }) {
  const rest = text.replace(/^devolu[cç][aã]o/i, "").trim();
  const parts = rest.split(/\s+/);
  const leadCode = parts[0];
  const amountText = parts.slice(1).join(" ");

  if (!leadCode || !amountText) {
    console.warn("[imebot-webhook] comando de devolução em formato inválido:", text);
    return;
  }

  const lead = await findLeadByCode(leadCode);
  if (!lead) {
    console.warn("[imebot-webhook] devolução: Lead ID não encontrado:", leadCode);
    return;
  }

  const ownership = await assertLeadOwnedBySeller({ leadId: lead.id, sellerId: seller.id });
  if (!ownership.ok) {
    // Negado de forma segura - assertLeadOwnedBySeller já registrou a tentativa para auditoria,
    // sem revelar ao vendedor quem é o dono real do lead (ver relatório desta fase).
    console.warn("[imebot-webhook] devolução negada (lead não pertence a este vendedor):", leadCode);
    return;
  }

  const parsedAmount = parseSaleAmount(amountText);
  if (!parsedAmount.ok) {
    console.warn("[imebot-webhook] devolução: valor inválido:", parsedAmount.reason);
    return;
  }

  const result = await requestReturnConfirmation({
    leadId: lead.id,
    sellerId: seller.id,
    amount: parsedAmount.amount,
    reason: "",
  });

  if (!result.ok) {
    console.warn("[imebot-webhook] devolução recusada:", result.reason);
    return;
  }

  console.info(`[imebot-webhook] devolução aguardando confirmação para ${leadCode}:`, {
    confirmationId: result.confirmationId,
    current: result.current,
    preview: result.preview,
    tokenAvailable: Boolean(result.token),
  });
}

async function handleSellerPdfRequest({ seller, leadCode }) {
  if (!leadCode) return;

  const lead = await findLeadByCode(leadCode);
  if (!lead) {
    console.warn("[imebot-webhook] busca de PDF: Lead ID não encontrado:", leadCode);
    return;
  }

  const ownership = await assertLeadOwnedBySeller({ leadId: lead.id, sellerId: seller.id });
  if (!ownership.ok) {
    console.warn("[imebot-webhook] busca de PDF negada (lead não pertence a este vendedor):", leadCode);
    return;
  }

  if (!shouldRequestPdf(lead.flowType)) {
    console.warn("[imebot-webhook] busca de PDF: este fluxo nunca teve PDF:", lead.flowType);
    return;
  }

  // Contrato documentado (ver relatório desta fase, "PDF Retrieval"): a entrega de volta ao
  // vendedor via WhatsApp depende de (1) o PDF já estar STORED (ver sales_lead_files/PDF
  // Bridge) e (2) credenciais Meta reais para reenviar o documento como mídia outbound - nenhuma
  // das duas existe nesta fase. O pedido fica registrado na auditoria (PDF_RETRIEVAL_REQUESTED)
  // para existir uma fila real quando a entrega for implementada; nunca cria URL pública, nunca
  // serve o arquivo diretamente pela internet.
  await recordLeadEvent({
    leadId: lead.id,
    eventType: "PDF_RETRIEVAL_REQUESTED",
    actorType: "seller",
    actorId: String(seller.id),
  });
  console.info(`[imebot-webhook] pedido de PDF autorizado para ${leadCode} (vendedor ${seller.id}) - entrega depende do PDF Bridge + credenciais Meta.`);
}

// ============================================================================================
// CLIENTE: fluxo WHATSAPP_IMEBOT (cliente inicia a conversa direto no número oficial)
// ============================================================================================

async function handleCustomerMessage({ senderPhone, message }) {
  // Nesta fase, o numero oficial do IMEbot so atende Campo Grande (ver relatorio desta fase) -
  // qualquer mensagem de cliente aqui vira um lead WHATSAPP_IMEBOT dessa unidade.
  const unit = COMMERCIAL_UNITS.CAMPO_GRANDE;
  const initialText = safeString(message?.text?.body, 1000) || "(mensagem sem texto - mídia ou outro tipo)";

  // ABUSE GUARD (A): roda para TODA mensagem de cliente, antes de qualquer leitura/escrita no
  // banco - conversa existente ou lead novo. Nunca toca a quota paga global (ver
  // Backend.js/imebotAbuseGuard.js) - so as camadas por telefone/repeticao.
  const abuseGuard = await checkInboundAbuseGuard({ phone: senderPhone, messageText: initialText, unit });
  if (!abuseGuard.allowed) return;

  const existingLead = await findActiveWhatsappImebotLeadByPhone(senderPhone);
  if (existingLead) {
    // Cliente já tem um atendimento em andamento desta conversa - a mesma mensagem inicial (ou
    // uma nova mensagem da mesma conversa) NUNCA cria um segundo lead (ver relatório desta
    // fase). Sem envio real de mensagem nesta fase, não há resposta adicional a dar aqui.
    await handleExistingCustomerConversation({ senderPhone, message, lead: existingLead });
    return;
  }

  // PAID ACTION BUDGET (B): só reservada agora, imediatamente antes da ação que de fato pode
  // gerar custo (criar lead + acionar rodízio/handoff). Mensagens já barradas pelo abuse guard
  // acima nunca chegam aqui, então nunca consomem quota paga (ver requisito de separação A/B).
  const budgetGuard = await reservePaidActionBudget({ unit });
  if (!budgetGuard.allowed) return;

  const lead = await createLead(
    {
      visitorId: `whatsapp-${String(senderPhone).replace(/\D/g, "")}`,
      customerPhone: String(senderPhone).replace(/\D/g, ""),
      quoteSummary: initialText,
      product: "",
      origin: "whatsapp-imebot",
      source: "whatsapp-imebot",
      flowType: LEAD_FLOW_TYPES.WHATSAPP_IMEBOT,
      siteOrigin: LEAD_SITE_ORIGIN.WHATSAPP,
      unit,
      pagePath: "whatsapp-imebot",
    },
    { allowWhatsappOrigin: true }
  );

  if (!lead.ok) {
    console.error("[imebot-webhook] falha ao criar lead WHATSAPP_IMEBOT:", lead.reason);
    return;
  }

  if (lead.seller) {
    const handoff = await createHandoffLink({ leadId: lead.leadId, sellerId: lead.seller.id });
    const baseUrl = process.env.IMEBOT_PUBLIC_BASE_URL || getSalesSiteUrl();
    const handoffUrl = baseUrl ? `${baseUrl.replace(/\/$/, "")}/r/${handoff.token}` : `/r/${handoff.token}`;
    console.info(`[imebot-webhook] handoff rastreável criado para ${lead.leadCode}:`, {
      seller: lead.seller.name,
      handoffLinkId: handoff.handoffLinkId,
      urlAvailable: Boolean(baseUrl),
    });
    // Notificação interna ao vendedor (mesmo mecanismo dos outros fluxos) - a resposta real ao
    // CLIENTE ("Você foi direcionado para Fulano, [FALAR COM FULANO]") depende de credenciais
    // Meta reais para ser enviada (ver relatório desta fase). O lead e o rodízio já aconteceram
    // de qualquer forma - a falha de envio nunca bloqueia o registro/distribuição.
    // handoffUrl é deliberadamente opaco: não contém lead_id, telefone nem seller_id.
    void handoffUrl;
    await notifyImebotOfNewLead({ leadId: lead.leadId, unit });
  } else {
    console.warn("[imebot-webhook] lead WHATSAPP_IMEBOT criado sem vendedor disponível:", lead.leadCode);
  }
}

async function handleExistingCustomerConversation({ senderPhone, message, lead }) {
  const type = safeString(message?.type, 40);
  if (type !== "text") return;

  const text = safeString(message?.text?.body, 1000).trim();
  if (!text) return;

  const conversation = await getActiveCustomerConversation({ leadId: lead.id, customerPhone: senderPhone });

  if (conversation?.state === "WAITING_RATING") {
    const parsed = parseFeedbackRating(text);
    if (!parsed.ok) {
      console.warn("[imebot-webhook] nota de atendimento inválida:", parsed.reason);
      return;
    }
    await recordFeedbackRating({ leadId: lead.id, feedbackType: FEEDBACK_TYPE.HANDOFF_SERVICE, rating: parsed.rating });
    await updateConversationState({
      conversationId: conversation.id,
      state: "WAITING_OBSERVATION_CHOICE",
      context: { feedbackType: FEEDBACK_TYPE.HANDOFF_SERVICE, rating: parsed.rating },
    });
    return;
  }

  if (conversation?.state === "WAITING_OBSERVATION_CHOICE") {
    if (isAffirmativeAnswer(text)) {
      await updateConversationState({
        conversationId: conversation.id,
        state: "WAITING_OBSERVATION_TEXT",
        context: conversation.context || {},
      });
      return;
    }
    if (isNegativeAnswer(text)) {
      await completeFeedbackObservation({ leadId: lead.id, feedbackType: FEEDBACK_TYPE.HANDOFF_SERVICE, hasObservation: false });
      await updateConversationState({
        conversationId: conversation.id,
        state: "COMPLETED",
        context: conversation.context || {},
      });
      return;
    }
    console.warn("[imebot-webhook] resposta de observação inválida.");
    return;
  }

  if (conversation?.state === "WAITING_OBSERVATION_TEXT") {
    const result = await completeFeedbackObservation({
      leadId: lead.id,
      feedbackType: FEEDBACK_TYPE.HANDOFF_SERVICE,
      hasObservation: true,
      observation: text,
    });
    if (!result.ok) {
      console.warn("[imebot-webhook] observação de atendimento inválida:", result.reason);
      return;
    }
    await updateConversationState({
      conversationId: conversation.id,
      state: "COMPLETED",
      context: conversation.context || {},
    });
    return;
  }

  if (isAffirmativeAnswer(text)) {
    await recordLeadEvent({
      leadId: lead.id,
      eventType: "CUSTOMER_CONFIRMED_ATTENDED",
      actorType: "customer",
      metadata: {},
    });
    await startHandoffServiceFeedback({ leadId: lead.id, sellerId: lead.sellerId, customerPhone: senderPhone });
    return;
  }

  if (isNegativeAnswer(text)) {
    await recordLeadEvent({
      leadId: lead.id,
      eventType: "CUSTOMER_CONFIRMED_NOT_ATTENDED",
      actorType: "customer",
      metadata: {},
    });
    if (lead.sellerId) {
      const handoff = await createHandoffLink({ leadId: lead.id, sellerId: lead.sellerId });
      await recordLeadEvent({
        leadId: lead.id,
        eventType: "HANDOFF_REOFFERED",
        actorType: "system",
        actorId: String(lead.sellerId),
        metadata: { handoffLinkId: handoff.handoffLinkId },
      });
    }
  }
}
