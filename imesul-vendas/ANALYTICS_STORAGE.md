# Armazenamento de analytics e sessão admin

Este documento explica onde os dados de analytics e as sessões administrativas ficam
guardados, o que muda com `DATABASE_URL` configurada ou não, e como testar/verificar cada
cenário. Nenhum valor real de credencial aparece aqui.

## Dois modos de funcionamento

O backend (`Backend.js/analyticsStore.js` e `Backend.js/adminSecurity.js`) decide o modo em
tempo de execução, olhando se `process.env.DATABASE_URL` existe:

### Com `DATABASE_URL` configurada — modo produção

- Eventos de analytics: tabela `analytics_events` no Postgres. Cada evento é um `INSERT`
  independente — nunca lê o histórico inteiro para gravar um evento novo.
- Sessões administrativas: tabela `admin_sessions` no Postgres. O token continua sendo gerado
  com `crypto.randomBytes(32)` (256 bits) e enviado cru ao navegador; **só o SHA-256 dele** fica
  salvo no banco (`token_hash`). Login cria a linha; logout marca `revoked_at = NOW()`
  (revogação explícita, não `DELETE`); validação confere `token_hash` + `revoked_at IS NULL` +
  `expires_at > NOW()`.
- Qualquer instância serverless da Vercel reconhece a mesma sessão e os mesmos eventos —
  esse é o problema que este modo resolve em relação ao modo local.

### Sem `DATABASE_URL` — modo desenvolvimento local (fallback)

- Eventos: arquivo JSON em `os.tmpdir()`. **Não é persistente em produção serverless**: cada
  instância pode ter seu próprio arquivo, e um novo deploy apaga tudo. Existe só para permitir
  rodar `npm run dev` sem precisar de um banco configurado.
- Sessões: `Map()` em memória do processo. Também não sobrevive a redeploy/reinício e não é
  compartilhada entre instâncias.
- O site público (catálogo, orçamento, WhatsApp) nunca depende deste fallback — só o analytics
  e o painel admin usam.

**Nunca trate o modo local como armazenamento de produção.** Se `DATABASE_URL` não estiver
configurada em produção, o analytics funciona, mas cada evento pode desaparecer a qualquer
momento — isso é esperado e documentado, não um bug.

## Variáveis de ambiente necessárias

Adicione ao ambiente do projeto (Vercel → Project → Settings → Environment Variables, ou
`.env.local` para desenvolvimento):

```env
# Connection string padrao do Postgres. Compativel com qualquer provedor
# (Neon, Supabase, RDS, etc.) - o codigo nao assume nenhuma marca especifica.
DATABASE_URL=

# Ja existente no projeto - preservar o valor atual, nao gerar um novo.
ANALYTICS_SECURITY_KEY=

# Ja existentes no projeto.
ADMIN_DEMO_USER=
ADMIN_DEMO_PASSWORD=
```

`imesul-vendas/.env.example` não foi atualizado neste trabalho porque já tinha uma alteração
local pendente e não relacionada (`NEXT_PUBLIC_INSTITUTIONAL_SITE_URL`) no momento em que este
documento foi criado — não sobrescrever mudanças de outra tarefa. `DATABASE_URL` fica
documentada aqui até que `.env.example` possa ser atualizado sem esse conflito.

## Migration

O schema fica em `db/migrations/001_initial.sql` (cria `analytics_events` e `admin_sessions`,
com índices). Para aplicar:

```bash
npm run db:migrate
```

O script (`scripts/migrate-db.mjs`) lê `DATABASE_URL`, roda cada arquivo `.sql` de
`db/migrations/` em ordem, dentro de uma transação. Toda a DDL usa `CREATE TABLE`/`INDEX IF NOT
EXISTS`, então rodar de novo não quebra nada.

## Pool de conexões

`Backend.js/db.js` mantém um único `Pool` do `pg` por instância do processo (reaproveitado
entre invocações "quentes" da mesma função serverless), com `max` configurável via
`DATABASE_POOL_MAX` (padrão: 3). Isso evita abrir uma conexão nova a cada evento - o número
total de conexões escala com o número de instâncias concorrentes da Vercel, não com o número de
requisições.

## Como testar

### Sem banco (modo local)

```bash
npm run dev
```

O site público, o login admin e o analytics devem funcionar normalmente (eventos indo para o
arquivo temporário). Isso é o comportamento padrão sem `DATABASE_URL`.

### Com banco

1. Configure `DATABASE_URL` em `.env.local`.
2. Rode `npm run db:migrate`.
3. Rode `npm run dev`.
4. Gere um evento (navegue pelo site, ou `POST /api/analytics/track`).
5. Confira no `GET /api/analytics/events` (autenticado) que o evento aparece.
6. **Reinicie o servidor** (`Ctrl+C` e `npm run dev` de novo) e confira de novo — o evento deve
   continuar lá. Esse é o teste que prova persistência de verdade (o arquivo JSON local também
   "passaria" nesse teste sozinho; o que ele não sobrevive é a múltiplas instâncias/deploys,
   difícil de simular localmente).
7. Faça login admin, guarde o token, reinicie o servidor, confirme que o token ainda funciona
   até expirar (8h) - prova que a sessão está no banco, não só na memória do processo antigo.

## Retenção de dados

Não existe limite de retenção automático (o `maxEvents = 2000` do arquivo JSON era uma
limitação do armazenamento em arquivo, não copiada para o Postgres). Se o volume de eventos
crescer a ponto de precisar de rotação/expiração, isso é uma decisão de produto que precisa ser
tomada explicitamente (ex.: `DELETE` de eventos com mais de N dias) - não implementado aqui sem
essa decisão.

## Limitações conhecidas, deixadas de fora de propósito

- **Rate limiting continua em memória** (`Map()`), não migrado para o Postgres nesta etapa. Não
  é global entre instâncias serverless - cada instância tem seus próprios contadores. Migrar
  isso é um trabalho separado, avaliado só depois que analytics e sessão já estivessem
  persistentes (prioridade explícita desta tarefa).
- **Rankings do painel** (visitantes, botões mais clicados, localização) usam um recorte dos
  500 eventos mais recentes do período selecionado, não o histórico inteiro - evita
  `SELECT * FROM analytics_events` sem limite. Os cards de métricas (que precisam ser exatos)
  **não** usam esse recorte: vêm de uma consulta agregada (`COUNT`/`GROUP BY`) separada e
  sempre correta, independente da paginação da tabela.
