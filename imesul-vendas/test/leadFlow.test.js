import { describe, expect, it } from "vitest";
import {
  COMMERCIAL_UNITS,
  FEEDBACK_JOB_STATUS,
  FEEDBACK_JOB_TYPE,
  FEEDBACK_TYPE,
  getCommercialUnitConfig,
  IMEBOT_CONVERSATION_TYPE,
  IMEBOT_HANDOFF_CHECK_DELAY_MINUTES,
  IMEBOT_HANDOFF_MAX_RETRIES,
  IMEBOT_POST_SALE_DELAY_MINUTES,
  isCommercialAutomationEnabledForUnit,
  isValidCommercialUnit,
  isValidLeadFlowType,
  LEAD_FLOW_TYPES,
} from "../lib/leadFlow";

describe("isCommercialAutomationEnabledForUnit", () => {
  it("ativa rodízio/IMEbot somente para campo-grande", () => {
    expect(isCommercialAutomationEnabledForUnit(COMMERCIAL_UNITS.CAMPO_GRANDE)).toBe(true);
  });

  it("nunca ativa para dourados nesta fase", () => {
    expect(isCommercialAutomationEnabledForUnit(COMMERCIAL_UNITS.DOURADOS)).toBe(false);
  });

  it("nunca ativa sem unidade definida", () => {
    expect(isCommercialAutomationEnabledForUnit(null)).toBe(false);
    expect(isCommercialAutomationEnabledForUnit(undefined)).toBe(false);
    expect(isCommercialAutomationEnabledForUnit("")).toBe(false);
  });

  it("nunca ativa para um valor desconhecido/inventado", () => {
    expect(isCommercialAutomationEnabledForUnit("dourados-2")).toBe(false);
    expect(isCommercialAutomationEnabledForUnit("CAMPO-GRANDE")).toBe(false);
  });
});

describe("isValidCommercialUnit", () => {
  it("aceita só os dois valores oficiais", () => {
    expect(isValidCommercialUnit("dourados")).toBe(true);
    expect(isValidCommercialUnit("campo-grande")).toBe(true);
    expect(isValidCommercialUnit("outra-cidade")).toBe(false);
  });
});

describe("getCommercialUnitConfig", () => {
  it("Dourados tem o número humano oficial e automação sempre desligada", () => {
    const config = getCommercialUnitConfig(COMMERCIAL_UNITS.DOURADOS);
    expect(config.phone).toBe("556734275700");
    expect(config.rotationEnabled).toBe(false);
    expect(config.imebotEnabled).toBe(false);
  });

  it("Dourados nunca usa o número do futuro IMEbot (556733125600)", () => {
    const config = getCommercialUnitConfig(COMMERCIAL_UNITS.DOURADOS);
    expect(config.phone).not.toBe("556733125600");
  });

  it("endereço oficial de Dourados é Rua Pedro Rigotti, 248 (258 estava desatualizado)", () => {
    const config = getCommercialUnitConfig(COMMERCIAL_UNITS.DOURADOS);
    expect(config.address).toContain("Rua Pedro Rigotti, 248");
    expect(config.address).not.toContain("258");
  });

  it("nome oficial de Dourados é 'IMESUL Dourados — Centro'", () => {
    const config = getCommercialUnitConfig(COMMERCIAL_UNITS.DOURADOS);
    expect(config.name).toBe("IMESUL Dourados — Centro");
  });

  it("Campo Grande não tem número fixo - o rodízio sempre decide", () => {
    const config = getCommercialUnitConfig(COMMERCIAL_UNITS.CAMPO_GRANDE);
    expect(config.phone).toBeUndefined();
    expect(config.rotationEnabled).toBe(true);
    expect(config.imebotEnabled).toBe(true);
  });

  it("rotationEnabled/imebotEnabled nunca divergem de isCommercialAutomationEnabledForUnit (fonte única)", () => {
    [COMMERCIAL_UNITS.CAMPO_GRANDE, COMMERCIAL_UNITS.DOURADOS].forEach((unit) => {
      const config = getCommercialUnitConfig(unit);
      const expected = isCommercialAutomationEnabledForUnit(unit);
      expect(config.rotationEnabled).toBe(expected);
      expect(config.imebotEnabled).toBe(expected);
    });
  });

  it("devolve null para unidade desconhecida/ausente", () => {
    expect(getCommercialUnitConfig(null)).toBeNull();
    expect(getCommercialUnitConfig("outra-cidade")).toBeNull();
  });
});

describe("isValidLeadFlowType", () => {
  it("aceita só os quatro fluxos oficiais", () => {
    expect(isValidLeadFlowType(LEAD_FLOW_TYPES.DIRECT_CONTACT)).toBe(true);
    expect(isValidLeadFlowType(LEAD_FLOW_TYPES.GUIDED_QUOTE)).toBe(true);
    expect(isValidLeadFlowType(LEAD_FLOW_TYPES.CART)).toBe(true);
    expect(isValidLeadFlowType(LEAD_FLOW_TYPES.WHATSAPP_IMEBOT)).toBe(true);
    expect(isValidLeadFlowType("QUALQUER_OUTRO")).toBe(false);
  });
});

describe("configuração central de handoff, feedback e pós-venda", () => {
  it("mantém os delays e retries em constantes positivas centralizadas", () => {
    expect(IMEBOT_HANDOFF_CHECK_DELAY_MINUTES).toBeGreaterThan(0);
    expect(IMEBOT_HANDOFF_MAX_RETRIES).toBeGreaterThan(0);
    expect(IMEBOT_POST_SALE_DELAY_MINUTES).toBeGreaterThan(0);
  });

  it("separa HANDOFF_SERVICE de POST_SALE", () => {
    expect(FEEDBACK_TYPE.HANDOFF_SERVICE).toBe("HANDOFF_SERVICE");
    expect(FEEDBACK_TYPE.POST_SALE).toBe("POST_SALE");
    expect(FEEDBACK_TYPE.HANDOFF_SERVICE).not.toBe(FEEDBACK_TYPE.POST_SALE);
  });

  it("modela jobs persistidos de checagem de handoff e pós-venda", () => {
    expect(FEEDBACK_JOB_TYPE.HANDOFF_CHECK).toBe("HANDOFF_CHECK");
    expect(FEEDBACK_JOB_TYPE.POST_SALE).toBe("POST_SALE");
    expect(FEEDBACK_JOB_STATUS.WAITING_CUSTOMER_PHONE).toBe("WAITING_CUSTOMER_PHONE");
    expect(FEEDBACK_JOB_STATUS.PENDING_TEMPLATE).toBe("PENDING_TEMPLATE");
    expect(FEEDBACK_JOB_STATUS.COMPLETED).toBe("COMPLETED");
  });

  it("mantém estados simultâneos por tipo de conversa", () => {
    expect(IMEBOT_CONVERSATION_TYPE.RETURN_FLOW).toBe("RETURN_FLOW");
    expect(IMEBOT_CONVERSATION_TYPE.PDF_FLOW).toBe("PDF_FLOW");
    expect(IMEBOT_CONVERSATION_TYPE.HANDOFF_SERVICE).toBe("HANDOFF_SERVICE");
    expect(IMEBOT_CONVERSATION_TYPE.POST_SALE).toBe("POST_SALE");
  });
});
