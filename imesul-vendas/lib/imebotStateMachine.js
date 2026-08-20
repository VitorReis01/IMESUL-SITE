// Máquina de estados PURA do IMEbot (sem I/O, sem "server-only" - importável por testes e pelo
// backend). Só roda para leads de unit = "campo-grande" (ver isCommercialAutomationEnabledForUnit
// em lib/leadFlow.js) - quem chama esta função já deve ter checado isso antes.
import { IMEBOT_STATE, LEAD_FLOW_TYPES } from "./leadFlow";

export const IMEBOT_EVENTS = {
  NAME_RECEIVED: "NAME_RECEIVED",
  RESULT_NEGOCIANDO: "RESULT_NEGOCIANDO",
  RESULT_VENDEU: "RESULT_VENDEU",
  RESULT_NAO_VENDEU: "RESULT_NAO_VENDEU",
  BUYER_TYPE_PERSON: "BUYER_TYPE_PERSON",
  BUYER_TYPE_COMPANY: "BUYER_TYPE_COMPANY",
  BUYER_NAME_RECEIVED: "BUYER_NAME_RECEIVED",
  BUYER_CNPJ_RECEIVED: "BUYER_CNPJ_RECEIVED",
  SALE_VALUE_RECEIVED: "SALE_VALUE_RECEIVED",
  PDF_RECEIVED: "PDF_RECEIVED",
};

// Estados em que o bot aceita um dos 3 botões de resultado (NEGOCIANDO/VENDEU/NÃO VENDEU) -
// WAITING_RESULT é a primeira pergunta (logo após o nome); NEGOTIATING é o mesmo conjunto de
// respostas válidas quando o vendedor atualiza o resultado depois (ex.: escolheu "Negociando"
// antes e agora quer marcar "Vendeu").
const resultAwaitingStates = new Set([IMEBOT_STATE.WAITING_RESULT, IMEBOT_STATE.NEGOTIATING]);

// PDF é pedido nos fluxos DIRECT_CONTACT e WHATSAPP_IMEBOT (contato direto com um vendedor,
// sem material pré-selecionado) - GUIDED_QUOTE e CART nunca pedem PDF (regra explícita desta
// fase, repetida em vários pontos do projeto para nunca ser esquecida em um novo caminho).
export const shouldRequestPdf = (flowType) =>
  flowType === LEAD_FLOW_TYPES.DIRECT_CONTACT || flowType === LEAD_FLOW_TYPES.WHATSAPP_IMEBOT;

// Retorna { ok: true, nextState } ou { ok: false, reason } - nunca lança. Uma transição inválida
// (ex.: PDF chegando fora de WAITING_PDF, ou um evento desconhecido) é um retorno normal, não uma
// exceção - quem chama (webhook) decide o que fazer (ignorar, logar, pedir esclarecimento).
//
// buyerType: necessário só para decidir o próximo passo depois de BUYER_NAME_RECEIVED (pessoa
// física pula direto para o valor; empresa ainda precisa do CNPJ) - vem do que já foi gravado no
// lead (ver Backend.js/imebotStore.js), nunca inventado aqui.
export const computeNextImebotState = ({ currentState, event, flowType, buyerType }) => {
  if (currentState === IMEBOT_STATE.COMPLETED || currentState === IMEBOT_STATE.REJECTED) {
    return { ok: false, reason: "Acompanhamento já concluído para este lead." };
  }

  if (event === IMEBOT_EVENTS.NAME_RECEIVED) {
    if (currentState !== IMEBOT_STATE.WAITING_CUSTOMER_NAME) {
      return { ok: false, reason: "Nome não é esperado neste estado." };
    }
    return { ok: true, nextState: IMEBOT_STATE.WAITING_RESULT };
  }

  if (event === IMEBOT_EVENTS.RESULT_NEGOCIANDO) {
    if (!resultAwaitingStates.has(currentState)) return { ok: false, reason: "Resultado não é esperado neste estado." };
    return { ok: true, nextState: IMEBOT_STATE.NEGOTIATING };
  }

  if (event === IMEBOT_EVENTS.RESULT_NAO_VENDEU) {
    if (!resultAwaitingStates.has(currentState)) return { ok: false, reason: "Resultado não é esperado neste estado." };
    return { ok: true, nextState: IMEBOT_STATE.REJECTED };
  }

  if (event === IMEBOT_EVENTS.RESULT_VENDEU) {
    if (!resultAwaitingStates.has(currentState)) return { ok: false, reason: "Resultado não é esperado neste estado." };
    return { ok: true, nextState: IMEBOT_STATE.WAITING_BUYER_TYPE };
  }

  if (event === IMEBOT_EVENTS.BUYER_TYPE_PERSON || event === IMEBOT_EVENTS.BUYER_TYPE_COMPANY) {
    if (currentState !== IMEBOT_STATE.WAITING_BUYER_TYPE) {
      return { ok: false, reason: "Tipo de comprador não é esperado neste estado." };
    }
    return { ok: true, nextState: IMEBOT_STATE.WAITING_BUYER_NAME };
  }

  if (event === IMEBOT_EVENTS.BUYER_NAME_RECEIVED) {
    if (currentState !== IMEBOT_STATE.WAITING_BUYER_NAME) {
      return { ok: false, reason: "Nome do comprador não é esperado neste estado." };
    }
    // PERSON pula CNPJ; COMPANY precisa do CNPJ antes do valor. Sem buyerType conhecido (nunca
    // deveria acontecer - o evento anterior sempre grava um), trata com segurança como COMPANY
    // (pede mais informação em vez de pular uma etapa obrigatória).
    return { ok: true, nextState: buyerType === "PERSON" ? IMEBOT_STATE.WAITING_SALE_VALUE : IMEBOT_STATE.WAITING_BUYER_CNPJ };
  }

  if (event === IMEBOT_EVENTS.BUYER_CNPJ_RECEIVED) {
    if (currentState !== IMEBOT_STATE.WAITING_BUYER_CNPJ) {
      return { ok: false, reason: "CNPJ não é esperado neste estado." };
    }
    return { ok: true, nextState: IMEBOT_STATE.WAITING_SALE_VALUE };
  }

  if (event === IMEBOT_EVENTS.SALE_VALUE_RECEIVED) {
    if (currentState !== IMEBOT_STATE.WAITING_SALE_VALUE) {
      return { ok: false, reason: "Valor não é esperado neste estado." };
    }
    return { ok: true, nextState: shouldRequestPdf(flowType) ? IMEBOT_STATE.WAITING_PDF : IMEBOT_STATE.COMPLETED };
  }

  if (event === IMEBOT_EVENTS.PDF_RECEIVED) {
    if (currentState !== IMEBOT_STATE.WAITING_PDF) {
      return { ok: false, reason: "PDF não é esperado neste estado." };
    }
    if (!shouldRequestPdf(flowType)) return { ok: false, reason: "Este fluxo nunca pede PDF." };
    return { ok: true, nextState: IMEBOT_STATE.COMPLETED };
  }

  return { ok: false, reason: `Evento desconhecido: ${event}` };
};

// Valida o texto de valor de venda enviado pelo vendedor via WhatsApp (texto livre) ANTES de
// gravar no banco - nunca confia em número já convertido pelo cliente/frontend (não existe
// frontend aqui, mas o princípio é o mesmo: o texto vem de fora, sempre revalidado no servidor).
// Aceita "1234.56", "1234,56", "R$ 1.234,56" - rejeita qualquer coisa que não vire um número
// finito, positivo, com no máximo 2 casas decimais e abaixo de um teto de segurança.
export const parseSaleAmount = (rawText) => {
  const cleaned = String(rawText ?? "")
    .replace(/r\$/gi, "")
    .trim();

  if (!cleaned) return { ok: false, reason: "Valor vazio." };

  // Rejeita negativo ANTES de qualquer normalização - depois de remover pontuação, um "-" sozinho
  // não faz parte de [\d.] e seria descartado silenciosamente, transformando "-100" em "100"
  // (positivo) em vez de rejeitar. Nunca deixar um valor negativo virar positivo por acidente.
  if (/^-/.test(cleaned)) return { ok: false, reason: "Valor deve ser positivo." };

  // Formato BR (1.234,56) vs formato simples (1234.56) - detecta pela última pontuação usada
  // como separador decimal (a que aparece por último no texto).
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;

  if (lastComma > lastDot) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    normalized = cleaned.replace(/,/g, "");
  }

  normalized = normalized.replace(/[^\d.]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return { ok: false, reason: "Formato de valor inválido." };
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: "Valor deve ser positivo." };
  if (amount > 100_000_000) return { ok: false, reason: "Valor acima do limite aceito." };

  return { ok: true, amount: Math.round(amount * 100) / 100 };
};

// Resolve a QUAL lead uma mensagem inbound do vendedor pertence - NUNCA "último lead do
// vendedor" sozinho (um vendedor pode ter vários leads simultâneos - ver relatório desta fase).
// contextLeadId: já resolvido via wamid/context.id (Backend.js/imebotStore.js consulta
// imebot_messages e passa o resultado aqui). pendingLeads: leads deste vendedor com
// imebot_state fora de COMPLETED/REJECTED.
export const resolveLeadFromContext = ({ contextLeadId, pendingLeads }) => {
  if (contextLeadId) {
    const matched = pendingLeads.find((lead) => lead.id === contextLeadId);
    if (matched) return { ok: true, lead: matched };
    // O contexto apontou para um lead que não está mais pendente (já concluído, etc.) - trata
    // como sem contexto em vez de assumir silenciosamente outro lead.
  }

  if (pendingLeads.length === 1) return { ok: true, lead: pendingLeads[0] };
  if (pendingLeads.length === 0) return { ok: false, reason: "NO_PENDING_LEAD" };

  // Mais de um lead pendente e sem contexto seguro - NUNCA adivinhar (regra explícita desta
  // fase). Quem chama deve pedir ao vendedor para selecionar o Lead ID correto.
  return { ok: false, reason: "AMBIGUOUS", candidates: pendingLeads };
};
