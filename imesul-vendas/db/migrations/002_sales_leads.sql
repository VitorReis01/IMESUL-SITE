-- Migration 002: automacao comercial - Fase 1 (Lead ID + rodizio de vendedores).
-- Reexecutavel com seguranca: toda DDL usa IF NOT EXISTS.
-- Fase 1 e so a base: nao inclui notificacoes, mudanca de status pelo painel, relatorios ou
-- comissao - isso fica para fases futuras.

CREATE TABLE IF NOT EXISTS sales_sellers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  -- Mesmo formato usado pelo site hoje (so digitos, com DDI+DDD, ex.: 556733125600) - ver
  -- lib/whatsapp.js createWhatsAppUrl, que monta https://wa.me/<numero>.
  whatsapp TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  -- Nulo ate o primeiro lead recebido: NULLS FIRST no rodizio garante que um vendedor novo
  -- (nunca atribuido) entra na fila antes de quem ja recebeu algum lead.
  last_assigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unico indice deste rodizio: cobre exatamente a query do rodizio (vendedores ativos, ordenados
-- pelo menos recentemente atribuido).
CREATE INDEX IF NOT EXISTS idx_sales_sellers_active_last_assigned
  ON sales_sellers (active, last_assigned_at ASC NULLS FIRST);

CREATE TABLE IF NOT EXISTS sales_leads (
  id BIGSERIAL PRIMARY KEY,
  -- Lead ID publico, mostrado no painel e enviado na mensagem do WhatsApp. Gerado no backend
  -- (Backend.js/salesLeadsStore.js) com bytes aleatorios, nunca a partir de id/contador
  -- sequencial - evita adivinhar quantos leads existem ou qual e "o proximo".
  lead_code TEXT NOT NULL UNIQUE,

  visitor_id TEXT NOT NULL DEFAULT 'visitor-unavailable',
  -- NULL enquanto nao houver vendedor ativo cadastrado, ou na rara janela em que todos os
  -- vendedores ativos estao momentaneamente bloqueados por outra transacao concorrente (ver
  -- assignNextSeller). O lead e criado do mesmo jeito - nunca bloqueia o orcamento do cliente.
  seller_id BIGINT REFERENCES sales_sellers(id) ON DELETE SET NULL,

  -- Fase 1 so cria leads como NEGOCIANDO; VENDEU/NAO_VENDEU ficam reservados para quando o
  -- painel ganhar a tela de atualizar status (fase futura, fora do escopo agora).
  status TEXT NOT NULL DEFAULT 'NEGOCIANDO'
    CHECK (status IN ('NEGOCIANDO', 'VENDEU', 'NAO_VENDEU')),

  -- O fluxo de orcamento atual nao pede nome/telefone/e-mail do cliente (so cidade/estado/
  -- quantidade) - estes campos ficam vazios por enquanto, prontos para quando o site passar a
  -- coletar esse dado (login real, formulario, etc.).
  customer_name TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  customer_email TEXT NOT NULL DEFAULT '',

  -- "origin" = unidade/origem ja capturada pelo site (ver ProjectSelector.jsx originUnit, vindo
  -- do parametro ?unidade= do site institucional) ou referrer, quando existir.
  origin TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  utm JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Rotulo curto (ex.: "Material: Viga G" ou "Projeto: Estruturas Metalicas") para escanear o
  -- painel rapido; o texto completo enviado ao WhatsApp fica em quote_summary.
  product TEXT NOT NULL DEFAULT '',
  quote_summary TEXT NOT NULL DEFAULT '',

  -- Protege contra clique duplo/retry de rede: mesmo visitante + mesmo resumo dentro de uma
  -- janela curta gera a mesma chave (ver buildIdempotencyKey) - UNIQUE permite varios NULL sem
  -- conflito, entao nao afeta nenhum outro caminho que nao informe a chave.
  idempotency_key TEXT UNIQUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Poucos indices de proposito, cobrindo o que a Fase 1 realmente consulta.
CREATE INDEX IF NOT EXISTS idx_sales_leads_visitor_id ON sales_leads (visitor_id);
CREATE INDEX IF NOT EXISTS idx_sales_leads_seller_id ON sales_leads (seller_id);
CREATE INDEX IF NOT EXISTS idx_sales_leads_status ON sales_leads (status);
CREATE INDEX IF NOT EXISTS idx_sales_leads_created_at ON sales_leads (created_at DESC);
