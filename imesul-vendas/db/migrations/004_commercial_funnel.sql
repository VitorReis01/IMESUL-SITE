-- Migration 004: funil comercial completo (classificacao de fluxo, unidade por vendedor,
-- carrinho, arquivos de PDF, mapeamento de mensagens do IMEbot, comprador/CNPJ, devolucoes,
-- auditoria).
-- Reexecutavel com seguranca: toda DDL usa IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- NAO altera nenhuma coluna existente de forma destrutiva - so adiciona.
--
-- DECISAO DE VERSIONAMENTO (ver relatorio desta fase): esta migration ainda NAO foi executada
-- em nenhum banco (sem DATABASE_URL neste ambiente em nenhum momento do projeto) - por isso as
-- estruturas de comprador/CNPJ/devolucoes/auditoria desta rodada foram incorporadas AQUI em vez
-- de uma migration 005 nova. Nunca alterar este arquivo depois que ele tiver sido executado uma
-- vez em producao - a partir desse momento, qualquer mudanca futura vira uma migration nova.

-- ==========================================================================================
-- sales_sellers.unit
-- ==========================================================================================

-- Nula por padrao na coluna (schema generico) - a confirmacao de QUEM e de qual unidade e uma
-- atualizacao de DADOS, feita a parte desta migration de schema (ver UPDATE documentado no
-- relatorio desta fase: Felipe e Bruniely = campo-grande, confirmado pelo usuario). Enquanto
-- for NULL para outros vendedores, o rodizio por unidade deve tratar como "sem unidade definida"
-- e NUNCA assumir uma unidade default silenciosamente.
ALTER TABLE sales_sellers ADD COLUMN IF NOT EXISTS unit TEXT;

ALTER TABLE sales_sellers DROP CONSTRAINT IF EXISTS sales_sellers_unit_check;
ALTER TABLE sales_sellers ADD CONSTRAINT sales_sellers_unit_check
  CHECK (unit IS NULL OR unit IN ('dourados', 'campo-grande'));

CREATE INDEX IF NOT EXISTS idx_sales_sellers_unit ON sales_sellers (unit);

-- ==========================================================================================
-- sales_leads: classificacao de fluxo, origem, unidade, venda, acompanhamento do IMEbot
-- ==========================================================================================

-- DEFAULT 'GUIDED_QUOTE' preenche corretamente os leads ja existentes (Fase 1 so tinha esse
-- fluxo) - novas linhas sempre informam flow_type explicitamente (ver salesLeadsStore.js).
-- WHATSAPP_IMEBOT adicionado nesta rodada: cliente que inicia a conversa direto no numero
-- oficial do IMEbot (556733125600) - so existe para unit = campo-grande (ver relatorio desta
-- fase, secao "cliente iniciando conversa no IMEbot").
ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS flow_type TEXT NOT NULL DEFAULT 'GUIDED_QUOTE';
ALTER TABLE sales_leads DROP CONSTRAINT IF EXISTS sales_leads_flow_type_check;
ALTER TABLE sales_leads ADD CONSTRAINT sales_leads_flow_type_check
  CHECK (flow_type IN ('DIRECT_CONTACT', 'GUIDED_QUOTE', 'CART', 'WHATSAPP_IMEBOT'));

-- DEFAULT 'vendas' preenche os leads existentes (so o site de vendas criava leads ate agora).
-- 'whatsapp' adicionado nesta rodada: cliente que inicia a conversa direto no numero oficial do
-- IMEbot - nao vem de nenhum site, entao nem 'vendas' nem 'institucional' descreveriam certo.
ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS site_origin TEXT NOT NULL DEFAULT 'vendas';
ALTER TABLE sales_leads DROP CONSTRAINT IF EXISTS sales_leads_site_origin_check;
ALTER TABLE sales_leads ADD CONSTRAINT sales_leads_site_origin_check
  CHECK (site_origin IN ('vendas', 'institucional', 'whatsapp'));

-- Unidade do LEAD (pode divergir de sales_sellers.unit se o vendedor ainda nao tiver unidade
-- confirmada) - nula ate sabermos, nunca inventada.
ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS unit TEXT;
ALTER TABLE sales_leads DROP CONSTRAINT IF EXISTS sales_leads_unit_check;
ALTER TABLE sales_leads ADD CONSTRAINT sales_leads_unit_check
  CHECK (unit IS NULL OR unit IN ('dourados', 'campo-grande'));

-- Pagina/CTA de entrada (ex.: "navbar-whatsapp", "help-card", "cart-checkout") - usado nos
-- relatorios "por origem/pagina/CTA".
ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS page_path TEXT NOT NULL DEFAULT '';

-- Preenchidos so quando o vendedor informa ao IMEbot que vendeu. sale_amount e' a VENDA
-- ORIGINAL (bruta) - IMUTAVEL depois de gravada. Uma devolucao NUNCA subtrai deste campo
-- diretamente (ver tabela sales_returns abaixo); o valor liquido e' sempre CALCULADO
-- (sale_amount - SUM(sales_returns.amount)), nunca um segundo campo sincronizado manualmente -
-- mesmo principio ja usado para CART_STATUS.ABANDONED (derivado na leitura, nunca gravado).
ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS sale_amount NUMERIC(12, 2);
ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ;

-- Comprador (pode ser diferente de quem entrou em contato - ver relatorio desta fase,
-- "contact != buyer"). customer_name (ja existente, Fase 1) continua sendo o CONTATO (quem
-- fala com o vendedor) - nunca renomeado/removido para nao quebrar dado ja existente. Os campos
-- abaixo sao o COMPRADOR/faturamento, sempre distintos.
ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS buyer_type TEXT;
ALTER TABLE sales_leads DROP CONSTRAINT IF EXISTS sales_leads_buyer_type_check;
ALTER TABLE sales_leads ADD CONSTRAINT sales_leads_buyer_type_check
  CHECK (buyer_type IS NULL OR buyer_type IN ('PERSON', 'COMPANY'));

ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS buyer_name TEXT NOT NULL DEFAULT '';

-- Sempre normalizado (14 digitos, sem pontuacao) - NUNCA consultado na Receita Federal, nunca
-- usado para preencher razao social automaticamente (ver relatorio: "nao inventar razao
-- social"). NULL para buyer_type = PERSON (nao pedimos CPF nesta fase).
ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS buyer_cnpj TEXT;
ALTER TABLE sales_leads DROP CONSTRAINT IF EXISTS sales_leads_buyer_cnpj_digits_check;
ALTER TABLE sales_leads ADD CONSTRAINT sales_leads_buyer_cnpj_digits_check
  CHECK (buyer_cnpj IS NULL OR buyer_cnpj ~ '^\d{14}$');

CREATE INDEX IF NOT EXISTS idx_sales_leads_buyer_cnpj ON sales_leads (buyer_cnpj);

ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS customer_phone_source TEXT;
ALTER TABLE sales_leads DROP CONSTRAINT IF EXISTS sales_leads_customer_phone_source_check;
ALTER TABLE sales_leads ADD CONSTRAINT sales_leads_customer_phone_source_check
  CHECK (customer_phone_source IS NULL OR customer_phone_source IN ('META_INBOUND', 'SELLER_PROVIDED', 'LEAD_FORM'));

-- Acompanhamento do IMEbot (Fase 2). NULL enquanto a integracao Meta nao estiver ativa para
-- este lead - nunca um valor default inventado. Estados novos nesta rodada:
-- WAITING_BUYER_TYPE/WAITING_BUYER_NAME/WAITING_BUYER_CNPJ - entre "vendeu" e "pedir valor" (ver
-- lib/imebotStateMachine.js e o relatorio desta fase).
ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS imebot_state TEXT;
ALTER TABLE sales_leads DROP CONSTRAINT IF EXISTS sales_leads_imebot_state_check;
ALTER TABLE sales_leads ADD CONSTRAINT sales_leads_imebot_state_check
  CHECK (imebot_state IS NULL OR imebot_state IN (
    'WAITING_CUSTOMER_NAME', 'NEGOTIATING', 'WAITING_RESULT',
    'WAITING_BUYER_TYPE', 'WAITING_BUYER_NAME', 'WAITING_BUYER_CNPJ',
    'WAITING_SALE_VALUE', 'WAITING_PDF', 'COMPLETED', 'REJECTED'
  ));

-- A falha do IMEbot (Meta fora do ar, etc.) NUNCA impede o cliente de falar com o vendedor -
-- este campo so registra se a notificacao interna funcionou, nunca bloqueia o lead em si.
ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS imebot_notification_status TEXT;
ALTER TABLE sales_leads DROP CONSTRAINT IF EXISTS sales_leads_imebot_notification_status_check;
ALTER TABLE sales_leads ADD CONSTRAINT sales_leads_imebot_notification_status_check
  CHECK (imebot_notification_status IS NULL OR imebot_notification_status IN ('PENDING', 'SENT', 'FAILED'));

ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS imebot_notified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sales_leads_flow_type ON sales_leads (flow_type);
CREATE INDEX IF NOT EXISTS idx_sales_leads_site_origin ON sales_leads (site_origin);
CREATE INDEX IF NOT EXISTS idx_sales_leads_unit ON sales_leads (unit);

-- ==========================================================================================
-- sales_lead_files: metadados do PDF de orcamento (fluxo DIRECT_CONTACT). O ARQUIVO EM SI
-- nunca fica no Postgres (nunca BYTEA) - so metadados, hash e o caminho RELATIVO gravado pelo
-- IMEbot PDF Bridge depois de validar/escanear (ver documentacao do bridge nesta fase).
-- ==========================================================================================

CREATE TABLE IF NOT EXISTS sales_lead_files (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'orcamento_pdf',

  -- Identificador da midia na Meta (usado pelo backend para buscar o arquivo quando o Bridge
  -- solicitar - nunca guardamos o PDF em si aqui).
  meta_media_id TEXT,

  -- Nome original informado pelo vendedor via WhatsApp - NUNCA confiavel para o nome fisico
  -- gravado em disco (isso e gerado/sanitizado pelo Bridge). So metadado para exibicao.
  original_name TEXT NOT NULL DEFAULT '',
  mime TEXT NOT NULL DEFAULT '',
  size_bytes BIGINT,
  sha256 TEXT,

  storage_status TEXT NOT NULL DEFAULT 'PENDING',
  -- Caminho RELATIVO dentro de Y:\ORC-SITE-IMESUL\ (ex.: "2026/08/IMESUL-ABC12345/ARQUIVO.pdf").
  -- NUNCA um caminho absoluto/UNC vindo de fora - ver auditoria de seguranca desta fase.
  relative_path TEXT,

  rejected_at TIMESTAMPTZ,
  rejected_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stored_at TIMESTAMPTZ
);

ALTER TABLE sales_lead_files DROP CONSTRAINT IF EXISTS sales_lead_files_storage_status_check;
ALTER TABLE sales_lead_files ADD CONSTRAINT sales_lead_files_storage_status_check
  CHECK (storage_status IN ('PENDING', 'DOWNLOADING', 'VALIDATING', 'STORED', 'REJECTED'));

-- Defesa em profundidade no proprio banco: mesmo que um bug no backend deixe passar, o Postgres
-- nunca aceita um caminho relativo tentando escapar da pasta base.
ALTER TABLE sales_lead_files DROP CONSTRAINT IF EXISTS sales_lead_files_relative_path_safe_check;
ALTER TABLE sales_lead_files ADD CONSTRAINT sales_lead_files_relative_path_safe_check
  CHECK (
    relative_path IS NULL OR (
      relative_path !~ '\.\.' AND
      relative_path !~ '^[/\\]' AND
      relative_path !~ '^[A-Za-z]:' AND
      relative_path !~ '^\\\\'
    )
  );

CREATE INDEX IF NOT EXISTS idx_sales_lead_files_lead_id ON sales_lead_files (lead_id);
CREATE INDEX IF NOT EXISTS idx_sales_lead_files_storage_status ON sales_lead_files (storage_status);

-- ==========================================================================================
-- imebot_messages: mapeia toda mensagem enviada/recebida da Meta para um lead+vendedor, para
-- nunca depender so de "seller_phone + ultimo lead" (um vendedor pode ter varios leads
-- simultaneos - ver auditoria de seguranca desta fase, secao concorrencia de leads).
-- ==========================================================================================

CREATE TABLE IF NOT EXISTS imebot_messages (
  id BIGSERIAL PRIMARY KEY,
  -- wamid da mensagem (outbound quando o IMEbot envia, ou o id referenciado em context.id de
  -- uma resposta inbound) - UNIQUE garante que a mesma mensagem nunca e mapeada duas vezes.
  wamid TEXT NOT NULL UNIQUE,
  lead_id BIGINT NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  seller_id BIGINT REFERENCES sales_sellers(id) ON DELETE SET NULL,
  -- Ex.: 'ask_name', 'ask_result', 'ask_sale_value', 'ask_pdf', 'notify_new_lead'.
  purpose TEXT NOT NULL DEFAULT '',
  -- Estado do IMEbot no momento do envio - ajuda a interpretar uma resposta sem contexto.
  state TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imebot_messages_lead_id ON imebot_messages (lead_id);
CREATE INDEX IF NOT EXISTS idx_imebot_messages_seller_id ON imebot_messages (seller_id);

-- ==========================================================================================
-- imebot_conversations: estados isolados por ator/tipo de conversa. Evita que um fluxo do
-- vendedor (PDF/devolucao) sobrescreva uma pesquisa do cliente (handoff/post-sale) no mesmo
-- lead. O campo sales_leads.imebot_state permanece por compatibilidade com a fase atual.
-- ==========================================================================================

CREATE TABLE IF NOT EXISTS imebot_conversations (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL,
  actor_phone TEXT NOT NULL DEFAULT '',
  conversation_type TEXT NOT NULL,
  state TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE imebot_conversations DROP CONSTRAINT IF EXISTS imebot_conversations_actor_type_check;
ALTER TABLE imebot_conversations ADD CONSTRAINT imebot_conversations_actor_type_check
  CHECK (actor_type IN ('SELLER', 'CUSTOMER'));

ALTER TABLE imebot_conversations DROP CONSTRAINT IF EXISTS imebot_conversations_type_check;
ALTER TABLE imebot_conversations ADD CONSTRAINT imebot_conversations_type_check
  CHECK (conversation_type IN ('SELLER_LEAD_TRACKING', 'RETURN_FLOW', 'PDF_FLOW', 'HANDOFF_SERVICE', 'POST_SALE'));

CREATE INDEX IF NOT EXISTS idx_imebot_conversations_lead_id ON imebot_conversations (lead_id);
CREATE INDEX IF NOT EXISTS idx_imebot_conversations_actor ON imebot_conversations (actor_type, actor_phone);
CREATE UNIQUE INDEX IF NOT EXISTS idx_imebot_conversations_active_unique
  ON imebot_conversations (lead_id, actor_type, actor_phone, conversation_type)
  WHERE state NOT IN ('COMPLETED', 'CANCELLED', 'EXPIRED');

-- ==========================================================================================
-- imebot_webhook_events: deduplicacao/idempotencia de eventos recebidos da Meta - evita
-- reprocessar o mesmo evento em caso de retry/reentrega do webhook (comportamento normal em
-- webhooks da Meta).
-- ==========================================================================================

CREATE TABLE IF NOT EXISTS imebot_webhook_events (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================================================
-- cart_sessions: carrinho comercial rastreado no servidor - SO criado/atualizado quando o
-- visitante consentiu com analytics (ver Backend.js/cartStore.js). O carrinho FUNCIONAL
-- (localStorage) nao depende desta tabela e continua funcionando mesmo sem consentimento.
-- ==========================================================================================

CREATE TABLE IF NOT EXISTS cart_sessions (
  id BIGSERIAL PRIMARY KEY,
  -- Mesmo padrao do lead_code: gerado no backend, nao sequencial/adivinhavel.
  cart_code TEXT NOT NULL UNIQUE,
  visitor_id TEXT NOT NULL DEFAULT 'visitor-unavailable',
  unit TEXT,
  origin TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  -- Itens do carrinho no momento do ultimo sync - JSONB evita uma tabela separada para um dado
  -- que so precisa ser lido/gravado inteiro a cada atualizacao (nunca consultado item a item).
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- ABANDONED nunca e gravado por um job - e derivado na leitura (ACTIVE ha mais tempo que o
  -- limite configurado). Ver CART_STATUS em lib/leadFlow.js e o relatorio desta fase.
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  converted_lead_id BIGINT REFERENCES sales_leads(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cart_sessions DROP CONSTRAINT IF EXISTS cart_sessions_status_check;
ALTER TABLE cart_sessions ADD CONSTRAINT cart_sessions_status_check
  CHECK (status IN ('ACTIVE', 'ABANDONED', 'RECOVERED', 'CONVERTED'));

CREATE INDEX IF NOT EXISTS idx_cart_sessions_visitor_id ON cart_sessions (visitor_id);
CREATE INDEX IF NOT EXISTS idx_cart_sessions_status ON cart_sessions (status);
CREATE INDEX IF NOT EXISTS idx_cart_sessions_last_activity_at ON cart_sessions (last_activity_at);

-- ==========================================================================================
-- sales_returns: cada devolucao e' um EVENTO proprio (uma venda pode ter varias) - nunca
-- sobrescreve sales_leads.sale_amount (ver relatorio desta fase, "valor original e' imutavel").
-- O valor liquido e' sempre CALCULADO (sale_amount - SUM(amount) desta tabela), nunca
-- armazenado de forma sincronizada separadamente - evita os dois valores divergirem por bug.
-- ==========================================================================================

CREATE TABLE IF NOT EXISTS sales_returns (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  seller_id BIGINT REFERENCES sales_sellers(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL DEFAULT '',
  -- 'imebot' | 'admin' - de onde a devolucao foi registrada.
  source TEXT NOT NULL DEFAULT '',
  -- wamid da mensagem de confirmacao, quando registrada via IMEbot - usado para idempotencia
  -- (mesmo padrao de imebot_webhook_events: nunca processar a mesma confirmacao duas vezes).
  meta_message_id TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- So preenchido depois do fluxo [CONFIRMAR]/[CANCELAR] do IMEbot (ver relatorio desta fase) -
  -- NULL enquanto uma devolucao esta sendo registrada via admin (confirmacao imediata) ou
  -- aguardando confirmacao do vendedor via IMEbot.
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sales_returns_lead_id ON sales_returns (lead_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_seller_id ON sales_returns (seller_id);

CREATE TABLE IF NOT EXISTS sales_return_confirmations (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  seller_id BIGINT NOT NULL REFERENCES sales_sellers(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL DEFAULT '',
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  expires_at TIMESTAMPTZ NOT NULL,
  confirmed_return_id BIGINT REFERENCES sales_returns(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

ALTER TABLE sales_return_confirmations DROP CONSTRAINT IF EXISTS sales_return_confirmations_status_check;
ALTER TABLE sales_return_confirmations ADD CONSTRAINT sales_return_confirmations_status_check
  CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED'));

CREATE INDEX IF NOT EXISTS idx_sales_return_confirmations_lead_seller ON sales_return_confirmations (lead_id, seller_id);
CREATE INDEX IF NOT EXISTS idx_sales_return_confirmations_status ON sales_return_confirmations (status);

-- ==========================================================================================
-- Handoff rastreavel: token opaco, hash armazenado, destino resolvido pelo seller_id do lead.
-- ==========================================================================================

CREATE TABLE IF NOT EXISTS sales_handoff_links (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  seller_id BIGINT NOT NULL REFERENCES sales_sellers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  first_clicked_at TIMESTAMPTZ,
  last_clicked_at TIMESTAMPTZ,
  click_count INTEGER NOT NULL DEFAULT 0,
  followup_attempts INTEGER NOT NULL DEFAULT 0,
  followup_completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
);

ALTER TABLE sales_handoff_links DROP CONSTRAINT IF EXISTS sales_handoff_links_status_check;
ALTER TABLE sales_handoff_links ADD CONSTRAINT sales_handoff_links_status_check
  CHECK (status IN ('ACTIVE', 'EXPIRED', 'REVOKED'));

CREATE INDEX IF NOT EXISTS idx_sales_handoff_links_lead_id ON sales_handoff_links (lead_id);
CREATE INDEX IF NOT EXISTS idx_sales_handoff_links_seller_id ON sales_handoff_links (seller_id);
CREATE INDEX IF NOT EXISTS idx_sales_handoff_links_followup ON sales_handoff_links (status, first_clicked_at, expires_at);

-- ==========================================================================================
-- Jobs persistidos para follow-up/pesquisas. Vercel Cron pode chamar um processor idempotente.
-- ==========================================================================================

CREATE TABLE IF NOT EXISTS sales_feedback_jobs (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  seller_id BIGINT REFERENCES sales_sellers(id) ON DELETE SET NULL,
  handoff_link_id BIGINT REFERENCES sales_handoff_links(id) ON DELETE SET NULL,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  run_after TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 1,
  last_error TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sales_feedback_jobs DROP CONSTRAINT IF EXISTS sales_feedback_jobs_type_check;
ALTER TABLE sales_feedback_jobs ADD CONSTRAINT sales_feedback_jobs_type_check
  CHECK (job_type IN ('HANDOFF_CHECK', 'POST_SALE'));

ALTER TABLE sales_feedback_jobs DROP CONSTRAINT IF EXISTS sales_feedback_jobs_status_check;
ALTER TABLE sales_feedback_jobs ADD CONSTRAINT sales_feedback_jobs_status_check
  CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'WAITING_CUSTOMER_PHONE', 'PENDING_TEMPLATE', 'FAILED', 'COMPLETED', 'CANCELLED'));

CREATE INDEX IF NOT EXISTS idx_sales_feedback_jobs_due ON sales_feedback_jobs (status, run_after);
CREATE INDEX IF NOT EXISTS idx_sales_feedback_jobs_lead_id ON sales_feedback_jobs (lead_id);

CREATE TABLE IF NOT EXISTS sales_customer_feedback (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  seller_id BIGINT REFERENCES sales_sellers(id) ON DELETE SET NULL,
  feedback_type TEXT NOT NULL,
  rating INTEGER,
  has_observation BOOLEAN,
  observation TEXT NOT NULL DEFAULT '',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sales_customer_feedback DROP CONSTRAINT IF EXISTS sales_customer_feedback_type_check;
ALTER TABLE sales_customer_feedback ADD CONSTRAINT sales_customer_feedback_type_check
  CHECK (feedback_type IN ('HANDOFF_SERVICE', 'POST_SALE'));

ALTER TABLE sales_customer_feedback DROP CONSTRAINT IF EXISTS sales_customer_feedback_rating_check;
ALTER TABLE sales_customer_feedback ADD CONSTRAINT sales_customer_feedback_rating_check
  CHECK (rating IS NULL OR (rating BETWEEN 1 AND 10));

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_customer_feedback_one_active
  ON sales_customer_feedback (lead_id, feedback_type)
  WHERE completed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sales_customer_feedback_lead_id ON sales_customer_feedback (lead_id);

-- ==========================================================================================
-- sales_lead_events: trilha de auditoria append-only por lead. Nunca UPDATE/DELETE - so INSERT.
-- metadata e' sempre sanitizado antes de gravar (nunca PDF/senha/token; CNPJ/telefone/valor sao
-- aceitos aqui pois sao dados do proprio negocio, protegidos pelo mesmo controle de acesso do
-- resto do painel admin - ver relatorio desta fase, secao privacidade/seguranca).
-- ==========================================================================================

CREATE TABLE IF NOT EXISTS sales_lead_events (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'LEAD_CREATED', 'SELLER_ASSIGNED', 'CONTACT_NAME_SET', 'BUYER_TYPE_SET', 'BUYER_SET',
    'CNPJ_SET', 'STATUS_CHANGED', 'SALE_RECORDED', 'RETURN_REQUESTED', 'RETURN_CONFIRMED',
    'RETURN_RECORDED', 'PDF_REQUESTED', 'PDF_RECEIVED', 'PDF_STORED',
    'PDF_RETRIEVAL_REQUESTED', 'PDF_DELIVERED', 'PDF_DELIVERY_FAILED',
    'SELLER_UNAUTHORIZED_ATTEMPT',
    'HANDOFF_OFFERED', 'HANDOFF_LINK_CLICKED', 'HANDOFF_FOLLOWUP_SENT',
    'CUSTOMER_CONFIRMED_ATTENDED', 'CUSTOMER_CONFIRMED_NOT_ATTENDED',
    'HANDOFF_REOFFERED', 'HANDOFF_FOLLOWUP_UNRESPONSIVE', 'SELLER_REASSIGNED',
    'SERVICE_FEEDBACK_STARTED', 'SERVICE_RATING_RECORDED',
    'SERVICE_OBSERVATION_RECORDED', 'SERVICE_FEEDBACK_COMPLETED',
    'POST_SALE_QUEUED', 'POST_SALE_SENT', 'POST_SALE_PENDING_PHONE',
    'POST_SALE_PENDING_TEMPLATE', 'POST_SALE_RATING_RECORDED',
    'POST_SALE_OBSERVATION_RECORDED', 'POST_SALE_COMPLETED'
  )),
  -- 'system' | 'seller' | 'admin' | 'webhook'.
  actor_type TEXT NOT NULL DEFAULT 'system',
  actor_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_lead_events_lead_id ON sales_lead_events (lead_id);
CREATE INDEX IF NOT EXISTS idx_sales_lead_events_event_type ON sales_lead_events (event_type);
