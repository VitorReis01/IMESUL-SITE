"use client";

// Ponte simples entre qualquer CTA comercial (ex.: lib/commercialContact.js) e o
// UnitPickerModal (montado uma única vez em app/layout.jsx) - evita prop drilling até a raiz
// para abrir o modal "De onde você deseja atendimento?". Só existe UM modal na página; múltiplos
// pedidos concorrentes de unidade (cliques rápidos) resolvem todos juntos com a mesma escolha.
import { COMMERCIAL_UNITS } from "./unitPreference";

const openEventName = "imesul-request-unit";
let pendingResolvers = [];

export const subscribeToUnitRequests = (onRequest) => {
  if (typeof window === "undefined") return () => {};

  const handler = () => onRequest();
  window.addEventListener(openEventName, handler);
  return () => window.removeEventListener(openEventName, handler);
};

// Se o usuário fechar o modal sem escolher, cai no fallback oficial (Campo Grande) - nunca fica
// sem unidade definida (ver regra de negócio no relatório desta fase).
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
