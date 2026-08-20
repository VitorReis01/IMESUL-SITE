"use client";

// Ponte para o aviso "não conseguimos direcionar automaticamente agora" (ver
// components/CommercialContactAlert.jsx, montado uma vez no layout raiz). Usado quando o
// rodízio de Campo Grande roda mas não encontra vendedor - nesse caso o WhatsApp NUNCA cai no
// número padrão (556733125600), porque esse número vai virar o IMEbot e nunca deve receber
// clientes diretamente (ver lib/leadWhatsApp.js e o relatório desta fase, seção "UX proposta").
const eventName = "imesul-commercial-contact-blocked";

export const notifyCommercialContactBlocked = ({ retry } = {}) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(eventName, { detail: { retry } }));
};

export const subscribeToCommercialContactBlocked = (callback) => {
  if (typeof window === "undefined") return () => {};
  const handler = (event) => callback(event.detail || {});
  window.addEventListener(eventName, handler);
  return () => window.removeEventListener(eventName, handler);
};
