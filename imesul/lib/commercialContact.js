"use client";

// Ponto único para qualquer CTA comercial de WhatsApp do site institucional (navbar, botão
// flutuante, CTA final, central de links, seção de avaliações). Resolve a unidade (preferência
// salva ou modal de escolha), cria o lead DIRECT_CONTACT no backend de vendas (cross-origin,
// lib/leadClient.js) e abre o WhatsApp do vendedor sorteado pelo rodízio daquela unidade (só
// Campo Grande). Nunca deixa o cliente sem conseguir falar com a IMESUL: qualquer falha cai no
// número humano correto da unidade (ver lib/unitPreference.js getCommercialUnitConfig) - nunca
// no número genérico (que vai virar o IMEbot) quando a unidade já é conhecida.
//
// Quando a unidade já é conhecida, pré-abre uma aba de forma síncrona e a preenche após o lead.
// Quando a unidade ainda precisa ser escolhida, NÃO abre about:blank antes do modal; depois da
// escolha navega a própria aba para o WhatsApp, evitando popup bloqueado/aba branca no mobile.
import { whatsapp } from "../data/products";
import { createLead } from "./leadClient";
import { COMMERCIAL_UNITS, getCommercialUnitConfig, getStoredUnit, setStoredUnit } from "./unitPreference";
import { requestUnitChoice } from "./unitPickerBridge";
import { getVisitorId } from "./visitorId";
import { notifyCommercialContactBlocked } from "./commercialContactAlert";
import { trackEvent } from "./trackEvent";

const createWhatsAppUrl = (message, number = whatsapp.number) =>
  `https://wa.me/${number}?text=${encodeURIComponent(message)}`;

// Todo CTA deste site institucional e' DIRECT_CONTACT (nao existe orcamento guiado aqui) - o
// texto exibido ao cliente no WhatsApp e' sempre este, fixo, independente do "message"
// recebido em args (que continua indo para createLead como quoteSummary, so nao vai mais para
// o texto do WhatsApp).
const DIRECT_CONTACT_WHATSAPP_MESSAGE = "Olá, vim do site e gostaria de fazer um orçamento!";

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

// unit: se já conhecida (ex.: um card específico de uma unidade), pula o modal - só abre o
// seletor quando não há preferência salva nem unidade explícita.
//
// EXCECAO deliberada (instrucao explicita desta fase): quando o lead E criado com sucesso para
// unit = "campo-grande" mas o rodizio NAO encontra vendedor, NAO cai no WhatsApp padrao - esse
// numero (556733125600) vai virar o IMEbot e nunca deve receber clientes diretamente. Mostra o
// aviso de "tentar novamente" em vez disso. Dourados tem numero humano oficial proprio
// (confirmado pelo usuario em 2026-08-20, fonte unica em lib/unitPreference.js
// getCommercialUnitConfig) - NUNCA cai no numero generico (o mesmo do futuro IMEbot).
export const openCommercialWhatsApp = async (args) => {
  const { pagePath, message = whatsapp.message, unit = null } = args;

  // No mobile, abrir uma aba em branco ANTES de pedir a unidade coloca o about:blank em primeiro
  // plano e esconde o modal que ficou na aba original. Por isso só pré-abrimos a aba quando a
  // unidade já era conhecida no instante do clique. Se o modal for necessário, o WhatsApp será
  // aberto na própria aba depois da escolha — navegação top-level não sofre com popup blocker.
  let resolvedUnit = unit || getStoredUnit();
  const popup =
    resolvedUnit && typeof window !== "undefined" ? window.open("", "_blank") : null;

  if (!resolvedUnit) {
    resolvedUnit = await requestUnitChoice();
    setStoredUnit(resolvedUnit);
  }

  trackEvent("whatsapp_click", { section: pagePath, unit: resolvedUnit });

  // Calculado DEPOIS da unidade resolvida, para usar o numero humano oficial de Dourados quando
  // aplicavel - sem unidade conhecida (nunca deveria acontecer aqui, mas por seguranca), cai no
  // numero generico ja existente (whatsapp.number).
  const fallbackUrl = createWhatsAppUrl(DIRECT_CONTACT_WHATSAPP_MESSAGE, getCommercialUnitConfig(resolvedUnit)?.phone);

  const openResolvedUrl = (url) => {
    if (popup && !popup.closed) {
      popup.location.href = url;
      return;
    }

    // Quando houve modal, não existe popup pré-aberto. Usar a mesma aba é intencional:
    // window.open executado depois dos awaits costuma ser bloqueado no Chrome mobile.
    if (typeof window !== "undefined") window.location.assign(url);
  };

  try {
    const lead = await createLead({
      visitorId: getVisitorId(),
      quoteSummary: message,
      product: "",
      origin: typeof document !== "undefined" ? document.referrer : "",
      source: "site-institucional",
      utm: readCurrentUtm(),
      flowType: "DIRECT_CONTACT",
      siteOrigin: "institucional",
      unit: resolvedUnit,
      pagePath,
    });

    if (lead.ok && lead.seller?.whatsapp) {
      trackEvent("generate_lead", { unit: resolvedUnit });
      // Sem "Lead IMESUL: <codigo>" no texto - o codigo continua no lead (banco/analytics/admin
      // do site de vendas), so nao aparece mais pro cliente.
      const finalUrl = createWhatsAppUrl(DIRECT_CONTACT_WHATSAPP_MESSAGE, lead.seller.whatsapp);
      openResolvedUrl(finalUrl);
      return;
    }

    if (lead.ok && resolvedUnit === COMMERCIAL_UNITS.CAMPO_GRANDE) {
      trackEvent("generate_lead", { unit: resolvedUnit });
      if (popup && !popup.closed) popup.close();
      notifyCommercialContactBlocked({ retry: () => openCommercialWhatsApp({ ...args, unit: resolvedUnit }) });
      return;
    }

    openResolvedUrl(fallbackUrl);
  } catch {
    openResolvedUrl(fallbackUrl);
  }
};
