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

  // Numero de fallback e' consciente da unidade: Dourados tem numero humano oficial proprio
  // (fonte unica em lib/leadFlow.js getCommercialUnitConfig) - nunca cai no numero generico
  // (que e' o mesmo do futuro IMEbot) quando a unidade Dourados ja e conhecida. Sem unidade
  // conhecida, mantem o comportamento generico ja existente (NEXT_PUBLIC_WHATSAPP_NUMBER).
  const fallbackUrl = createWhatsAppUrl(message, getCommercialUnitConfig(unit)?.phone);
  const popup = typeof window !== "undefined" ? window.open("", "_blank") : null;

  trackEvent(isCheckoutFlow(flowType) ? "begin_checkout" : "whatsapp_click", { section: pagePath, unit });

  try {
    const lead = await createLead({
      visitorId: getAnonymousVisitorId(),
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
    });

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
};
