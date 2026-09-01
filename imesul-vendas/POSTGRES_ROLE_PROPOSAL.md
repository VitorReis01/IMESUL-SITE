<!-- title: Proposta de role de menor privilégio (Postgres) -->

# Proposta de role de menor privilégio — Postgres

**Não executado.** Este documento só propõe; nenhuma mudança de role foi aplicada ao banco.
Rodar isso em produção sem cuidado pode derrubar o site (uma role sem privilégio suficiente faz
toda query falhar), por isso a decisão e a execução ficam com você.

**Atualizado nesta rodada de hardening** para refletir exatamente as tabelas das migrations
`001` a `005` (a versão anterior deste documento listava só 5 tabelas de `001`–`002`; hoje o
schema tem 17 tabelas, 11 delas adicionadas pela `004_commercial_funnel.sql`). O privilégio por
tabela abaixo (SELECT/INSERT/UPDATE/DELETE) foi levantado por análise estática do código
(`grep` de `INSERT INTO`/`UPDATE`/`DELETE FROM`/`ON CONFLICT ... DO UPDATE` em `Backend.js/*.js` e
`lib/*.js`) — é um bom ponto de partida, não uma auditoria de runtime. Antes de aplicar em
produção, confirme com uma consulta real (`pg_stat_statements` ou logs de query) que nenhuma
operação foi perdida nessa varredura estática.

## Situação atual (não verificável a partir deste ambiente)

Este ambiente de trabalho não tem `DATABASE_URL` configurada, então não consigo consultar o
Postgres real para confirmar qual role a aplicação usa hoje nem quais privilégios ela tem. O mais
provável, dado que a `DATABASE_URL` foi criada diretamente no provedor (Neon), é que a aplicação
está usando a role **owner/admin do banco** — a mesma que consegue `CREATE`, `DROP`, `ALTER`,
`TRUNCATE` em qualquer tabela. Isso funciona, mas significa que qualquer bug de SQL injection
(mesmo que hoje não exista nenhum — todas as queries são parametrizadas) ou vazamento da
`DATABASE_URL` daria ao atacante controle total do banco, não só das tabelas da aplicação.

Para confirmar a role atual e seus privilégios, rode isto com a `DATABASE_URL` de produção (via
`psql` ou o SQL Editor do Neon):

```sql
SELECT current_user;
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolcanlogin
  FROM pg_roles WHERE rolname = current_user;
SELECT table_name, privilege_type
  FROM information_schema.role_table_grants
  WHERE grantee = current_user
  ORDER BY table_name, privilege_type;
```

## Proposta: separar role de migration e role de aplicação

```
ROLE DE MIGRATION (dono do schema)          ROLE DA APLICAÇÃO (runtime)
- CREATE/ALTER/DROP nas tabelas             - SELECT/INSERT/UPDATE/DELETE
  do projeto                                  só nas tabelas/colunas usadas em runtime
- usada só em scripts/migrate-db.mjs        - usada em toda requisição normal
- lida por DATABASE_MIGRATION_URL             (Backend.js/db.js, o que o site usa
- nunca fica em Backend.js/db.js              o tempo todo, lido de DATABASE_URL)
```

A role da aplicação **não precisa** de `DROP`, `ALTER`, `CREATE`, `TRUNCATE`, `SUPERUSER`,
`CREATEROLE` ou `CREATEDB` — confirmado por varredura: nenhum `TRUNCATE` existe em todo
`Backend.js/`/`lib/`, e toda DDL (`CREATE TABLE`/`ALTER`) vive exclusivamente em
`db/migrations/*.sql`, nunca em código de runtime.

## Tabelas atuais (migrations 001–005) e privilégio necessário por tabela

Todas as 17 tabelas recebem `SELECT` (todas são lidas em algum ponto). `INSERT`/`UPDATE`/`DELETE`
listados só onde há evidência real no código — colunas em branco significam "não usado pela
aplicação hoje" (não conceder na role de app; se um dia passar a ser necessário, é um `GRANT`
novo, não um risco por excesso de privilégio adiantado).

| Tabela | Migration | SELECT | INSERT | UPDATE | DELETE | Observação |
|---|---|:-:|:-:|:-:|:-:|---|
| `analytics_events` | 001 | ✓ | ✓ | | ✓ | `DELETE` = limpeza pelo admin (`/api/analytics/clear`) |
| `admin_sessions` | 001 | ✓ | ✓ | ✓ | ✓ | `UPDATE` = revogar no logout; `DELETE` = limpeza oportunista de sessões antigas |
| `sales_sellers` | 002 | ✓ | | ✓ | | Sem `INSERT` da app — vendedores são provisionados manualmente/migration, não em runtime |
| `sales_leads` | 002 | ✓ | ✓ | ✓ | | Sem `DELETE` — nenhum fluxo apaga lead |
| `rate_limit_counters` | 003 | ✓ | ✓ | ✓ | ✓ | UPSERT (`ON CONFLICT DO UPDATE`) + limpeza oportunista por `DELETE` |
| `sales_lead_files` | 004 | ✓ | ✓ | ✓ | | PDF Bridge (metadados/hash, nunca o arquivo) |
| `imebot_messages` | 004 | ✓ | ✓ | | | Append-only (auditoria de mensagens) |
| `imebot_conversations` | 004 | ✓ | ✓ | ✓ | | Máquina de estados do IMEbot |
| `imebot_webhook_events` | 004 | ✓ | ✓ | | | Append-only, `ON CONFLICT DO NOTHING` (dedup por `wamid`) |
| `cart_sessions` | 004 | ✓ | ✓ | ✓ | | Métricas de abandono de carrinho |
| `sales_returns` | 004 | ✓ | ✓ | ✓ | | `UPDATE` via `ON CONFLICT (idempotency_key) DO UPDATE` |
| `sales_return_confirmations` | 004 | ✓ | ✓ | ✓ | | Confirmação com expiração (`CONFIRMAR DEVOLUCAO`) |
| `sales_handoff_links` | 004 | ✓ | ✓ | ✓ | | Links rastreáveis `/r/[token]` |
| `sales_feedback_jobs` | 004 | ✓ | ✓ | ✓ | | Fila de jobs assíncronos (`FOR UPDATE SKIP LOCKED`) |
| `sales_customer_feedback` | 004 | ✓ | ✓ | ✓ | | `ON CONFLICT DO NOTHING` no insert, `UPDATE` em outro fluxo |
| `sales_lead_events` | 004 | ✓ | ✓ | | | Append-only (auditoria de eventos do lead) |
| `dourados_alternator_state` | 005 | ✓ | | ✓ | | Linha única (`id=1`), semeada pela própria migration — app só faz `UPDATE` |

## Sequences (colunas `BIGSERIAL`)

Toda tabela `BIGSERIAL` precisa de `USAGE, SELECT` na sequence correspondente para conseguir
`INSERT` (o `nextval()` implícito exige isso). `rate_limit_counters` (chave `TEXT`) e
`dourados_alternator_state` (chave `SMALLINT` fixa, sem sequence) não entram nesta lista.

```
analytics_events_id_seq, admin_sessions_id_seq, sales_leads_id_seq, sales_lead_files_id_seq,
imebot_messages_id_seq, imebot_conversations_id_seq, imebot_webhook_events_id_seq,
cart_sessions_id_seq, sales_returns_id_seq, sales_return_confirmations_id_seq,
sales_handoff_links_id_seq, sales_feedback_jobs_id_seq, sales_customer_feedback_id_seq,
sales_lead_events_id_seq
```

`sales_sellers_id_seq` fica de fora por padrão (a role de app nunca insere um vendedor novo) —
conceda só se um fluxo de auto-cadastro de vendedor for implementado no futuro.

## SQL necessário (não executado)

```sql
-- 1) Cria a role de aplicação, com senha separada da role atual.
CREATE ROLE imesul_vendas_app WITH LOGIN PASSWORD '<definir uma senha forte>';

-- 2) USAGE no schema - sem isso, os GRANTs de tabela abaixo não são utilizáveis na prática (a
-- role conseguiria ATÉ ter o privilégio listado em information_schema, mas nenhuma query
-- funcionaria). Nunca assuma que isso já vem de graça via o pseudo-role PUBLIC - alguns
-- provedores (Neon incluso, dependendo de como o projeto foi criado) revogam isso por padrão
-- como parte do próprio hardening deles.
GRANT USAGE ON SCHEMA public TO imesul_vendas_app;

-- 3) SELECT em todas as 17 tabelas (toda tabela é lida em algum ponto).
GRANT SELECT ON
  analytics_events, admin_sessions, sales_sellers, sales_leads, rate_limit_counters,
  sales_lead_files, imebot_messages, imebot_conversations, imebot_webhook_events,
  cart_sessions, sales_returns, sales_return_confirmations, sales_handoff_links,
  sales_feedback_jobs, sales_customer_feedback, sales_lead_events, dourados_alternator_state
TO imesul_vendas_app;

-- 4) INSERT só onde a aplicação cria linhas novas (ver tabela acima - sales_sellers e
-- dourados_alternator_state ficam de fora de propósito).
GRANT INSERT ON
  analytics_events, admin_sessions, sales_leads, rate_limit_counters, sales_lead_files,
  imebot_messages, imebot_conversations, imebot_webhook_events, cart_sessions, sales_returns,
  sales_return_confirmations, sales_handoff_links, sales_feedback_jobs, sales_customer_feedback,
  sales_lead_events
TO imesul_vendas_app;

-- 5) UPDATE só onde a aplicação atualiza linha existente.
GRANT UPDATE ON
  admin_sessions, sales_sellers, sales_leads, rate_limit_counters, sales_lead_files,
  imebot_conversations, cart_sessions, sales_returns, sales_return_confirmations,
  sales_handoff_links, sales_feedback_jobs, sales_customer_feedback, dourados_alternator_state
TO imesul_vendas_app;

-- 6) DELETE só onde a aplicação de fato apaga linha (limpeza de analytics, sessões e rate
-- limit expirados - nenhum outro fluxo apaga dado de negócio).
GRANT DELETE ON
  analytics_events, admin_sessions, rate_limit_counters
TO imesul_vendas_app;

-- 7) Sequences das tabelas BIGSERIAL que a role recebe INSERT (ver lista acima).
GRANT USAGE, SELECT ON
  analytics_events_id_seq, admin_sessions_id_seq, sales_leads_id_seq, sales_lead_files_id_seq,
  imebot_messages_id_seq, imebot_conversations_id_seq, imebot_webhook_events_id_seq,
  cart_sessions_id_seq, sales_returns_id_seq, sales_return_confirmations_id_seq,
  sales_handoff_links_id_seq, sales_feedback_jobs_id_seq, sales_customer_feedback_id_seq,
  sales_lead_events_id_seq
TO imesul_vendas_app;

-- 8) Garante que tabelas FUTURAS criadas pela role de migration também concedam SELECT
-- automaticamente à role de aplicação, sem precisar repetir o GRANT a cada migration. INSERT/
-- UPDATE/DELETE de uma tabela nova continuam exigindo um GRANT explícito (são específicos por
-- tabela, não um privilégio "genérico" que faça sentido dar de graça a toda tabela nova).
ALTER DEFAULT PRIVILEGES FOR ROLE <role_atual_de_migration>
  IN SCHEMA public
  GRANT SELECT ON TABLES TO imesul_vendas_app;

-- 9) Explicitamente SEM: CREATE, ALTER, DROP, TRUNCATE, SUPERUSER, CREATEROLE, CREATEDB.
-- (Não precisa de nenhum SQL para "remover" isso - a role só tem o que foi concedido acima.)
```

## Variáveis de ambiente

Depois de criar a role, `DATABASE_URL` (lida por `Backend.js/db.js`, o que roda em toda
requisição) passaria a apontar para `imesul_vendas_app`. A role atual, mais privilegiada, fica
reservada para `DATABASE_MIGRATION_URL` — usada **apenas** por `scripts/migrate-db.mjs`, nunca por
`Backend.js/db.js`.

```
# Runtime da aplicação - role de menor privilégio (ver tabela acima).
DATABASE_URL=postgresql://imesul_vendas_app:<senha>@<host>/<db>?sslmode=require

# Só para rodar migrations manualmente (scripts/migrate-db.mjs) - role owner/admin atual.
# NUNCA usada por Backend.js/db.js.
DATABASE_MIGRATION_URL=postgresql://<role_atual_de_migration>:<senha>@<host>/<db>?sslmode=require
```

`scripts/migrate-db.mjs` precisaria de um pequeno ajuste (não feito aqui - é código, não só
proposta) para ler `DATABASE_MIGRATION_URL` em vez de `DATABASE_URL` quando ela existir, mantendo
`DATABASE_URL` como fallback para não quebrar quem ainda não migrou o setup local.

## Por que não fiz isso agora

1. Não tenho acesso à `DATABASE_URL` de produção neste ambiente para executar o SQL acima.
2. Trocar a role em produção sem testar primeiro pode quebrar TODAS as queries do site
   (analytics, leads, sessão admin, IMEbot) se algum privilégio necessário for esquecido no
   `GRANT` — e a tabela acima, embora mais precisa que a versão anterior deste documento, ainda é
   baseada em análise estática, não em execução real contra o banco.
3. Você pediu explicitamente para não aplicar mudança de role sem aprovação e informação prévia —
   isso é exatamente o que este documento é.

## Como aplicar, quando você decidir

1. Rode as queries de "Situação atual" acima para confirmar a role/privilégios de hoje.
2. Rode o SQL da seção "SQL necessário" com a role atual (que tem permissão para criar roles).
3. Ajuste `scripts/migrate-db.mjs` para usar `DATABASE_MIGRATION_URL` (com fallback para
   `DATABASE_URL`, para não quebrar ambientes que ainda não migraram).
4. Teste a nova `DATABASE_URL` (com `imesul_vendas_app`) num ambiente de preview antes de trocar
   em produção — rode a suíte de testes, faça login admin, crie um lead de teste, confirme que o
   IMEbot (se habilitado) e o rate limiter continuam funcionando.
5. Só depois disso, troque a `DATABASE_URL` de produção na Vercel.
