// URL oficial /campo-grande. Alias da entrada legada /campogrande (mantida por compatibilidade com
// cartoes, QR Codes e campanhas ja impressos): reaproveita exatamente o mesmo componente - define a
// mesma unidade comercial CONFIRMADA (campo-grande) e devolve o visitante para a home. Nenhuma logica
// de WhatsApp/lead/rodizio aqui. A propriedade GA4 desta rota (Campo Grande) e decidida em
// lib/analyticsUnit.js (getAnalyticsUnitForPath), que ja reconhece /campo-grande.
export { default } from "../campogrande/page";
