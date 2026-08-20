"use client";

// Ponto único para qualquer CTA comercial de WhatsApp do site institucional (navbar, botão
// flutuante, CTA final, central de links, seção de avaliações). Resolve a unidade (preferência
// salva ou modal de escolha), cria o lead DIRECT_CONTACT no backend de vendas (cross-origin,
// lib/leadClient.js) e abre o WhatsApp do vendedor sorteado pelo rodízio daquela unidade (só
// Campo Grande). Nunca deixa o cliente sem conseguir falar com a IMESUL: qualquer falha cai no
// número humano correto da unidade (ver lib/unitPreference.js getCommercialUnitConfig) - nunca
// no número genérico (que vai virar o IMEbot) quando a unidade já é conhecida.
//
// Mesmo padrão de popup+fallback usado no site de vendas (lib/leadWhatsApp.js): abre uma aba em
// branco de forma SÍNCRONA dentro do clique, preenche a URL depois que o lead responde.
import { whatsapp } from "../data/products";
import { createLead } from "./leadClient";
import { COMMERCIAL_UNITS, getCommercialUnitConfig, getStoredUnit, setStoredUnit } from "./unitPreference";
import { requestUnitChoice } from "./unitPickerBridge";
import { getVisitorId } from "./visitorId";
import { notifyCommercialContactBlocked } from "./commercialContactAlert";

const createWhatsAppUrl = (message, number = whatsapp.number) =>
  `https://wa.me/${number}?text=${encodeURIComponent(message)}`;

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
  const popup = typeof window !== "undefined" ? window.open("", "_blank") : null;

  let resolvedUnit = unit || getStoredUnit();
  if (!resolvedUnit) {
    resolvedUnit = await requestUnitChoice();
    setStoredUnit(resolvedUnit);
  }

  // Calculado DEPOIS da unidade resolvida, para usar o numero humano oficial de Dourados quando
  // aplicavel - sem unidade conhecida (nunca deveria acontecer aqui, mas por seguranca), cai no
  // numero generico ja existente (whatsapp.number).
  const fallbackUrl = createWhatsAppUrl(message, getCommercialUnitConfig(resolvedUnit)?.phone);

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
      const finalUrl = createWhatsAppUrl(`${message}\n\nLead IMESUL: ${lead.leadCode}`, lead.seller.whatsapp);
      if (popup && !popup.closed) popup.location.href = finalUrl;
      else window.open(finalUrl, "_blank", "noopener,noreferrer");
      return;
    }

    if (lead.ok && resolvedUnit === COMMERCIAL_UNITS.CAMPO_GRANDE) {
      if (popup && !popup.closed) popup.close();
      notifyCommercialContactBlocked({ retry: () => openCommercialWhatsApp({ ...args, unit: resolvedUnit }) });
      return;
    }

    if (popup && !popup.closed) popup.location.href = fallbackUrl;
    else window.open(fallbackUrl, "_blank", "noopener,noreferrer");
  } catch {
    if (popup && !popup.closed) popup.location.href = fallbackUrl;
    else window.open(fallbackUrl, "_blank", "noopener,noreferrer");
  }
};
