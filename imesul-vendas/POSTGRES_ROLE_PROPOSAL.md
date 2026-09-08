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

**Reconferido numa rodada posterior** (auditoria dedicada a este documento, independente da
anterior): a varredura estática foi refeita do zero e bateu, tabela por tabela e privilégio por
privilégio, com o que já estava documentado aqui — nenhuma correção foi necessária na matriz
abaixo. O SQL pronto para copiar/colar agora vive em `db/roles/create_runtime_role.sql` (fora de
`db/migrations/`, então `npm run db:migrate` nunca o executa por engano) — o bloco de SQL abaixo
continua aqui só como referência de leitura.

**Revisado numa terceira rodada** (última revisão antes de aprovação para commit), com 3 mudanças:
(1) `scripts/migrate-db.mjs` agora é **fail-closed** em Production/CI — sem `DATABASE_MIGRATION_URL`
configurada nesses ambientes, o script aborta em vez de cair silenciosamente para `DATABASE_URL`
(o fallback local continua existindo, só fora de Production/CI, sempre com warning explícito); (2)
o `ALTER DEFAULT PRIVILEGES` que concedia `SELECT` automático em tabelas futuras foi **removido**
— ver "Estratégia para migrations futuras" abaixo; (3) adicionado um checklist de validação para
o Preview, ainda não executado. Nenhuma mudança na matriz de privilégios em si.

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

-- 8) DE PROPÓSITO SEM "ALTER DEFAULT PRIVILEGES": uma tabela/sequence NOVA criada por uma
-- migration futura NÃO deve conceder nenhum privilégio a imesul_vendas_app automaticamente - nem
-- SELECT. Ver "Estratégia para migrations futuras" abaixo.

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

`scripts/migrate-db.mjs` **já foi ajustado** para tratar `DATABASE_MIGRATION_URL` como a variável
oficial de migrations, com comportamento **fail-closed**:

- **Em Production/CI** (`NODE_ENV=production` ou `CI` definido — GitHub Actions e a Vercel
  definem `CI` automaticamente): sem `DATABASE_MIGRATION_URL`, o script **aborta imediatamente**
  com uma mensagem genérica e clara, sem nunca cair para `DATABASE_URL`. Rodar migrations com a
  role de runtime (sem `CREATE`/`ALTER`/`DROP`) falharia de um jeito confuso na melhor hipótese —
  ou, pior, rodaria "por acidente" contra uma role errada se a separação de roles ainda não tiver
  sido aplicada ao banco.
- **Fora de Production/CI** (dev local): se `DATABASE_MIGRATION_URL` estiver ausente, cai para
  `DATABASE_URL` — mas sempre emitindo o warning `"Usando DATABASE_URL apenas por compatibilidade
  local. Configure DATABASE_MIGRATION_URL."`, nunca silenciosamente.
- Nunca loga o valor da connection string, só o nome da variável em uso (`DATABASE_MIGRATION_URL`
  ou `DATABASE_URL`).

Lógica pura testável em `scripts/migrate-db.mjs#resolveMigrationDatabaseUrl`, coberta por
`test/migrateDbUrlResolution.test.js`.

`Backend.js/db.js` continua lendo **somente** `DATABASE_URL`, nunca `DATABASE_MIGRATION_URL` -
confirmado nesta rodada e travado contra regressão futura por
`test/databaseMigrationUrlIsolation.test.js` (varre `Backend.js/`, `lib/`, `app/` e `components/`
e falha se qualquer arquivo de runtime referenciar `DATABASE_MIGRATION_URL`).

## Estratégia para migrations futuras

Quando uma migration futura (`db/migrations/00N_*.sql`) criar uma tabela ou sequence nova, a role
`imesul_vendas_app` **não ganha privilégio nenhum sobre ela automaticamente** — nem `SELECT`. Isso
é intencional: `db/roles/create_runtime_role.sql` **não usa** `ALTER DEFAULT PRIVILEGES` (removido
nesta revisão) justamente para não conceder acesso amplo "por conveniência" a uma tabela que
ninguém revisou ainda — uma tabela futura pode guardar um dado mais sensível que as atuais, e
`SELECT` automático contornaria a única razão de existir desta role separada.

**Processo obrigatório para toda migration que adicionar tabela/sequence nova:**

1. A migration em si (`db/migrations/00N_*.sql`) só cria o schema (`CREATE TABLE`/`CREATE INDEX`)
   — nunca inclui `GRANT` (ela roda com `DATABASE_MIGRATION_URL`, que não deveria decidir
   privilégios de runtime silenciosamente).
2. Antes (ou junto) do deploy que passa a usar a tabela nova em código de runtime, repetir a
   mesma auditoria estática desta rodada (`grep` de `INSERT INTO`/`UPDATE`/`DELETE FROM`/`SELECT
   ... FROM` no código que vai usar a tabela nova).
3. Adicionar um novo bloco de `GRANT` explícito — em `db/roles/create_runtime_role.sql` (nova
   seção numerada) ou em um novo arquivo `db/roles/grants_<data>_<tabela>.sql` — cobrindo só as
   operações confirmadas na auditoria, na mesma linha de "menor privilégio necessário" desta
   proposta.
4. Revisar e aprovar manualmente esse bloco (igual a este documento) antes de rodá-lo contra o
   banco real — nunca aplicado automaticamente pela migration nem por CI/deploy.

**Nunca fazer**: reintroduzir `ALTER DEFAULT PRIVILEGES` (ou qualquer mecanismo equivalente) só
para "economizar" o passo 3 acima — o custo de um `GRANT` extra por migration é pequeno comparado
ao risco de conceder acesso não revisado a um dado novo.

## Checklist de validação no Preview (preparado, NÃO executado)

Só deve ser executado contra um ambiente de **Preview/homologação**, nunca Production. Objetivo:
confirmar que a role `imesul_vendas_app` tem exatamente o necessário — nem menos (quebraria
funcionalidade) nem mais (privilégio administrativo indevido).

**A) Conectar usando a `DATABASE_URL` da runtime role** (a nova, apontando para
`imesul_vendas_app`) — via `psql` ou o SQL Editor do provedor, ou simplesmente configurando essa
`DATABASE_URL` no ambiente de Preview da Vercel.

**B) Confirmar a identidade da conexão**:
```sql
SELECT current_user;
-- Esperado: imesul_vendas_app
```

**C) Confirmar que as ações normais do site continuam funcionando** (fluxo positivo, testado
manualmente navegando o Preview):
- [ ] Login admin (`/admin`) e sessão (criação + validação de `admin_sessions`)
- [ ] Criação de lead (`POST /api/leads`, qualquer unidade)
- [ ] Rodízio de Campo Grande (lead com vendedor atribuído)
- [ ] Alternador Dourados (`/api/dourados/next-store` ou clique real no CTA de Dourados)
- [ ] Rate limiter (disparar o limite de burst em `/api/leads` e confirmar 429, não 500)
- [ ] Analytics (`POST /api/analytics/track` + painel admin `GET /api/analytics/events`)
- [ ] IMEbot, se `IMEBOT_ENABLED=true` no Preview (webhook + processamento de jobs)

**D) Testar NEGATIVAMENTE que a runtime role NÃO consegue fazer DDL/administração** — autenticado
como `imesul_vendas_app` (mesma conexão do item A), **sempre numa tabela/transação de teste, nunca
em `sales_leads` ou qualquer tabela real, e nunca em Production**.

**D.1) SUPERUSER / CREATEDB / CREATEROLE — preferir esta consulta primeiro, é só leitura, sem
efeito colateral nenhum** (roda em qualquer ambiente, inclusive Production, sem risco — mas o
restante do checklist continua Preview-only):

```sql
SELECT rolsuper, rolcreatedb, rolcreaterole
  FROM pg_roles
 WHERE rolname = current_user;
-- Esperado: false / false / false
```

**D.2) CREATE / ALTER / DROP / TRUNCATE — cada teste isolado na SUA PRÓPRIA transação**, nunca
vários comandos que devem falhar dentro da mesma transação sem `SAVEPOINT` (depois que um comando
falha, o Postgres marca a transação inteira como abortada — qualquer comando seguinte, mesmo um
`ROLLBACK` mal posicionado ou um teste "inofensivo", erraria só por causa disso, não pela falta de
privilégio de verdade — o resultado ficaria difícil de interpretar). Rodar cada bloco abaixo
**separadamente**, um de cada vez, confirmando o erro de "permission denied" antes de seguir para
o próximo:

```sql
-- Teste 1 de 4 - CREATE
BEGIN;
CREATE TABLE _privilege_test (id serial primary key);
ROLLBACK;
-- Esperado: falha em CREATE TABLE (permission denied for schema public), ROLLBACK só por cautela
```

```sql
-- Teste 2 de 4 - ALTER
BEGIN;
ALTER TABLE analytics_events ADD COLUMN _privilege_test TEXT;
ROLLBACK;
-- Esperado: falha em ALTER TABLE (permission denied), ROLLBACK só por cautela
```

```sql
-- Teste 3 de 4 - DROP
BEGIN;
DROP TABLE analytics_events;
ROLLBACK;
-- Esperado: falha em DROP TABLE (permission denied) - o ROLLBACK aqui é cinto de segurança
-- extra, nunca confiar só nele para "desfazer" um DROP que porventura tivesse funcionado
```

```sql
-- Teste 4 de 4 - TRUNCATE
BEGIN;
TRUNCATE analytics_events;
ROLLBACK;
-- Esperado: falha em TRUNCATE (permission denied)
```

Se qualquer um dos 4 acima **não falhar**, pare imediatamente: a role tem privilégio demais e a
criação (`db/roles/create_runtime_role.sql`) precisa ser revisada antes de usar em Production.

**D.3) CREATE ROLE — opcional, só em ambiente de TESTE, NUNCA em Production.** A consulta D.1
já confirma `rolcreaterole=false` sem nenhum efeito colateral — este teste é só uma segunda
confirmação prática, dispensável. Se decidir rodar mesmo assim, faça isso **isoladamente**, numa
transação própria, nunca junto dos testes D.2 acima:

```sql
-- Opcional, só em banco de TESTE - NUNCA em Production. D.1 já confirma isso de forma segura.
BEGIN;
CREATE ROLE _privilege_test_role;
ROLLBACK;
-- Esperado: falha (permission denied to create role)
```

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
2. Rode `db/roles/create_runtime_role.sql` com a role atual (que tem permissão para criar
   roles) — troque a senha placeholder e `<role_atual_de_migration>` pelos valores reais antes.
3. Configure `DATABASE_MIGRATION_URL` (role atual/owner) na Vercel (Production **e** Preview) e
   localmente — o script de migration agora **exige** essa variável em Production/CI (fail-closed,
   ver seção acima); sem configurá-la lá, `npm run db:migrate` aborta.
4. Teste a nova `DATABASE_URL` (com `imesul_vendas_app`) num ambiente de Preview antes de trocar
   em Production — use o "Checklist de validação no Preview" acima (fluxo positivo + testes
   negativos de DDL).
5. Só depois disso, troque a `DATABASE_URL` de Production na Vercel.
