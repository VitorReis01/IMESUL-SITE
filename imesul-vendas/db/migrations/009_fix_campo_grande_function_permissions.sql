-- Correcao de permissoes de campo_grande_create_lead - NAO altera a migration 008 (ja aplicada
-- em imesul-vendas-test), so corrige o que ficou errado. Mesmo padrao ja usado na migration 007
-- para commercial_seller_rotation_state.
--
-- Auditoria (leitura direta de information_schema.role_routine_grants no banco de teste,
-- 2026-09-08): apesar do "REVOKE ALL ... FROM PUBLIC" na migration 008, anon/authenticated/
-- service_role receberam EXECUTE automaticamente nessa funcao (mesmo comportamento de default
-- privileges da Supabase ja documentado na migration 007 para tabelas - aqui se aplica tambem a
-- funcoes novas). Esta migration so revoga privilegios - nenhum DDL de schema, nenhuma alteracao
-- de dado, nenhuma alteracao no corpo da funcao.
REVOKE EXECUTE ON FUNCTION campo_grande_create_lead(text, text, text, text, text, text, text, text, jsonb, text, text, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION campo_grande_create_lead(text, text, text, text, text, text, text, text, jsonb, text, text, text, text, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION campo_grande_create_lead(text, text, text, text, text, text, text, text, jsonb, text, text, text, text, text, text) FROM service_role;
REVOKE EXECUTE ON FUNCTION campo_grande_create_lead(text, text, text, text, text, text, text, text, jsonb, text, text, text, text, text, text) FROM PUBLIC;
