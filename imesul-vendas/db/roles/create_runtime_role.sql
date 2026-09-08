-- ATENCAO: NAO EXECUTAR AUTOMATICAMENTE.
--
-- Este arquivo fica em db/roles/, NAO em db/migrations/, de proposito: scripts/migrate-db.mjs
-- so le db/migrations/*.sql, entao este arquivo NUNCA e aplicado por "npm run db:migrate" nem
-- por acidente numa proxima migration. Rode manualmente (psql ou SQL Editor do provedor - Neon/
-- Supabase) SOMENTE depois de aprovar o conteudo e com a role atual (owner/admin), que tem
-- permissao para criar roles.
--
-- Ver imesul-vendas/POSTGRES_ROLE_PROPOSAL.md para o raciocinio completo por tabela e os passos
-- de aplicacao. Este arquivo e so o SQL, pronto para copiar/colar.
--
-- Privilegios concedidos a imesul_vendas_app: SOMENTE SELECT/INSERT/UPDATE/DELETE nas tabelas
-- e sequences que Backend.js/lib realmente usam hoje (confirmado por auditoria estatica das
-- queries de runtime nesta rodada - grep de INSERT INTO/UPDATE/DELETE FROM/ON CONFLICT em todo
-- Backend.js/*.js e lib/*.js). Nunca CREATE, ALTER, DROP, TRUNCATE, SUPERUSER, CREATEROLE,
-- CREATEDB - nenhum desses aparece em nenhuma linha abaixo.
--
-- Troque '<definir uma senha forte>' por uma senha real antes de rodar - nunca cole a senha em
-- nenhum arquivo versionado depois de gerada; guarde so na variavel de ambiente da Vercel.

-- 1) Cria a role de aplicacao, com senha separada da role de migration/owner.
CREATE ROLE imesul_vendas_app WITH LOGIN PASSWORD '<definir uma senha forte>';

-- 2) USAGE no schema - sem isso, os GRANTs de tabela abaixo nao sao utilizaveis na pratica.
-- Nunca assuma que isso ja vem de graca via o pseudo-role PUBLIC - alguns provedores revogam
-- isso por padrao como parte do proprio hardening deles.
GRANT USAGE ON SCHEMA public TO imesul_vendas_app;

-- 3) SELECT em todas as 17 tabelas (toda tabela e lida em algum ponto, ou aparece em clausula
-- RETURNING de um INSERT/UPDATE - RETURNING exige SELECT nas colunas retornadas).
GRANT SELECT ON
  analytics_events, admin_sessions, sales_sellers, sales_leads, rate_limit_counters,
  sales_lead_files, imebot_messages, imebot_conversations, imebot_webhook_events,
  cart_sessions, sales_returns, sales_return_confirmations, sales_handoff_links,
  sales_feedback_jobs, sales_customer_feedback, sales_lead_events, dourados_alternator_state
TO imesul_vendas_app;

-- 4) INSERT so onde a aplicacao cria linhas novas (sales_sellers e dourados_alternator_state
-- ficam de fora de proposito - nenhuma das duas recebe INSERT do runtime).
GRANT INSERT ON
  analytics_events, admin_sessions, sales_leads, rate_limit_counters, sales_lead_files,
  imebot_messages, imebot_conversations, imebot_webhook_events, cart_sessions, sales_returns,
  sales_return_confirmations, sales_handoff_links, sales_feedback_jobs, sales_customer_feedback,
  sales_lead_events
TO imesul_vendas_app;

-- 5) UPDATE so onde a aplicacao atualiza linha existente.
GRANT UPDATE ON
  admin_sessions, sales_sellers, sales_leads, rate_limit_counters, sales_lead_files,
  imebot_conversations, cart_sessions, sales_returns, sales_return_confirmations,
  sales_handoff_links, sales_feedback_jobs, sales_customer_feedback, dourados_alternator_state
TO imesul_vendas_app;

-- 6) DELETE so onde a aplicacao de fato apaga linha (limpeza de analytics, sessoes e rate
-- limit expirados - nenhum outro fluxo apaga dado de negocio).
GRANT DELETE ON
  analytics_events, admin_sessions, rate_limit_counters
TO imesul_vendas_app;

-- 7) Sequences das tabelas BIGSERIAL que a role recebe INSERT (sales_sellers_id_seq fica de
-- fora de proposito - a role de app nunca insere um vendedor novo).
GRANT USAGE, SELECT ON
  analytics_events_id_seq, admin_sessions_id_seq, sales_leads_id_seq, sales_lead_files_id_seq,
  imebot_messages_id_seq, imebot_conversations_id_seq, imebot_webhook_events_id_seq,
  cart_sessions_id_seq, sales_returns_id_seq, sales_return_confirmations_id_seq,
  sales_handoff_links_id_seq, sales_feedback_jobs_id_seq, sales_customer_feedback_id_seq,
  sales_lead_events_id_seq
TO imesul_vendas_app;

-- 8) DE PROPOSITO SEM "ALTER DEFAULT PRIVILEGES": uma tabela/sequence NOVA criada por uma
-- migration futura NAO deve conceder nenhum privilegio a imesul_vendas_app automaticamente -
-- nem SELECT. "ALTER DEFAULT PRIVILEGES ... GRANT SELECT ON TABLES" pareceria conveniente (evita
-- repetir GRANT a cada migration), mas e exatamente o tipo de automatismo amplo que este desenho
-- de menor privilegio quer evitar: concederia acesso de leitura a uma tabela nova (ex.: uma
-- futura tabela com dado mais sensivel que as atuais) sem ninguem ter revisado se o runtime
-- realmente precisa ler dela. GRANTs para tabelas/sequences novas SEMPRE exigem uma revisao
-- explicita e um novo bloco de SQL (pode ser adicionado a este arquivo, revisado e aprovado
-- manualmente) - nunca automatico. Ver POSTGRES_ROLE_PROPOSAL.md, secao "Estrategia para
-- migrations futuras".
--
-- 9) Explicitamente SEM: CREATE, ALTER, DROP, TRUNCATE, SUPERUSER, CREATEROLE, CREATEDB.
-- (Nao precisa de nenhum SQL para "remover" isso - a role so tem o que foi concedido acima.)

-- --------------------------------------------------------------------------------------------
-- Verificacao pos-criacao (rodar depois do que estiver acima, so leitura):
-- --------------------------------------------------------------------------------------------
-- SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolcanlogin
--   FROM pg_roles WHERE rolname = 'imesul_vendas_app';
-- -- Espera-se: rolsuper=false, rolcreatedb=false, rolcreaterole=false, rolcanlogin=true.
--
-- SELECT table_name, privilege_type
--   FROM information_schema.role_table_grants
--   WHERE grantee = 'imesul_vendas_app'
--   ORDER BY table_name, privilege_type;
-- -- Confirma que nenhuma tabela tem privilegio alem de SELECT/INSERT/UPDATE/DELETE, e so nas
-- -- tabelas listadas acima.
