"use client";

// Cliente cross-origin para criar leads comerciais no backend do site de VENDAS (este site
// institucional não tem backend/Postgres próprio - ver relatório desta fase). Chama
// `${salesSiteUrl}/api/leads`, que já aceita essa origem via CORS explícito (ver
// Backend.js/requestGuards.js getAllowedOrigins/getCorsHeaders no projeto imesul-vendas, e
// NEXT_PUBLIC_INSTITUTIONAL_URL). Nunca lança exceção: qualquer falha (rede, CORS bloqueado,
// backend fora do ar) devolve {ok:false} - quem chamou cai no WhatsApp padrão existente (ver
// lib/commercialContact.js), o cliente nunca fica sem conseguir falar com a IMESUL.
import { salesSiteUrl } from "../data/products";

const getLeadsEndpoint = () => {
  try {
    return new URL("/api/leads", salesSiteUrl).toString();
  } catch {
    return null;
  }
};

export async function createLead(payload) {
  const endpoint = getLeadsEndpoint();
  if (!endpoint) return { ok: false };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      mode: "cors",
      credentials: "omit",
      keepalive: true,
    });

    if (!response.ok) return { ok: false };

    const data = await response.json().catch(() => null);
    if (!data?.ok) return { ok: false };

    return { ok: true, leadCode: data.leadCode, seller: data.seller || null };
  } catch {
    return { ok: false };
  }
}
