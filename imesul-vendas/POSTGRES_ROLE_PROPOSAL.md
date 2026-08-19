<!-- title: Proposta de role de menor privilégio (Postgres) -->

# Proposta de role de menor privilégio — Postgres

**Não executado.** Este documento só propõe; nenhuma mudança de role foi aplicada ao banco.
Rodar isso em produção sem cuidado pode derrubar o site (uma role sem privilégio suficiente faz
toda query falhar), por isso a decisão e a execução ficam com você.

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
  do projeto                                  só nas tabelas usadas em runtime
- usada só em scripts/migrate-db.mjs        - usada em toda requisição normal
- nunca fica em Backend.js/db.js              (Backend.js/db.js, o que o site usa
                                               o tempo todo)
```

A role da aplicação **não precisa** de `DROP`, `ALTER`, `CREATE`, `TRUNCATE`, `SUPERUSER`,
`CREATEROLE` ou `CREATEDB` — só ler/escrever linhas nas tabelas que o código já usa:
`analytics_events`, `admin_sessions`, `sales_sellers`, `sales_leads`, `rate_limit_counters`.

## SQL necessário (não executado)

```sql
-- 1) Cria a role de aplicação, com senha separada da role atual.
CREATE ROLE imesul_vendas_app WITH LOGIN PASSWORD '<definir uma senha forte>';

-- 2) Concede só o necessário, tabela por tabela.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  analytics_events,
  admin_sessions,
  sales_sellers,
  sales_leads,
  rate_limit_counters
TO imesul_vendas_app;

-- 3) BIGSERIAL usa uma sequence por trás do id - a role de aplicação precisa poder avançar
-- essas sequences para conseguir fazer INSERT.
GRANT USAGE, SELECT ON
  analytics_events_id_seq,
  admin_sessions_id_seq,
  sales_sellers_id_seq,
  sales_leads_id_seq
TO imesul_vendas_app;

-- 4) Garante que tabelas FUTURAS criadas pela role de migration também concedam esses
-- privilégios automaticamente à role de aplicação, sem precisar repetir o GRANT a cada migration.
ALTER DEFAULT PRIVILEGES FOR ROLE <role_atual_de_migration>
  IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO imesul_vendas_app;

-- 5) Explicitamente SEM: CREATE, ALTER, DROP, TRUNCATE, SUPERUSER, CREATEROLE, CREATEDB.
-- (Não precisa de nenhum SQL para "remover" isso - a role só tem o que foi concedido acima.)
```

## Variável de ambiente nova necessária

Depois de criar a role, a `DATABASE_URL` usada em produção (Vercel → Project → Settings →
Environment Variables) passaria a apontar para `imesul_vendas_app`, não mais para a role atual.
A role atual (mais privilegiada) ficaria só para rodar migrations manualmente — sugestão de nome:
`DATABASE_MIGRATION_URL`, usada apenas por `scripts/migrate-db.mjs` (nunca por
`Backend.js/db.js`, que é o que roda em toda requisição).

## Por que não fiz isso agora

1. Não tenho acesso à `DATABASE_URL` de produção neste ambiente para executar o SQL acima.
2. Trocar a role em produção sem testar primeiro pode quebrar TODAS as queries do site
   (analytics, leads, sessão admin) se algum privilégio necessário for esquecido no `GRANT`.
3. Você pediu explicitamente para não executar mudança de role sem aprovação e informação prévia
   — isso é exatamente o que este documento é.

## Como aplicar, quando você decidir

1. Rode as queries de "Situação atual" acima para confirmar a role/privilégios de hoje.
2. Rode o SQL da seção "SQL necessário" com a role atual (que tem permissão para criar roles).
3. Teste a nova `DATABASE_URL` (com `imesul_vendas_app`) num ambiente de preview antes de trocar
   em produção — confirme que login admin, analytics e leads continuam funcionando.
4. Só depois disso, troque a `DATABASE_URL` de produção na Vercel.
