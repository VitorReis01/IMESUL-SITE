"use client";

// Ponto UNICO para qualquer CTA comercial que ainda nao conhece a regiao do cliente (navbar
// desktop/mobile, WhatsApp flutuante, card "fale com um especialista", finalizar carrinho) -
// nunca chamar lib/leadWhatsApp.js#openWhatsAppWithLead direto nesses pontos, sempre passar por
// aqui (mesmo padrao do institucional, ver imesul/lib/commercialContact.js). Formularios de
// orcamento (components/QuoteBuilder.jsx) NAO usam esta funcao - eles ja coletam cidade e
// resolvem a regiao sozinhos (lib/commercialRegions.js), entao chamam openWhatsAppWithLead
// direto, sem precisar do modal.
//
// unit ja conhecida (preferencia salva via lib/unitPreference.js, populada por ?unidade= como
// HINT de compatibilidade ou por uma cidade ja informada no orcamento - cidade sempre prevalece,
// ver QuoteBuilder.jsx) -> pula o modal. Sem unidade conhecida -> abre o modal
// (lib/unitPickerBridge.js) e espera a escolha do cliente antes de prosseguir.
import { openWhatsAppWithLead } from "./leadWhatsApp";
import { getStoredUnit, setStoredUnit } from "./unitPreference";
import { requestUnitChoice } from "./unitPickerBridge";

export const requestCommercialContact = async (args) => {
  let unit = args.unit || getStoredUnit();

  if (!unit) {
    unit = await requestUnitChoice();
    setStoredUnit(unit);
  }

  return openWhatsAppWithLead({ ...args, unit });
};
