-- Correcao de permissoes de commercial_seller_rotation_state - NAO altera a migration 006
-- (ja aplicada em imesul-vendas-test), so corrige o que ficou errado.
--
-- Auditoria (leitura direta de information_schema.role_table_grants no banco de teste,
-- 2026-09-08): apos a migration 006, anon/authenticated/service_role tinham TODOS os
-- privilegios sobre esta tabela - SELECT/INSERT/UPDATE/DELETE/REFERENCES/TRIGGER/TRUNCATE. A
-- migration 006 ja tentava revogar isso (REVOKE ALL condicional na mesma transacao), mas o
-- revoke nao "colou" - o banco real segue com os grants completos, incluindo TRUNCATE. RLS esta
-- ativo mas sem nenhuma policy, o que so filtra SELECT/INSERT/UPDATE/DELETE (nenhuma linha
-- visivel sem policy) - RLS nunca governa TRUNCATE nem DDL, entao a tabela continuava
-- truncavel por anon/authenticated mesmo com RLS ligado.
--
-- Esta migration so revoga privilegios - nenhum DDL de schema, nenhuma alteracao de dado.
REVOKE ALL ON commercial_seller_rotation_state FROM anon;
REVOKE ALL ON commercial_seller_rotation_state FROM authenticated;
REVOKE ALL ON commercial_seller_rotation_state FROM service_role;

-- Sequences: esta tabela nao tem coluna SERIAL/BIGSERIAL (unit e TEXT, chave primaria natural),
-- entao nao ha sequence associada para revogar.

-- Confirma que o schema publico tambem nao concede nada de graca via PUBLIC (ja deveria estar
-- assim pela migration 006, reafirmado aqui por seguranca).
REVOKE ALL ON commercial_seller_rotation_state FROM PUBLIC;

-- Nao concede nada aqui para imesul_vendas_app - isso continua sendo feito so por
-- db/roles/grant_rotation_runtime.sql (ou pela propria migration 006, se a role ja existir no
-- momento em que 006 rodar num ambiente novo), nunca automaticamente por uma migration futura -
-- mesma politica de "sem GRANT automatico" ja documentada em POSTGRES_ROLE_PROPOSAL.md.
