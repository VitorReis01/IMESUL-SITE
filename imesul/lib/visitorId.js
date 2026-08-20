"use client";

// Identificador anônimo local, só para o backend de vendas conseguir agrupar/deduplicar leads
// vindos do institucional (mesmo padrão de imesul-vendas/lib/localAnalytics.js). Nunca é PII:
// gerado localmente, não é nome/telefone/e-mail. Storage NECESSÁRIO (independe de consentimento
// de analytics) - é só um identificador técnico, igual ao usado para o carrinho no site de vendas.
const visitorStorageKey = "imesul_institucional_visitor_id";

const canUseBrowserStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const createVisitorId = () => `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const getVisitorId = () => {
  if (!canUseBrowserStorage()) return "visitor-unavailable";

  const current = window.localStorage.getItem(visitorStorageKey);
  if (current) return current;

  const next = createVisitorId();
  window.localStorage.setItem(visitorStorageKey, next);
  return next;
};
