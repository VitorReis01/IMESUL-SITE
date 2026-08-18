// Cliente leve para criar leads comerciais (Fase 1: Lead ID + rodizio de vendedores).
// Nunca lanca excecao: qualquer falha de rede/servidor devolve {ok:false}, e quem chamou
// (WhatsAppButton em components/QuoteBuilder.jsx) cai no WhatsApp padrao ja existente - este
// recurso nunca pode quebrar o orcamento do cliente.
const leadsEndpoint = "/api/leads";

export async function createLead(payload) {
  try {
    const response = await fetch(leadsEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
