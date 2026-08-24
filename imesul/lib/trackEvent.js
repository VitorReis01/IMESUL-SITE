"use client";

// Camada central de eventos comerciais (GA4 + Meta Pixel). Nunca chamar window.gtag/window.fbq
// fora deste arquivo - qualquer instrumentacao nova passa por trackEvent(). O mapa fixo evita
// nomes de evento soltos espalhados pelos componentes. PageView/page_view continuam disparados
// direto por TrackingScripts.jsx (nao duplicados aqui).
import { hasAnalyticsConsent } from "./consent";

const trackingEnabled = process.env.NEXT_PUBLIC_TRACKING_ENABLED === "true";

// metaCustom: true quando o evento Meta nao e um standard event (usa fbq('trackCustom', ...)).
const EVENT_MAP = {
  cta_click: { ga4: "cta_click", meta: "Contact" },
  whatsapp_click: { ga4: "whatsapp_click", meta: "Contact" },
  select_unit: { ga4: "select_unit", meta: "SelectUnit", metaCustom: true },
  search: { ga4: "search", meta: "Search" },
  view_item: { ga4: "view_item", meta: "ViewContent" },
  add_to_cart: { ga4: "add_to_cart", meta: "AddToCart" },
  view_cart: { ga4: "view_cart", meta: "ViewCart", metaCustom: true },
  begin_checkout: { ga4: "begin_checkout", meta: "InitiateCheckout" },
  generate_lead: { ga4: "generate_lead", meta: "Lead" },
};

// Defesa em profundidade contra PII (nome/telefone/e-mail/mensagem) - nenhum chamador deveria
// passar esses campos, mas o helper nunca encaminha esses nomes de parametro mesmo assim.
const deniedParamKeys = new Set(["name", "nome", "phone", "telefone", "email", "message", "mensagem", "cpf", "cnpj"]);

const sanitizeParams = (params) => {
  const clean = {};
  for (const key of Object.keys(params)) {
    if (deniedParamKeys.has(key.toLowerCase())) continue;
    if (params[key] === undefined || params[key] === "") continue;
    clean[key] = params[key];
  }
  return clean;
};

// Falha silenciosamente quando a plataforma nao esta carregada, sem consentimento, ou com a flag
// desligada - nunca lanca erro nem afeta o fluxo comercial que chamou o evento.
export const trackEvent = (eventName, params = {}) => {
  if (typeof window === "undefined") return;
  if (!trackingEnabled || !hasAnalyticsConsent()) return;

  const mapping = EVENT_MAP[eventName];
  if (!mapping) return;

  const cleanParams = sanitizeParams(params);

  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", mapping.ga4, cleanParams);
    }
  } catch {
    // Best-effort: tracking nunca pode interromper a experiencia comercial.
  }

  try {
    if (typeof window.fbq === "function") {
      if (mapping.metaCustom) {
        window.fbq("trackCustom", mapping.meta, cleanParams);
      } else {
        window.fbq("track", mapping.meta, cleanParams);
      }
    }
  } catch {
    // Idem.
  }
};
