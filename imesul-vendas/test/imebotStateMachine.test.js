import { describe, expect, it } from "vitest";
import {
  computeNextImebotState,
  IMEBOT_EVENTS,
  parseSaleAmount,
  resolveLeadFromContext,
  shouldRequestPdf,
} from "../lib/imebotStateMachine";
import { IMEBOT_STATE, LEAD_FLOW_TYPES } from "../lib/leadFlow";

describe("computeNextImebotState", () => {
  it("nome recebido: WAITING_CUSTOMER_NAME -> WAITING_RESULT", () => {
    const result = computeNextImebotState({
      currentState: IMEBOT_STATE.WAITING_CUSTOMER_NAME,
      event: IMEBOT_EVENTS.NAME_RECEIVED,
      flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT,
    });
    expect(result).toEqual({ ok: true, nextState: IMEBOT_STATE.WAITING_RESULT });
  });

  it("NEGOCIANDO mantém o acompanhamento em NEGOTIATING", () => {
    const result = computeNextImebotState({
      currentState: IMEBOT_STATE.WAITING_RESULT,
      event: IMEBOT_EVENTS.RESULT_NEGOCIANDO,
      flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT,
    });
    expect(result).toEqual({ ok: true, nextState: IMEBOT_STATE.NEGOTIATING });
  });

  it("NÃO VENDEU conclui o acompanhamento como REJECTED", () => {
    const result = computeNextImebotState({
      currentState: IMEBOT_STATE.WAITING_RESULT,
      event: IMEBOT_EVENTS.RESULT_NAO_VENDEU,
      flowType: LEAD_FLOW_TYPES.GUIDED_QUOTE,
    });
    expect(result).toEqual({ ok: true, nextState: IMEBOT_STATE.REJECTED });
  });

  it("VENDEU pergunta primeiro quem é o comprador (WAITING_BUYER_TYPE), mesmo vindo de NEGOTIATING", () => {
    const result = computeNextImebotState({
      currentState: IMEBOT_STATE.NEGOTIATING,
      event: IMEBOT_EVENTS.RESULT_VENDEU,
      flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT,
    });
    expect(result).toEqual({ ok: true, nextState: IMEBOT_STATE.WAITING_BUYER_TYPE });
  });

  it("pessoa física pula direto para o valor (sem CNPJ)", () => {
    const typeResult = computeNextImebotState({
      currentState: IMEBOT_STATE.WAITING_BUYER_TYPE,
      event: IMEBOT_EVENTS.BUYER_TYPE_PERSON,
      flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT,
    });
    expect(typeResult).toEqual({ ok: true, nextState: IMEBOT_STATE.WAITING_BUYER_NAME });

    const nameResult = computeNextImebotState({
      currentState: IMEBOT_STATE.WAITING_BUYER_NAME,
      event: IMEBOT_EVENTS.BUYER_NAME_RECEIVED,
      flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT,
      buyerType: "PERSON",
    });
    expect(nameResult).toEqual({ ok: true, nextState: IMEBOT_STATE.WAITING_SALE_VALUE });
  });

  it("empresa passa por CNPJ antes do valor", () => {
    const typeResult = computeNextImebotState({
      currentState: IMEBOT_STATE.WAITING_BUYER_TYPE,
      event: IMEBOT_EVENTS.BUYER_TYPE_COMPANY,
      flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT,
    });
    expect(typeResult).toEqual({ ok: true, nextState: IMEBOT_STATE.WAITING_BUYER_NAME });

    const nameResult = computeNextImebotState({
      currentState: IMEBOT_STATE.WAITING_BUYER_NAME,
      event: IMEBOT_EVENTS.BUYER_NAME_RECEIVED,
      flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT,
      buyerType: "COMPANY",
    });
    expect(nameResult).toEqual({ ok: true, nextState: IMEBOT_STATE.WAITING_BUYER_CNPJ });

    const cnpjResult = computeNextImebotState({
      currentState: IMEBOT_STATE.WAITING_BUYER_CNPJ,
      event: IMEBOT_EVENTS.BUYER_CNPJ_RECEIVED,
      flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT,
    });
    expect(cnpjResult).toEqual({ ok: true, nextState: IMEBOT_STATE.WAITING_SALE_VALUE });
  });

  it("rejeita tipo de comprador fora de WAITING_BUYER_TYPE", () => {
    const result = computeNextImebotState({
      currentState: IMEBOT_STATE.WAITING_RESULT,
      event: IMEBOT_EVENTS.BUYER_TYPE_PERSON,
      flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT,
    });
    expect(result.ok).toBe(false);
  });

  it("rejeita CNPJ fora de WAITING_BUYER_CNPJ", () => {
    const result = computeNextImebotState({
      currentState: IMEBOT_STATE.WAITING_BUYER_NAME,
      event: IMEBOT_EVENTS.BUYER_CNPJ_RECEIVED,
      flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT,
    });
    expect(result.ok).toBe(false);
  });

  it("DIRECT_CONTACT + valor recebido -> pede PDF (WAITING_PDF)", () => {
    const result = computeNextImebotState({
      currentState: IMEBOT_STATE.WAITING_SALE_VALUE,
      event: IMEBOT_EVENTS.SALE_VALUE_RECEIVED,
      flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT,
    });
    expect(result).toEqual({ ok: true, nextState: IMEBOT_STATE.WAITING_PDF });
  });

  it("GUIDED_QUOTE + valor recebido -> conclui direto, NUNCA pede PDF", () => {
    const result = computeNextImebotState({
      currentState: IMEBOT_STATE.WAITING_SALE_VALUE,
      event: IMEBOT_EVENTS.SALE_VALUE_RECEIVED,
      flowType: LEAD_FLOW_TYPES.GUIDED_QUOTE,
    });
    expect(result).toEqual({ ok: true, nextState: IMEBOT_STATE.COMPLETED });
  });

  it("CART + valor recebido -> conclui direto, NUNCA pede PDF", () => {
    const result = computeNextImebotState({
      currentState: IMEBOT_STATE.WAITING_SALE_VALUE,
      event: IMEBOT_EVENTS.SALE_VALUE_RECEIVED,
      flowType: LEAD_FLOW_TYPES.CART,
    });
    expect(result).toEqual({ ok: true, nextState: IMEBOT_STATE.COMPLETED });
  });

  it("WHATSAPP_IMEBOT + valor recebido -> pede PDF (mesmo tratamento de DIRECT_CONTACT)", () => {
    const result = computeNextImebotState({
      currentState: IMEBOT_STATE.WAITING_SALE_VALUE,
      event: IMEBOT_EVENTS.SALE_VALUE_RECEIVED,
      flowType: LEAD_FLOW_TYPES.WHATSAPP_IMEBOT,
    });
    expect(result).toEqual({ ok: true, nextState: IMEBOT_STATE.WAITING_PDF });
  });

  it("PDF recebido em WAITING_PDF -> COMPLETED", () => {
    const result = computeNextImebotState({
      currentState: IMEBOT_STATE.WAITING_PDF,
      event: IMEBOT_EVENTS.PDF_RECEIVED,
      flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT,
    });
    expect(result).toEqual({ ok: true, nextState: IMEBOT_STATE.COMPLETED });
  });

  it("rejeita PDF fora de WAITING_PDF", () => {
    const result = computeNextImebotState({
      currentState: IMEBOT_STATE.NEGOTIATING,
      event: IMEBOT_EVENTS.PDF_RECEIVED,
      flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT,
    });
    expect(result.ok).toBe(false);
  });

  it("rejeita PDF para GUIDED_QUOTE mesmo se (por bug futuro) chegasse em WAITING_PDF", () => {
    const result = computeNextImebotState({
      currentState: IMEBOT_STATE.WAITING_PDF,
      event: IMEBOT_EVENTS.PDF_RECEIVED,
      flowType: LEAD_FLOW_TYPES.GUIDED_QUOTE,
    });
    expect(result.ok).toBe(false);
  });

  it("rejeita valor de venda fora de WAITING_SALE_VALUE", () => {
    const result = computeNextImebotState({
      currentState: IMEBOT_STATE.WAITING_RESULT,
      event: IMEBOT_EVENTS.SALE_VALUE_RECEIVED,
      flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT,
    });
    expect(result.ok).toBe(false);
  });

  it("nunca transiciona a partir de COMPLETED", () => {
    const result = computeNextImebotState({
      currentState: IMEBOT_STATE.COMPLETED,
      event: IMEBOT_EVENTS.NAME_RECEIVED,
      flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT,
    });
    expect(result.ok).toBe(false);
  });

  it("nunca transiciona a partir de REJECTED", () => {
    const result = computeNextImebotState({
      currentState: IMEBOT_STATE.REJECTED,
      event: IMEBOT_EVENTS.RESULT_VENDEU,
      flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT,
    });
    expect(result.ok).toBe(false);
  });

  it("evento desconhecido nunca lança, só devolve ok:false", () => {
    expect(() =>
      computeNextImebotState({ currentState: IMEBOT_STATE.WAITING_RESULT, event: "ALGO_INVENTADO", flowType: LEAD_FLOW_TYPES.CART })
    ).not.toThrow();
  });
});

describe("shouldRequestPdf", () => {
  it("DIRECT_CONTACT e WHATSAPP_IMEBOT pedem PDF; GUIDED_QUOTE e CART nunca pedem", () => {
    expect(shouldRequestPdf(LEAD_FLOW_TYPES.DIRECT_CONTACT)).toBe(true);
    expect(shouldRequestPdf(LEAD_FLOW_TYPES.WHATSAPP_IMEBOT)).toBe(true);
    expect(shouldRequestPdf(LEAD_FLOW_TYPES.GUIDED_QUOTE)).toBe(false);
    expect(shouldRequestPdf(LEAD_FLOW_TYPES.CART)).toBe(false);
  });
});

describe("parseSaleAmount", () => {
  it("aceita formato BR com vírgula decimal", () => {
    expect(parseSaleAmount("1.234,56")).toEqual({ ok: true, amount: 1234.56 });
  });

  it("aceita formato simples com ponto decimal", () => {
    expect(parseSaleAmount("1234.5")).toEqual({ ok: true, amount: 1234.5 });
  });

  it("aceita prefixo R$", () => {
    expect(parseSaleAmount("R$ 500")).toEqual({ ok: true, amount: 500 });
  });

  it("rejeita valor vazio", () => {
    expect(parseSaleAmount("").ok).toBe(false);
    expect(parseSaleAmount("   ").ok).toBe(false);
  });

  it("rejeita texto não numérico", () => {
    expect(parseSaleAmount("vendido").ok).toBe(false);
  });

  it("rejeita valor zero ou negativo", () => {
    expect(parseSaleAmount("0").ok).toBe(false);
    expect(parseSaleAmount("-100").ok).toBe(false);
  });

  it("rejeita valor absurdamente alto (teto de segurança)", () => {
    expect(parseSaleAmount("999999999999").ok).toBe(false);
  });

  it("nunca lança para entrada maliciosa/inesperada", () => {
    expect(() => parseSaleAmount("<script>alert(1)</script>")).not.toThrow();
    expect(() => parseSaleAmount(null)).not.toThrow();
    expect(() => parseSaleAmount(undefined)).not.toThrow();
  });
});

describe("resolveLeadFromContext - concorrência de leads (nunca 'último lead')", () => {
  const leadA = { id: 1, leadCode: "IMESUL-AAAA0001" };
  const leadB = { id: 2, leadCode: "IMESUL-BBBB0002" };

  it("com contexto presente, resolve exatamente o lead referenciado mesmo havendo outros pendentes", () => {
    const result = resolveLeadFromContext({ contextLeadId: 2, pendingLeads: [leadA, leadB] });
    expect(result).toEqual({ ok: true, lead: leadB });
  });

  it("sem contexto e só um lead pendente, resolve esse único lead", () => {
    const result = resolveLeadFromContext({ contextLeadId: null, pendingLeads: [leadA] });
    expect(result).toEqual({ ok: true, lead: leadA });
  });

  it("sem contexto e nenhum lead pendente, devolve NO_PENDING_LEAD", () => {
    const result = resolveLeadFromContext({ contextLeadId: null, pendingLeads: [] });
    expect(result).toEqual({ ok: false, reason: "NO_PENDING_LEAD" });
  });

  it("sem contexto e múltiplos leads pendentes, NUNCA adivinha - devolve AMBIGUOUS", () => {
    const result = resolveLeadFromContext({ contextLeadId: null, pendingLeads: [leadA, leadB] });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("AMBIGUOUS");
    expect(result.candidates).toEqual([leadA, leadB]);
  });

  it("contexto aponta para um lead que não está mais pendente - trata como sem contexto", () => {
    const result = resolveLeadFromContext({ contextLeadId: 999, pendingLeads: [leadA] });
    expect(result).toEqual({ ok: true, lead: leadA });
  });

  it("contexto aponta para lead inexistente e há múltiplos pendentes - ainda AMBIGUOUS, nunca adivinha", () => {
    const result = resolveLeadFromContext({ contextLeadId: 999, pendingLeads: [leadA, leadB] });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("AMBIGUOUS");
  });
});
