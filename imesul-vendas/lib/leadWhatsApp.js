"use client";

// Cria o lead (Lead ID + rodizio) antes de abrir o WhatsApp, para qualquer um dos 3 fluxos
// classificados em lib/leadFlow.js (DIRECT_CONTACT, GUIDED_QUOTE, CART). Compartilhado entre
// components/QuoteBuilder.jsx (GUIDED_QUOTE/CART) e os CTAs genericos de "falar com um vendedor"
// (DIRECT_CONTACT em ProjectSelector.jsx/SalesGuidanceSection.jsx) para nunca duplicar a logica
// de popup+fallback em varios arquivos.
//
// Abre uma aba em branco de forma SINCRONA (dentro do clique) e so preenche a URL depois que o
// lead responde - evita bloqueio de pop-up (a maioria dos navegadores bloqueia window.open()
// chamado depois de um await). Falha na CRIACAO do lead (banco fora do ar, requisicao caiu) cai
// no WhatsApp padrao ja existente - o cliente nunca fica sem conseguir falar com a IMESUL nesse
// cenario de indisponibilidade total.
//
// EXCECAO deliberada (instrucao explicita desta fase): quando o lead E criado com sucesso para
// unit = "campo-grande" mas o rodizio NAO encontra vendedor (nenhum ativo, etc.), NAO cai no
// WhatsApp padrao - esse numero (556733125600) vai virar o IMEbot e nunca deve receber clientes
// diretamente. Mostra o aviso de "tentar novamente" (ver CommercialContactAlert.jsx) em vez
// disso. Ver relatorio desta fase para o raciocinio completo.
//
// ARQUITETURA TERRITORIAL (instrucao explicita desta fase): Dourados NUNCA passa por este fluxo
// de lead/rodizio/IMEbot - e so um alternador simples entre as duas lojas (ver
// lib/commercialRegions.js e lib/douradosDispatch.js). O desvio acontece logo no topo desta
// funcao, antes de qualquer chamada a createLead - assim TODO chamador existente (QuoteBuilder,
// ProjectSelector, SalesGuidanceSection, CartWidget) ganha o comportamento correto sem precisar
// ser alterado individualmente.
import { createWhatsAppUrl } from "./whatsapp";
import { getAnonymousVisitorId } from "./localAnalytics";
import { createLead } from "./leads";
import { COMMERCIAL_UNITS, LEAD_FLOW_TYPES, LEAD_SITE_ORIGIN, getCommercialUnitConfig } from "./leadFlow";
import { getStoredUnit } from "./unitPreference";
import { notifyCommercialContactBlocked } from "./commercialContactAlert";
import { trackEvent } from "./trackEvent";
import { openDouradosWhatsApp } from "./douradosDispatch";

// GUIDED_QUOTE/CART ja passaram por um formulario de orcamento antes deste clique - contam como
// inicio de checkout. DIRECT_CONTACT (e qualquer flow futuro) e um contato generico via WhatsApp.
const isCheckoutFlow = (flowType) =>
  flowType === LEAD_FLOW_TYPES.GUIDED_QUOTE || flowType === LEAD_FLOW_TYPES.CART;

// Identificador estavel por "tentativa comercial" (ver Backend.js/salesLeadsStore.js#
// buildIdempotencyKey), enviado ao servidor e usado la SOMENTE para dedup - nunca decide
// vendedor/status/lead_code. randomUUID cobre todo navegador atual; fallback so por seguranca
// (ambiente sem crypto.randomUUID).
const generateClientRequestId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `cr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

// CICLO DE VIDA do clientRequestId - reaproveitado, não regenerado, para a MESMA
// visitante+mensagem enquanto o resultado da tentativa anterior for AMBÍGUO (lib/leads.js não
// conseguiu confirmar se o servidor criou o lead - timeout, conexão caiu, resposta cortada, OU a
// aba foi recarregada antes da resposta chegar). Isso cobre o caso: servidor cria o lead e
// responde 200, mas a resposta nunca chega ao navegador (timeout, ou o usuário recarrega a
// página antes dela chegar) - se o cliente tentar de novo depois, SEM isso, geraria um
// clientRequestId novo e criaria um SEGUNDO lead (o dedup do servidor não ajudaria, porque a
// chave seria diferente). Reaproveitando a mesma chave, o servidor encontra o lead já criado e
// devolve ele de novo, sem duplicar.
//
// Um resultado DEFINITIVO (sucesso, ou falha explícita do servidor - `ambiguous:false` nos dois
// casos) limpa a entrada imediatamente: a próxima tentativa para o mesmo conteúdo é uma tentativa
// NOVA, com uma chave nova. Isso é necessário para o botão "tentar novamente" (quando o lead foi
// criado mas ficou sem vendedor - ver notifyCommercialContactBlocked abaixo) continuar
// funcionando: reaproveitar a mesma chave ali devolveria sempre o MESMO lead, sem nunca tentar
// atribuir vendedor de novo.
//
// TTL curto (3 minutos) em vez de reaproveitar para sempre: depois disso, mesmo uma tentativa
// ambígua conta como "desistida" - uma tentativa nova com o mesmo texto vira uma tentativa
// realmente nova (cobre o caso de um orçamento novo e legítimo, coincidentemente com o mesmo
// texto, minutos depois).
//
// Persistido em sessionStorage (nunca localStorage) - sobrevive a um RELOAD da mesma aba (o que
// um Map em memória não sobrevive), mas nunca vaza para outra aba/sessão nem fica permanente:
// sessionStorage é isolado por aba e some quando a aba fecha. Guardado como UM objeto JSON só
// (todas as tentativas pendentes juntas) para minimizar chaves tocadas no storage.
const pendingAmbiguousAttemptTtlMs = 3 * 60 * 1000;
export const pendingAttemptsStorageKey = "imesul_pending_lead_attempts_v1";

const readPendingAttempts = () => {
  if (typeof window === "undefined" || !window.sessionStorage) return {};
  try {
    const raw = window.sessionStorage.getItem(pendingAttemptsStorageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    // JSON corrompido ou sessionStorage indisponivel (modo privado antigo, quota) - degrada para
    // "sem tentativa pendente" em vez de quebrar o fluxo de lead por causa disso.
    return {};
  }
};

const writePendingAttempts = (attempts) => {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(pendingAttemptsStorageKey, JSON.stringify(attempts));
  } catch {
    // sessionStorage indisponivel/cheio - degrada para o comportamento sem persistencia entre
    // reload (equivalente ao Map antigo); nunca quebra o fluxo de lead por isso.
  }
};

const getClientRequestIdForAttempt = (attemptKey) => {
  const now = Date.now();
  const attempts = readPendingAttempts();
  let changed = false;

  // Higiene barata: limpa entradas vencidas de outras tentativas ao ler o storage, para ele
  // nunca crescer sem limite numa aba de uso prolongado.
  for (const key of Object.keys(attempts)) {
    if (!attempts[key] || attempts[key].expiresAt <= now) {
      delete attempts[key];
      changed = true;
    }
  }

  const cached = attempts[attemptKey];
  if (cached && cached.expiresAt > now) {
    if (changed) writePendingAttempts(attempts);
    return cached.clientRequestId;
  }

  const clientRequestId = generateClientRequestId();
  attempts[attemptKey] = { clientRequestId, expiresAt: now + pendingAmbiguousAttemptTtlMs };
  writePendingAttempts(attempts);
  return clientRequestId;
};

const clearPendingAttempt = (attemptKey) => {
  const attempts = readPendingAttempts();
  if (!(attemptKey in attempts)) return;
  delete attempts[attemptKey];
  writePendingAttempts(attempts);
};

// Guarda em memoria da aba contra clique duplo: duas chamadas para o MESMO
// visitante+mensagem, disparadas antes da primeira terminar, reaproveitam a mesma promise em vez
// de abrir um segundo popup em branco e criar uma segunda tentativa. Nao substitui a dedup do
// servidor (que continua sendo a garantia real via UNIQUE em sales_leads.idempotency_key) - so
// evita o efeito colateral visivel (popup extra) e uma segunda chamada de rede desnecessaria no
// caso comum de clique duplo na mesma aba.
const inFlightLeadAttempts = new Map();

// Le UTM da URL atual so no momento do clique - nao duplica a logica de "primeiro toque
// persistido" do analytics (lib/localAnalytics.js), que fica intocada. Um lead reflete o
// contexto do pedido em si, nao a sessao inteira do visitante.
const readCurrentUtm = () => {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  return {
    source: params.get("utm_source") || "",
    medium: params.get("utm_medium") || "",
    campaign: params.get("utm_campaign") || "",
    content: params.get("utm_content") || "",
    term: params.get("utm_term") || "",
  };
};

export const openWhatsAppWithLead = async (args) => {
  const {
    message,
    flowType,
    product = "",
    pagePath = "",
    // Sem unidade explicita, usa a preferencia ja persistida (?unidade= capturado antes, ou uma
    // escolha manual futura) - assim qualquer pagina se beneficia sem precisar receber a unidade
    // via prop.
    unit = getStoredUnit(),
    origin = "",
    siteOrigin = LEAD_SITE_ORIGIN.VENDAS,
    // Vincula um cart_sessions ja rastreado (rastreio opcional, com consentimento - ver
    // lib/cartTracking.js) ao lead criado, so para o checkout do carrinho.
    cartCode = "",
  } = args;

  // Dourados: sai daqui ANTES de calcular fallbackUrl/abrir popup - openDouradosWhatsApp cuida
  // do proprio popup sincrono e da propria URL final (alternador Centro/Fabrica), sem lead, sem
  // IMEbot, sem rodizio (ver lib/leadFlow.js#isCommercialAutomationEnabledForUnit).
  if (unit === COMMERCIAL_UNITS.DOURADOS) {
    return openDouradosWhatsApp({ message, pagePath });
  }

  // Protecao contra clique duplo (ver inFlightLeadAttempts acima): mesma visitante+mensagem ja
  // em andamento nesta aba reaproveita a mesma tentativa, sem abrir um segundo popup nem chamar
  // /api/leads de novo. Colocado DEPOIS do desvio de Dourados de proposito - Dourados nao passa
  // por lead/dedup, entao fica fora desta guarda.
  const visitorId = getAnonymousVisitorId();
  const attemptKey = `${visitorId}|${message}`;
  const existingAttempt = inFlightLeadAttempts.get(attemptKey);
  if (existingAttempt) return existingAttempt;

  // Numero de fallback e' consciente da unidade: Dourados tem numero humano oficial proprio
  // (fonte unica em lib/leadFlow.js getCommercialUnitConfig) - nunca cai no numero generico
  // (que e' o mesmo do futuro IMEbot) quando a unidade Dourados ja e conhecida. Sem unidade
  // conhecida, mantem o comportamento generico ja existente (NEXT_PUBLIC_WHATSAPP_NUMBER).
  const fallbackUrl = createWhatsAppUrl(message, getCommercialUnitConfig(unit)?.phone);
  const popup = typeof window !== "undefined" ? window.open("", "_blank") : null;

  trackEvent(isCheckoutFlow(flowType) ? "begin_checkout" : "whatsapp_click", { section: pagePath, unit });

  const attempt = (async () => {
    try {
      const lead = await createLead({
        visitorId,
        quoteSummary: message,
        product,
        origin: origin || (typeof document !== "undefined" ? document.referrer : "") || "",
        source: "site",
        utm: readCurrentUtm(),
        flowType,
        siteOrigin,
        unit,
        pagePath,
        cartCode,
        // Ver ciclo de vida completo no comentario de getClientRequestIdForAttempt acima. So
        // usado para dedup no servidor (Backend.js/salesLeadsStore.js#buildIdempotencyKey).
        clientRequestId: getClientRequestIdForAttempt(attemptKey),
      });

      if (!lead.ambiguous) {
        // Resultado definitivo (sucesso OU falha explicita do servidor) - a proxima tentativa
        // para o mesmo conteudo comeca do zero, nunca reaproveita esta chave.
        clearPendingAttempt(attemptKey);
      }

      if (lead.ok && lead.seller?.whatsapp) {
        trackEvent("generate_lead", { unit });
        const finalUrl = createWhatsAppUrl(`${message}\n\nLead IMESUL: ${lead.leadCode}`, lead.seller.whatsapp);
        if (popup && !popup.closed) popup.location.href = finalUrl;
        else window.open(finalUrl, "_blank", "noopener,noreferrer");
        return;
      }

      // Lead criado, mas sem vendedor - se for Campo Grande, o rodizio deveria ter encontrado
      // Felipe/Bruniely; nao encontrar significa "nenhum vendedor ativo agora", nao "unidade sem
      // automacao" (Dourados). Nesse caso especifico, nunca abre o WhatsApp padrao.
      if (lead.ok && unit === COMMERCIAL_UNITS.CAMPO_GRANDE) {
        trackEvent("generate_lead", { unit });
        if (popup && !popup.closed) popup.close();
        notifyCommercialContactBlocked({ retry: () => openWhatsAppWithLead(args) });
        return;
      }

      if (popup && !popup.closed) popup.location.href = fallbackUrl;
      else window.open(fallbackUrl, "_blank", "noopener,noreferrer");
    } catch {
      if (popup && !popup.closed) popup.location.href = fallbackUrl;
      else window.open(fallbackUrl, "_blank", "noopener,noreferrer");
    }
  })();

  inFlightLeadAttempts.set(attemptKey, attempt);
  try {
    await attempt;
  } finally {
    inFlightLeadAttempts.delete(attemptKey);
  }
};
