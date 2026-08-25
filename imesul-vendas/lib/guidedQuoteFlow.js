"use client";

// Sinal efemero (nao persistido, mesmo padrao de consentBannerOpen em lib/consent.js) de
// "o orcamento guiado esta na tela agora" - usado pelo CartWidget pra esconder so o WhatsApp
// flutuante (o CTA da propria tela ja cobre isso). Dois publicadores: ProjectSelector.jsx
// (fluxo por projeto, inline na home, via selectedProjectId) e MaterialProductPage.jsx (fluxo
// por material, via hasVariants - so quando o formulario de orcamento realmente aparece, nao
// na grade de "selecione o modelo").
let guidedQuoteActiveState = false;
const eventName = "imesul-guided-quote-active-changed";

export const setGuidedQuoteActive = (active) => {
  if (typeof window === "undefined" || guidedQuoteActiveState === active) return;
  guidedQuoteActiveState = active;
  window.dispatchEvent(new CustomEvent(eventName));
};

export const getGuidedQuoteActive = () => guidedQuoteActiveState;
export const getServerGuidedQuoteActive = () => false;

export const subscribeToGuidedQuoteActive = (callback) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(eventName, callback);
  return () => window.removeEventListener(eventName, callback);
};
