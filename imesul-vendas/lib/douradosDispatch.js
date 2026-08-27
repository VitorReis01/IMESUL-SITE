"use client";

// Alternador simples Dourados Centro/Fabrica (arquitetura territorial - ver
// lib/commercialRegions.js). NUNCA cria lead, NUNCA aciona IMEbot/rodizio (ver
// lib/leadFlow.js#isCommercialAutomationEnabledForUnit, que ja mantinha isso desligado para
// Dourados). A unica persistencia e o UPDATE atomico em
// Backend.js/douradosAlternatorStore.js (via POST /api/dourados/next-store) - so guarda qual loja
// recebeu o ultimo redirecionamento, nunca status de atendimento, disponibilidade ou fila.
//
// So chamado por lib/leadWhatsApp.js quando unit === COMMERCIAL_UNITS.DOURADOS - nunca importar
// direto de um componente (mesmo padrao de lib/leads.js, que so e chamado de dentro de
// lib/leadWhatsApp.js).
import { createWhatsAppUrl } from "./whatsapp";
import { trackEvent } from "./trackEvent";
import { COMMERCIAL_UNITS, getCommercialUnitConfig } from "./leadFlow";

const nextStoreEndpoint = "/api/dourados/next-store";

// Os dois numeros de WhatsApp de Dourados foram confirmados pelo usuario em 2026-08-27. Centro
// continua vindo da fonte unica em lib/leadFlow.js (mesmo numero ja usado la); Fabrica agora e um
// numero de WhatsApp confirmado (556734115700) - antes ficava "" porque o footer institucional so
// tinha o telefone da loja como tel:, nunca validado como WhatsApp.
const DOURADOS_STORE_PHONES = {
  centro: getCommercialUnitConfig(COMMERCIAL_UNITS.DOURADOS)?.phone || "",
  fabrica: "556734115700",
};

const DOURADOS_COMMERCIAL_UNIT_LABELS = { centro: "dourados-centro", fabrica: "dourados-fabrica" };

const resolveStorePhone = (store) => DOURADOS_STORE_PHONES[store] || DOURADOS_STORE_PHONES.centro;

export const openDouradosWhatsApp = async ({ message, pagePath = "" }) => {
  // Abre a aba em branco de forma SINCRONA (mesma tecnica de lib/leadWhatsApp.js) - evita
  // bloqueio de pop-up, porque o navegador so permite window.open() sem await dentro do clique.
  const popup = typeof window !== "undefined" ? window.open("", "_blank") : null;
  const fallbackUrl = createWhatsAppUrl(message, DOURADOS_STORE_PHONES.centro);

  trackEvent("begin_checkout", { section: pagePath, commercial_region: COMMERCIAL_UNITS.DOURADOS });

  try {
    const response = await fetch(nextStoreEndpoint, { method: "POST" });
    const data = response.ok ? await response.json().catch(() => null) : null;
    const store = data?.ok && data.store === "fabrica" ? "fabrica" : "centro";
    const finalUrl = createWhatsAppUrl(message, resolveStorePhone(store));

    trackEvent("whatsapp_click", {
      section: pagePath,
      commercial_region: COMMERCIAL_UNITS.DOURADOS,
      commercial_unit: DOURADOS_COMMERCIAL_UNIT_LABELS[store],
    });

    if (popup && !popup.closed) popup.location.href = finalUrl;
    else window.open(finalUrl, "_blank", "noopener,noreferrer");
  } catch {
    if (popup && !popup.closed) popup.location.href = fallbackUrl;
    else window.open(fallbackUrl, "_blank", "noopener,noreferrer");
  }
};
