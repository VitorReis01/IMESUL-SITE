-- Migration 003: rate limiting distribuido via Postgres.
-- Reexecutavel com seguranca: toda DDL usa IF NOT EXISTS.
--
-- Por que Postgres e nao Map() em memoria: cada instancia serverless da Vercel roda em processo
-- isolado. Um limitador so em memoria (o que este projeto usava ate aqui - ver comentarios
-- historicos em adminSecurity.js/analyticsStore.js) permite que um atacante distribuido entre
-- instancias diferentes multiplique a vazao permitida. Uma tabela compartilhada, com UPSERT
-- atomico (ON CONFLICT), resolve isso sem precisar de um servico novo (Redis/Upstash/Vercel KV):
-- reaproveita o mesmo Postgres que ja esta em producao.

CREATE TABLE IF NOT EXISTS rate_limit_counters (
  limiter_key TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cobre a limpeza oportunistica (contadores com janela expirada ha muito tempo).
CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_window_start ON rate_limit_counters (window_start);
