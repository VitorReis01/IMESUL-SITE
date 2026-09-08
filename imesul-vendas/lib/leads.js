// Cliente leve para criar leads comerciais (Fase 1: Lead ID + rodizio de vendedores).
// Nunca lanca excecao: qualquer falha de rede/servidor devolve {ok:false}, e quem chamou
// (WhatsAppButton em components/QuoteBuilder.jsx) cai no WhatsApp padrao ja existente - este
// recurso nunca pode quebrar o orcamento do cliente.
const leadsEndpoint = "/api/leads";

export async function createLead(payload) {
  let response;
  try {
    response = await fetch(leadsEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Falha de rede ANTES de qualquer resposta (timeout, conexao caiu no meio) - nao ha como
    // saber se o servidor chegou a criar o lead. `ambiguous:true` sinaliza isso para quem chamou
    // (lib/leadWhatsApp.js), que usa a flag para decidir se uma proxima tentativa deve reaproveitar
    // o mesmo clientRequestId (evita duplicar o lead) em vez de gerar um novo.
    return { ok: false, ambiguous: true };
  }

  const data = await response.json().catch(() => null);
  if (!data || typeof data.ok !== "boolean") {
    // Resposta chegou mas o corpo nao deu pra confirmar o resultado (cortado/invalido - ex.: um
    // proxy/gateway encerrando a conexao no meio de um 200 que o servidor ja tinha despachado).
    // Mesma ambiguidade de uma falha de rede: nao sabemos se o lead foi criado.
    return { ok: false, ambiguous: true };
  }

  if (!data.ok) return { ok: false, ambiguous: false };

  return { ok: true, ambiguous: false, leadCode: data.leadCode, seller: data.seller || null };
}
