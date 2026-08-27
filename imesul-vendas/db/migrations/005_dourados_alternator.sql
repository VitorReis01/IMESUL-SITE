-- Migration 005: alternador 1-por-1 Dourados Centro/Fabrica.
-- Reexecutavel com seguranca: toda DDL usa IF NOT EXISTS.
--
-- Isto NAO e o rodizio de vendedores de Campo Grande (ver sales_sellers/sales_leads na migration
-- 002) - Dourados nao tem Lead ID, nao tem IMEbot, nao tem conceito de disponibilidade. E so um
-- alternador simples entre as duas lojas (Centro/Fabrica): a unica coisa que precisa sobreviver
-- entre requests (cada instancia serverless da Vercel roda isolada) e qual foi a ULTIMA loja que
-- recebeu um redirecionamento, para saber qual e a PROXIMA.
--
-- Tabela de uma linica linha (id sempre 1, forcado pelo CHECK) - o UPDATE atomico que le e grava
-- o novo valor na mesma instrucao (ver Backend.js/douradosAlternatorStore.js) usa o lock de linha
-- do Postgres para serializar requests concorrentes, sem precisar de SELECT ... FOR UPDATE
-- separado.

CREATE TABLE IF NOT EXISTS dourados_alternator_state (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  last_destination TEXT NOT NULL DEFAULT 'fabrica' CHECK (last_destination IN ('centro', 'fabrica')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dourados_alternator_state_singleton CHECK (id = 1)
);

-- last_destination inicial = 'fabrica' de proposito: o PRIMEIRO cliente real inverte para
-- 'centro' (cliente 1 -> Centro, cliente 2 -> Fabrica, cliente 3 -> Centro...).
INSERT INTO dourados_alternator_state (id, last_destination)
VALUES (1, 'fabrica')
ON CONFLICT (id) DO NOTHING;
