"use client";

// Ponte simples entre qualquer CTA comercial (ver lib/commercialContact.js) e o
// CommercialRegionModal (montado uma unica vez em app/layout.jsx) - evita prop drilling ate a
// raiz para abrir o modal "Vamos encontrar o atendimento certo para voce". Mesmo padrao ja usado
// no institucional (imesul/lib/unitPickerBridge.js) e no proprio imesul-vendas
// (lib/commercialContactAlert.js). So existe UM modal na pagina; multiplos pedidos concorrentes
// de regiao (cliques rapidos em CTAs diferentes) resolvem todos juntos com a mesma escolha.
import { COMMERCIAL_UNITS } from "./leadFlow";

const openEventName = "imesul-vendas-request-unit";
let pendingResolvers = [];

export const subscribeToUnitRequests = (onRequest) => {
  if (typeof window === "undefined") return () => {};

  const handler = () => onRequest();
  window.addEventListener(openEventName, handler);
  return () => window.removeEventListener(openEventName, handler);
};

// Se o cliente fechar o modal sem escolher, cai no fallback oficial (Campo Grande) - nunca fica
// sem regiao definida (mesmo padrao do institucional).
export const resolveUnitRequests = (unit = COMMERCIAL_UNITS.CAMPO_GRANDE) => {
  const resolvers = pendingResolvers;
  pendingResolvers = [];
  resolvers.forEach((resolve) => resolve(unit));
};

export const requestUnitChoice = () => {
  if (typeof window === "undefined") return Promise.resolve(COMMERCIAL_UNITS.CAMPO_GRANDE);

  return new Promise((resolve) => {
    pendingResolvers.push(resolve);
    window.dispatchEvent(new CustomEvent(openEventName));
  });
};
