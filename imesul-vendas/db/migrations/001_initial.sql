-- Migration 001: tabelas iniciais de analytics e sessao administrativa.
-- Reexecutavel com seguranca: toda DDL usa IF NOT EXISTS.
-- Nao gravar segredo/credencial em nenhuma tabela deste schema.

CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  server_timestamp TIMESTAMPTZ,

  type TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  section TEXT NOT NULL DEFAULT '',
  path TEXT NOT NULL DEFAULT '',
  page_path TEXT NOT NULL DEFAULT '',
  method TEXT NOT NULL DEFAULT 'POST',

  visitor_id TEXT NOT NULL DEFAULT 'visitor-unavailable',
  is_logged_in BOOLEAN NOT NULL DEFAULT FALSE,
  user_name TEXT NOT NULL DEFAULT '',
  user_phone TEXT NOT NULL DEFAULT '',
  user_email TEXT NOT NULL DEFAULT '',
  client_status TEXT NOT NULL DEFAULT 'Visitante sem login',

  -- "source" enviado pelo cliente e "origin" calculado no servidor sao o mesmo conceito no
  -- codigo atual (ver lib/localAnalytics.js createBackendPayload -> sanitizeEvent); uma unica
  -- coluna evita duplicar o mesmo valor em dois lugares.
  origin_label TEXT NOT NULL DEFAULT '',
  traffic_source TEXT NOT NULL DEFAULT '',
  referrer TEXT NOT NULL DEFAULT '',
  referer_domain TEXT NOT NULL DEFAULT '',
  host TEXT NOT NULL DEFAULT '',
  utm JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- IP nunca em texto puro: mascarado para exibicao comum, hash estavel para agrupamento,
  -- e o valor ja criptografado (AES-256-GCM) pelo backend para investigacao de seguranca.
  -- A chave de criptografia (ANALYTICS_SECURITY_KEY) nunca chega perto do banco.
  ip_masked TEXT NOT NULL DEFAULT 'não identificado',
  ip_hash TEXT NOT NULL DEFAULT '',
  ip_protected TEXT NOT NULL DEFAULT '',

  device JSONB NOT NULL DEFAULT '{}'::jsonb,           -- {device, browser, os, userAgent}
  location JSONB NOT NULL DEFAULT '{}'::jsonb,         -- IP aproximado: {city, region, country, continent, latitude, longitude, timezone, postalCode}
  network JSONB NOT NULL DEFAULT '{}'::jsonb,          -- {asn, organization, isp}
  security_headers JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Localizacao do DISPOSITIVO: so existe com consentimento explicito do visitante.
  -- Nunca confundir com "location" (IP) acima; nunca usada para autenticacao/autorizacao.
  device_latitude DOUBLE PRECISION,
  device_longitude DOUBLE PRECISION,
  device_accuracy DOUBLE PRECISION,
  device_location_captured_at TIMESTAMPTZ,
  device_location_status TEXT NOT NULL DEFAULT '',

  suspicious BOOLEAN NOT NULL DEFAULT FALSE,
  suspicious_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices para os filtros/ordenacao ja usados pelo painel (periodo, tipo, visitante, IP,
-- eventos com localizacao autorizada). Poucos indices de proposito - nao criar dezenas.
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events (event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events (type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor_id ON analytics_events (visitor_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_ip_hash ON analytics_events (ip_hash);
CREATE INDEX IF NOT EXISTS idx_analytics_events_device_location_status ON analytics_events (device_location_status);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id BIGSERIAL PRIMARY KEY,
  -- NUNCA salvar o bearer token cru: so o SHA-256 dele. O token continua sendo gerado com
  -- crypto.randomBytes (256 bits) no servidor; o hash so serve para localizar a sessao no banco.
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON admin_sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions (expires_at);
