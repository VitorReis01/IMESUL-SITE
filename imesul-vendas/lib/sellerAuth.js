// Decisões PURAS de autorização do IMEbot (sem I/O) - extraídas para serem testáveis sem banco.
import { COMMERCIAL_UNITS } from "./leadFlow";

// Um remetente só é tratado como VENDEDOR INTERNO (menu funcional + acompanhamento de venda) se
// estiver cadastrado, ATIVO, e da unidade com automação ligada (Campo Grande nesta fase) -
// qualquer outra combinação (inativo, Dourados, não cadastrado) é tratada como CLIENTE.
export const isActiveInternalSeller = (seller) =>
  Boolean(seller && seller.active === true && seller.unit === COMMERCIAL_UNITS.CAMPO_GRANDE);

// Agrupa leads de empresa (buyer_type = COMPANY) por CNPJ normalizado - NUNCA por texto do nome
// (razões sociais podem ser digitadas de formas diferentes, ver relatório desta fase). Leads sem
// CNPJ (pessoa física, ou empresa ainda sem CNPJ coletado) não entram em nenhum grupo.
export const groupLeadsByCompanyCnpj = (leads) => {
  const groups = new Map();

  for (const lead of leads) {
    if (lead.buyerType !== "COMPANY" || !lead.buyerCnpj) continue;

    if (!groups.has(lead.buyerCnpj)) {
      groups.set(lead.buyerCnpj, {
        buyerCnpj: lead.buyerCnpj,
        // Nome mais recente entre os contatos - só para exibição; o agrupamento em si é
        // sempre pelo CNPJ, nunca pelo texto do nome.
        buyerName: lead.buyerName,
        contacts: new Set(),
        sellers: new Set(),
        leads: [],
      });
    }

    const group = groups.get(lead.buyerCnpj);
    if (lead.contactName) group.contacts.add(lead.contactName);
    if (lead.sellerName) group.sellers.add(lead.sellerName);
    group.leads.push(lead);
  }

  return Array.from(groups.values()).map((group) => ({
    buyerCnpj: group.buyerCnpj,
    buyerName: group.buyerName,
    contacts: Array.from(group.contacts),
    sellers: Array.from(group.sellers),
    totalSales: group.leads.length,
    grossSale: group.leads.reduce((sum, lead) => sum + (Number(lead.saleAmount) || 0), 0),
    returnsTotal: group.leads.reduce((sum, lead) => sum + (Number(lead.returnsTotal) || 0), 0),
  }));
};
