// Classificacao oficial dos fluxos comerciais que geram um Lead ID, e outros enums
// compartilhados entre frontend (components/lib) e backend (Backend.js/app/api). Fonte unica de
// verdade: nunca duplicar estas strings soltas em outro arquivo. Arquivo sem "use client" nem
// "server-only" de proposito - e so constantes puras, seguro para os dois lados.

// DIRECT_CONTACT: CTA generico de "fale com um vendedor" (navbar, botao flutuante, cards de
//   ajuda) - sem material/orcamento pre-selecionado. Pede PDF quando vende.
// GUIDED_QUOTE: fluxo atual do site (cliente escolhe material/medida/quantidade e o site monta
//   a mensagem). Nunca pede PDF.
// CART: carrinho global (varios produtos, finalizado de uma vez). Nunca pede PDF.
// WHATSAPP_IMEBOT: cliente que inicia a conversa direto no numero oficial do IMEbot
//   (556733125600) - so existe para unit = campo-grande (ver relatorio desta fase). Pede PDF
//   quando vende, mesmo tratamento de DIRECT_CONTACT.
export const LEAD_FLOW_TYPES = {
  DIRECT_CONTACT: "DIRECT_CONTACT",
  GUIDED_QUOTE: "GUIDED_QUOTE",
  CART: "CART",
  WHATSAPP_IMEBOT: "WHATSAPP_IMEBOT",
};

export const LEAD_FLOW_TYPE_VALUES = Object.values(LEAD_FLOW_TYPES);

export const isValidLeadFlowType = (value) => LEAD_FLOW_TYPE_VALUES.includes(value);

// Site de origem do lead - "institucional" so existe quando o backend recebe a chamada
// cross-origin do site institucional (ver Backend.js/requestGuards.js allowlist de Origin).
export const LEAD_SITE_ORIGIN = {
  VENDAS: "vendas",
  INSTITUCIONAL: "institucional",
  // Cliente que inicia a conversa direto no numero oficial do IMEbot - nao vem de nenhum site.
  WHATSAPP: "whatsapp",
};

export const LEAD_SITE_ORIGIN_VALUES = Object.values(LEAD_SITE_ORIGIN);

// Status comercial do lead (ja existente desde a Fase 1 - migration 002). Centralizado aqui para
// nao duplicar as strings literais em componentes/rotas novas.
export const LEAD_STATUS = {
  NEGOCIANDO: "NEGOCIANDO",
  VENDEU: "VENDEU",
  NAO_VENDEU: "NAO_VENDEU",
};

export const LEAD_STATUS_VALUES = Object.values(LEAD_STATUS);

// Unidades comerciais atendidas. Chave usada tanto na query ?unidade= quanto em
// sales_sellers.unit/sales_leads.unit no banco - manter os MESMOS valores em todo lugar.
export const COMMERCIAL_UNITS = {
  DOURADOS: "dourados",
  CAMPO_GRANDE: "campo-grande",
};

export const COMMERCIAL_UNIT_VALUES = Object.values(COMMERCIAL_UNITS);

export const isValidCommercialUnit = (value) => COMMERCIAL_UNIT_VALUES.includes(value);

// CORREÇÃO DE ESCOPO (instrução explícita do usuário): o rodízio de vendedores e o IMEbot só
// são ativados para a unidade Campo Grande nesta fase. Dourados preserva o fluxo comercial
// atual (sem rodízio, sem IMEbot, sem mensagens automáticas ao vendedor) até uma fase futura
// aprovada. Fonte única de verdade - ver Backend.js/salesLeadsStore.js (assignNextSeller) e o
// futuro módulo do IMEbot, que devem checar esta função em vez de comparar unit diretamente.
export const isCommercialAutomationEnabledForUnit = (unit) => unit === COMMERCIAL_UNITS.CAMPO_GRANDE;

// Fonte única de configuração comercial por unidade (instrução explícita do usuário - "não
// espalhar número hardcoded em vários componentes"). Campo Grande não tem "phone" aqui de
// propósito: o rodízio sempre decide o número (vendedor sorteado), nunca um fallback fixo.
// Dourados tem um numero humano oficial - confirmado pelo usuário em 2026-08-20 - usado como
// fallback quando o rodízio não se aplica (nunca 556733125600, que é o número do futuro IMEbot).
//
// Endereço "248" confirmado como o oficial pelo usuário em 2026-08-20 - o antigo "258" (usado
// em imesul/data/products.js officialUnits, rotulado "Dourados — Matriz") estava desatualizado
// e já foi corrigido em todas as fontes do projeto (institucional, vendas, rodapé, dados
// estruturados - ver relatório desta fase). Rótulo oficial: "Dourados — Centro".
const doradosCentroAddress = "Rua Pedro Rigotti, 248 - Jd. São Pedro, Dourados/MS";

export const COMMERCIAL_UNIT_CONFIG = {
  [COMMERCIAL_UNITS.CAMPO_GRANDE]: {
    name: "IMESUL Campo Grande",
  },
  [COMMERCIAL_UNITS.DOURADOS]: {
    name: "IMESUL Dourados — Centro",
    phone: "556734275700",
    address: doradosCentroAddress,
  },
};

// rotationEnabled/imebotEnabled sempre DERIVADOS de isCommercialAutomationEnabledForUnit -
// nunca um segundo valor hardcoded que possa divergir dessa função (fonte única de verdade real).
export const getCommercialUnitConfig = (unit) => {
  const base = COMMERCIAL_UNIT_CONFIG[unit];
  if (!base) return null;

  const automationEnabled = isCommercialAutomationEnabledForUnit(unit);
  return { ...base, rotationEnabled: automationEnabled, imebotEnabled: automationEnabled };
};

// Estados do carrinho comercial (cart_sessions). "ABANDONED" nunca e gravado por um job/cron -
// e calculado na leitura (ACTIVE + last_activity_at mais antigo que o limite configurado conta
// como abandonado nos relatorios), evitando depender de um scheduler novo. Ver
// Backend.js/cartStore.js e o relatorio desta fase para a decisao completa.
export const CART_STATUS = {
  ACTIVE: "ACTIVE",
  ABANDONED: "ABANDONED",
  RECOVERED: "RECOVERED",
  CONVERTED: "CONVERTED",
};

export const CART_STATUS_VALUES = Object.values(CART_STATUS);

// Limite usado para DERIVAR "abandonado" na leitura (nunca gravado por um job). Configurável via
// CART_ABANDONMENT_THRESHOLD_MINUTES (servidor) para não depender de um valor fixo no código;
// 120 minutos (2h) é o padrão documentado nesta fase - carrinho comercial B2B com orçamento
// (não e-commerce de checkout instantâneo), então uma janela maior que o padrão de e-commerce
// (30-60min) evita marcar como "abandonado" um cliente que só está comparando preços com calma.
// Ver relatório desta fase para a justificativa completa e para revisão futura com dados reais.
const defaultCartAbandonmentThresholdMinutes = 120;
export const CART_ABANDONMENT_THRESHOLD_MS =
  (Number(process.env.CART_ABANDONMENT_THRESHOLD_MINUTES) > 0
    ? Number(process.env.CART_ABANDONMENT_THRESHOLD_MINUTES)
    : defaultCartAbandonmentThresholdMinutes) *
  60 *
  1000;

// Maquina de estados do acompanhamento do IMEbot (Fase 2 - so ativa quando as credenciais Meta
// existirem). Conversa e sempre com o VENDEDOR, nunca com o cliente.
// WAITING_BUYER_TYPE/WAITING_BUYER_NAME/WAITING_BUYER_CNPJ: entre "vendeu" e "pedir valor" -
// coleta quem é o comprador/faturado (pode ser diferente do contato) antes do valor da venda
// (ver relatório desta fase, "contact != buyer").
export const IMEBOT_STATE = {
  WAITING_CUSTOMER_NAME: "WAITING_CUSTOMER_NAME",
  NEGOTIATING: "NEGOTIATING",
  WAITING_RESULT: "WAITING_RESULT",
  WAITING_BUYER_TYPE: "WAITING_BUYER_TYPE",
  WAITING_BUYER_NAME: "WAITING_BUYER_NAME",
  WAITING_BUYER_CNPJ: "WAITING_BUYER_CNPJ",
  WAITING_SALE_VALUE: "WAITING_SALE_VALUE",
  WAITING_PDF: "WAITING_PDF",
  COMPLETED: "COMPLETED",
  REJECTED: "REJECTED",
};

export const IMEBOT_STATE_VALUES = Object.values(IMEBOT_STATE);

// Status de notificacao do IMEbot para um lead - a falha do IMEbot NUNCA impede o cliente de
// falar com o vendedor (o WhatsApp ja abriu antes disso); isto so registra se o acompanhamento
// interno funcionou.
export const IMEBOT_NOTIFICATION_STATUS = {
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED",
};

export const IMEBOT_NOTIFICATION_STATUS_VALUES = Object.values(IMEBOT_NOTIFICATION_STATUS);

// Status de armazenamento de um arquivo (PDF) do fluxo DIRECT_CONTACT. Ver Backend.js/db e a
// migration 004 (sales_lead_files) e a documentacao do IMEbot PDF Bridge.
export const LEAD_FILE_STORAGE_STATUS = {
  PENDING: "PENDING",
  DOWNLOADING: "DOWNLOADING",
  VALIDATING: "VALIDATING",
  STORED: "STORED",
  REJECTED: "REJECTED",
};

export const LEAD_FILE_STORAGE_STATUS_VALUES = Object.values(LEAD_FILE_STORAGE_STATUS);

export const HANDOFF_LINK_STATUS = {
  ACTIVE: "ACTIVE",
  EXPIRED: "EXPIRED",
  REVOKED: "REVOKED",
};

export const HANDOFF_LINK_STATUS_VALUES = Object.values(HANDOFF_LINK_STATUS);

export const FEEDBACK_TYPE = {
  HANDOFF_SERVICE: "HANDOFF_SERVICE",
  POST_SALE: "POST_SALE",
};

export const FEEDBACK_TYPE_VALUES = Object.values(FEEDBACK_TYPE);

export const FEEDBACK_JOB_TYPE = {
  HANDOFF_CHECK: "HANDOFF_CHECK",
  POST_SALE: "POST_SALE",
};

export const FEEDBACK_JOB_TYPE_VALUES = Object.values(FEEDBACK_JOB_TYPE);

export const FEEDBACK_JOB_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  SENT: "SENT",
  WAITING_CUSTOMER_PHONE: "WAITING_CUSTOMER_PHONE",
  PENDING_TEMPLATE: "PENDING_TEMPLATE",
  FAILED: "FAILED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
};

export const FEEDBACK_JOB_STATUS_VALUES = Object.values(FEEDBACK_JOB_STATUS);

export const IMEBOT_CONVERSATION_ACTOR = {
  SELLER: "SELLER",
  CUSTOMER: "CUSTOMER",
};

export const IMEBOT_CONVERSATION_ACTOR_VALUES = Object.values(IMEBOT_CONVERSATION_ACTOR);

export const IMEBOT_CONVERSATION_TYPE = {
  SELLER_LEAD_TRACKING: "SELLER_LEAD_TRACKING",
  RETURN_FLOW: "RETURN_FLOW",
  PDF_FLOW: "PDF_FLOW",
  HANDOFF_SERVICE: "HANDOFF_SERVICE",
  POST_SALE: "POST_SALE",
};

export const IMEBOT_CONVERSATION_TYPE_VALUES = Object.values(IMEBOT_CONVERSATION_TYPE);

export const CUSTOMER_PHONE_SOURCE = {
  META_INBOUND: "META_INBOUND",
  SELLER_PROVIDED: "SELLER_PROVIDED",
  LEAD_FORM: "LEAD_FORM",
};

export const CUSTOMER_PHONE_SOURCE_VALUES = Object.values(CUSTOMER_PHONE_SOURCE);

const positiveEnvNumber = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const IMEBOT_HANDOFF_CHECK_DELAY_MINUTES = positiveEnvNumber("IMEBOT_HANDOFF_CHECK_DELAY_MINUTES", 30);
export const IMEBOT_HANDOFF_MAX_RETRIES = positiveEnvNumber("IMEBOT_HANDOFF_MAX_RETRIES", 1);
export const IMEBOT_POST_SALE_DELAY_MINUTES = positiveEnvNumber("IMEBOT_POST_SALE_DELAY_MINUTES", 1440);
