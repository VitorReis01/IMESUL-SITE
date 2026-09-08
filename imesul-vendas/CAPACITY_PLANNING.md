<!-- title: Escalabilidade, alta disponibilidade e resiliencia - IMESUL-SITE -->

# Escalabilidade, alta disponibilidade e resiliência — IMESUL-SITE

**Documento de análise e planejamento. Nada foi alterado em Production, commitado, deployado ou
executado contra o banco real.** Todas as afirmações abaixo vêm de leitura direta do código
(arquivos citados por caminho) — onde não havia como confirmar por código (limites reais do plano
Vercel/Supabase, capacidade real sob carga), isso é dito explicitamente, nunca inventado.

## Revisão desta rodada (2026-09-08)

Rodada de revisão sobre os 4 pontos levantados após a análise inicial. Resumo do que mudou —
detalhes em cada seção linkada:

1. **Pooler (P0)** — continua não confirmável por código; esta rodada troca a afirmação solta por
   uma **checklist manual objetiva** (seção 5-A) para ser conferida no dashboard Supabase/Vercel.
2. **Tarefas pós-resposta** — `linkCartToLead`/`notifyImebotOfNewLead` agora rodam dentro de
   `after()` (`next/server`), com `.catch` explícito e log seguro — implementado e testado (seção
   2 e 12). Ver [app/api/leads/route.js](app/api/leads/route.js).
3. **Rodízio sob concorrência** — análise aprofundada encontrou a causa raiz real: o lock de
   `sales_sellers` fica preso pela transação inteira do lead, não só pelo `UPDATE` (seção 9).
   Mitigação de retry curto implementada e testada (mock). **Status: MITIGADO, NÃO RESOLVIDO** —
   retry de 3 tentativas não é garantia matemática de `seller != null` sob qualquer nível de
   concorrência, só reduz a janela de perda. Teste de concorrência real (10/50/100 leads, 2
   vendedores) escrito e **NÃO EXECUTADO** (sem banco de teste disponível nesta sessão - ver seção
   9-C) — este P1 não deve ser considerado resolvido até esse teste rodar. Opções arquiteturais
   apresentadas, nenhuma implementada ainda (seção 9-D).
4. **Idempotência (borda de 60s)** — bug confirmado por teste (`Date.now` cruzando a fronteira do
   bucket). Corrigido para o fluxo do navegador via `clientRequestId` gerado no cliente + guarda
   contra clique duplo; fallback legado (sem `clientRequestId`) preserva o comportamento antigo,
   incluindo a limitação (seção 11-A).
5. **Dourados** — alternador não alterado; documentado explicitamente que a degradação do
   fallback local sob múltiplas instâncias é aceitável (seção 10).
6. **Linguagem de capacidade** — "Conclusão objetiva" (seção final) revisada para nunca declarar
   capacidade numérica sem teste de carga real.

## Revisão final antes do commit (2026-09-08, rodada seguinte)

Última revisão antes de aprovação, focada em 2 lacunas reais encontradas na rodada anterior:

1. **`clientRequestId` — bug de duplicação em timeout + novo clique, CORRIGIDO.** A rodada
   anterior corrigiu a borda de 60s, mas não cobria o caso "servidor cria o lead e responde 200,
   mas a resposta nunca chega ao navegador (timeout) + o cliente clica de novo" — isso GERAVA um
   `clientRequestId` novo a cada clique, então o segundo clique criava um SEGUNDO lead (a dedup
   não ajudava, porque a chave era diferente). Corrigido reaproveitando o mesmo `clientRequestId`
   enquanto o resultado da tentativa anterior for ambíguo (rede falhou/resposta cortada - ver
   `lib/leads.js`), com TTL curto de 3 minutos, limpo imediatamente em qualquer resultado
   definitivo. Ver seção 11-B abaixo.
2. **`resolveMigrationDatabaseUrl` — `CI=false` era tratado como CI ativo.** `Boolean("false")` é
   `true` em JS - uma variável `CI` literalmente igual à string `"false"` (comportamento real de
   alguns provedores/ferramentas que só lidam com strings) fazia o script abortar em
   Production/CI por engano. Corrigido com normalização explícita. Ver seção "CI" em
   `scripts/migrate-db.mjs`.

Confirmado sem necessidade de mudança: `after()` (seção 2/12, os 5 critérios revisados batem com
o código atual). Corrigido também: os testes negativos da role em `POSTGRES_ROLE_PROPOSAL.md`
(cada um isolado em sua própria transação, já era o caso - ver seção dedicada no documento).

## 1. Arquitetura atual encontrada

```
GitHub → Vercel (build/deploy independente por projeto)
  ├─ imesul          (institucional, porta dev 3000, sem persistência própria)
  └─ imesul-vendas    (vendas, porta dev 3001, todo o backend real)
                          ↓
                   Next.js Route Handlers (serverless functions, 1 por rota)
                          ↓
                   Backend.js/db.js → pool `pg` (max 3 por instância)
                          ↓
                   PostgreSQL (Neon/Supabase - `sslmode` autodetectado)
```

Sem `vercel.json` versionado — crons, headers extras e rewrites de produção (se existirem além
de `next.config.js`) não são auditáveis pelo Git. Sem read replica, sem Redis, sem fila — tudo
que existe hoje é Vercel serverless + um único Postgres primary.

## 2. Caminho crítico atual (clique → vendedor)

Rastreado arquivo por arquivo a partir do clique real em "Falar com vendedor"/checkout:

```
Cliente (QuoteBuilder/carrinho)
  → lib/leadWhatsApp.js#openWhatsAppWithLead
      1. window.open("", "_blank") SÍNCRONO dentro do clique (evita bloqueio de popup)
      2. fetch POST /api/leads
  → app/api/leads/route.js
      1. checkOrigin (allowlist, síncrono, sem I/O)
      2. checkGlobalApiRateLimit → 1 query Postgres (UPSERT em rate_limit_counters)
      3. checkRateLimitLayers (burst 2/10s + minuto 5/60s por IP) → 2 queries em paralelo
      4. parse/validação do payload (síncrono)
  → Backend.js/salesLeadsStore.js#createLead → withTransaction (1 conexão do pool)
      1. BEGIN
      2. SELECT idempotency_key (dedup 60s) → índice UNIQUE, O(1)
      3. assignNextSeller → SELECT ... FOR UPDATE SKIP LOCKED (só se unit=campo-grande)
      4. UPDATE sales_sellers.last_assigned_at
      5. INSERT INTO sales_leads (retry até 5x só em colisão de lead_code, extremamente raro)
      6. INSERT em sales_lead_events (1-2 linhas, auditoria)
      7. COMMIT
  → resposta ao cliente (seller.whatsapp + leadCode)
  → popup preenchido com wa.me/<vendedor>
```

**Queries no caminho crítico**: 3 antes da transação (global + 2 camadas de rate limit,
paralelas) + 1 transação com 4-5 statements sequenciais na mesma conexão = **~7-8 round-trips
ao Postgres por lead**, todos parametrizados, nenhum `SELECT *`.

**Chamadas síncronas que atrasam a resposta ao cliente**: só as acima. Nenhuma chamada de rede
externa (Meta, Sentry, analytics) está no caminho síncrono hoje — confirmado lendo
`app/api/leads/route.js` linha a linha.

**Achado real, CORRIGIDO nesta rodada**: `linkCartToLead` e `notifyImebotOfNewLead` eram chamados
**sem `await`** em `app/api/leads/route.js`, com comentário "best-effort, nunca atrasa a
resposta". A intenção estava certa, mas a implementação não usava `waitUntil()`/`after()`
(Next.js) para garantir que a promise realmente terminasse depois da resposta ser enviada — numa
function serverless da Vercel, a execução pode ser congelada assim que a resposta é despachada,
então essas duas chamadas podiam simplesmente não completar sob carga, silenciosamente.

**Correção aplicada**: as duas chamadas agora rodam dentro de `after()` (`next/server`, estável
na versão 16.3.1 já usada neste projeto — confirmado por `node -e "require('next/server').after"`
nesta sessão), que garante que a função passada roda até o fim mesmo depois da resposta HTTP já
ter sido despachada ao cliente. Cada chamada é envolvida por `runBestEffortTask` (novo, exportado
em `app/api/leads/route.js`), que sempre resolve (nunca propaga rejeição — evita unhandled
rejection dentro de `after()`) e loga com segurança via `logger.error("post_lead_task_failed",
{task, reason})` em caso de falha (`Backend.js/logger.js`, já sanitiza automaticamente qualquer
campo sensível — nunca loga o corpo do lead nem dado de cliente, só o nome da tarefa e
`err.message`). `waitUntil()` da Vercel não foi necessário: `after()` já é a API nativa do
Next.js para exatamente este caso, sem acoplamento a um provedor específico.

Testado em `test/leadsRoutePostResponseTasks.test.js` (4 casos: sucesso não loga, rejeição nunca
propaga, rejeição loga evento+tarefa+só a mensagem do erro, rejeição não-Error também é tratada).
Por convenção deste projeto nenhuma rota de API tem teste direto (ver `CLAUDE.md`) — o teste cobre
a função extraída `runBestEffortTask`, não o handler HTTP inteiro.

**Lock/transação**: só um lock real no caminho crítico — `FOR UPDATE SKIP LOCKED` em
`sales_sellers`, dentro da mesma transação do INSERT. `SKIP LOCKED` (não `FOR UPDATE` simples) é
a escolha certa: uma segunda transação concorrente nunca espera nem recebe o mesmo vendedor já
travado por outra (`Backend.js/salesLeadsStore.js:91-99`, comentado no próprio código).

**Race condition**: nenhuma encontrada. Dedup por `idempotency_key` (UNIQUE constraint) cobre
clique duplo/retry; colisão tratada explicitamente (`err.code === "23505"`) buscando o lead já
criado pela transação concorrente em vez de falhar.

**Timeout**: nenhum timeout explícito na transação de lead em si (só `connectionTimeoutMillis:
5000` do pool). Um `SELECT ... FOR UPDATE SKIP LOCKED` nunca fica preso esperando (pula linhas
travadas), então o risco de transação longa aqui é baixo por natureza da query, não por
configuração.

## 3. Gargalos reais (confirmados no código)

1. **`dourados_alternator_state`** (`Backend.js/douradosAlternatorStore.js`) — um único `UPDATE`
   numa tabela de **1 linha fixa** (`WHERE id = 1`). Por design (precisa alternar 1-por-1), isso é
   **inerentemente serializado**: toda requisição de Dourados espera o lock de linha da anterior.
   Não é bug — é o único jeito correto de garantir alternância estrita — mas é o único ponto do
   sistema onde concorrência alta vira fila de verdade, mesmo que só por microsegundos cada.
2. **`linkCartToLead`/`notifyImebotOfNewLead` sem `await`/`waitUntil`** — CORRIGIDO nesta rodada
   via `after()` (ver item 2). Era risco de confiabilidade, não de performance.
3. **`DATABASE_POOL_MAX=3` (default)** combinado com potencial de muitas instâncias serverless
   simultâneas — ver seção 5.

## 4. Gargalos potenciais (ainda não são problema no volume atual, mas merecem atenção)

- Índice de `sales_sellers` (`idx_sales_sellers_active_last_assigned` em `active, last_assigned_at`)
  **não inclui `unit`**, mas a query de produção filtra por `unit` também
  (`Backend.js/salesLeadsStore.js:117-122`). Irrelevante hoje (tabela de vendedores é pequena por
  natureza — não escala com tráfego, só com contratações), mas fica documentado. **P3**.
- `imesul-vendas/Backend.js/analyticsStore.js` faz `SELECT *` na listagem paginada do painel
  admin (já documentado em `RELIABILITY.md`) — sem impacto na venda (rota admin, não pública),
  mas consome mais I/O que precisaria por página. **P2**.
- `processDueFeedbackJobs` (`Backend.js/feedbackStore.js`) roda até 20 jobs por lote com várias
  queries individuais por job dentro da mesma transação — não afeta o caminho crítico da venda
  (é o cron do IMEbot), mas escalaria mal se o volume de jobs crescer muito. **P3**.

## 5. Risco de connection exhaustion

`Backend.js/db.js:33` — `max: Number(process.env.DATABASE_POOL_MAX || 3)`. Pool é reaproveitado
só entre invocações "quentes" da **mesma instância** serverless (variável de módulo) — cada
instância fria cria seu próprio pool.

**Modelo (baseado só no que o código garante, não em número de conexão real do provedor)**:

| Functions simultâneas | Conexões teóricas (POOL_MAX=3) | Conexões teóricas (POOL_MAX=5) |
|---|---|---|
| 10 | até 30 | até 50 |
| 50 | até 150 | até 250 |
| 100 | até 300 | até 500 |
| 500 | até 1.500 | até 2.500 |

Isso é o **teto teórico por código** (cada instância nunca abre mais que `POOL_MAX`) — não é uma
previsão de quantas instâncias a Vercel realmente vai criar (isso depende do plano contratado e
do autoscaling deles, que não está no código nem posso confirmar aqui) nem de quantas conexões o
Postgres real aceita (isso depende do plano Supabase/Neon e de estar usando o **Transaction
Pooler** ou a conexão direta — `DATABASE_URL` não está configurada neste ambiente de trabalho,
então não dá pra confirmar qual dos dois modos está em uso agora). **Isso precisa ser confirmado
manualmente no dashboard do Supabase antes de qualquer decisão de capacidade.**

`idleTimeoutMillis: 10_000` e `connectionTimeoutMillis: 5_000` já existem — uma instância que
fica ociosa libera a conexão em 10s, e uma tentativa de conexão que não consegue em 5s falha
rápido (fail-closed, não fica pendurada). Isso já ajuda a não acumular conexões mortas.

**P0**: confirmar no Supabase se `DATABASE_URL` aponta para o **Transaction Pooler** (porta
6543) e não a conexão direta (porta 5432) — isso multiplica ou não a capacidade real de suportar
muitas instâncias serverless simultâneas. Não posso confirmar isso pelo código, só pela string de
conexão real (que não devo pedir/ver aqui).

### 5-A. Checklist manual objetiva (dashboard Supabase + Vercel — não código)

Continua não sendo algo que o código sozinho prova (a `DATABASE_URL` real não está configurada
neste ambiente de trabalho, e mesmo que estivesse, não é para eu ler/logar o valor). Checklist
para conferir manualmente, sem colar senha nem connection string completa em lugar nenhum:

| # | Item | Onde conferir | Como ler o resultado |
|---|---|---|---|
| 1 | **Host/porta usados por `DATABASE_URL`** | Vercel → Project → Settings → Environment Variables → `DATABASE_URL` (só visualizar o host:porta, não precisa copiar a senha) | Porta **6543** = Transaction Pooler (PgBouncer da Supabase). Porta **5432** = conexão direta ao Postgres. |
| 2 | **É Transaction Pooler?** | Supabase Dashboard → Project Settings → Database → Connection string → aba "Transaction" vs. "Session"/"Direct connection" | O host do modo "Transaction" geralmente começa com `aws-0-...pooler.supabase.com` (difere do host da conexão direta) |
| 3 | **Modo de pooling** | Mesma tela do Supabase, seletor de modo da connection string | Precisa ser **"Transaction"**, não "Session" — modo Session não ajuda a multiplicar conexões para muitas instâncias serverless simultâneas |
| 4 | **Limite de conexões do plano** | Supabase Dashboard → Project Settings → Database → seção "Connection pooling" (mostra `pool_size`/`max_client_conn`) ou → Infrastructure/Add-ons (limite do plano contratado) | Anotar o número — é o teto real do provedor, independente do que a aplicação pedir |
| 5 | **`DATABASE_POOL_MAX` configurada hoje** | Vercel → Environment Variables → `DATABASE_POOL_MAX` (Production e Preview podem ter valores diferentes) | Se vazia, o código usa **3** por padrão (`Backend.js/db.js:33`) |
| 6 | **Número máximo teórico de conexões da aplicação** | Cálculo manual: `DATABASE_POOL_MAX × número máximo de instâncias serverless simultâneas que a Vercel pode escalar no plano contratado` | Comparar contra o item 4 — se o teórico já ultrapassa o limite do plano/pooler mesmo em uso normal, é sinal de ajustar `DATABASE_POOL_MAX` para baixo antes de qualquer campanha |

**Não fazer nesta checklist**: não alterar nenhuma env var, não copiar a connection string
completa para fora do dashboard (nem para este documento, nem para chat, nem para print), não
testar a conexão direto do terminal com a string real fora de um ambiente já autorizado. Resultado
esperado ao final: uma linha por item acima, preenchida manualmente, sem nenhum segredo colado.

## 6. Estado do pooling

Já descrito acima — pool único por processo, reaproveitado entre invocações quentes,
`max`/timeouts configurados. **Não há PgBouncer/pooler adicional no código** — se o Supabase já
fornece um (Transaction Pooler), a responsabilidade de multiplexar muitas conexões lógicas em
poucas físicas é inteiramente do provedor, não da aplicação. **P0** confirmar isso (mesmo item da
seção 5).

## 7. Estado do cache/CDN

| Categoria | O que já está lá | Observação |
|---|---|---|
| **A) Static/CDN** | Imagens, vídeos, PDF do catálogo, fontes — tudo em `public/` dos dois projetos, servido pela Vercel Edge automaticamente | Já ótimo, nada a fazer |
| **B) Cacheável** | `data/products.js` (catálogo, praticamente estático) já é importado direto no bundle/SSR — **nunca toca banco** | Já correto por construção, não por cache explícito |
| **C) Dinâmico** | Lead, rodízio, alternador, sessão admin, analytics, painel | Corretamente isolado em rotas próprias |

**Visita comum → banco**: confirmado que **zero** — nem a home institucional nem o catálogo de
`imesul-vendas` fazem query em Postgres para renderizar. O Postgres só é tocado quando o cliente
efetivamente aciona uma ação (rate limit check em qualquer POST, criação de lead, tracking
explícito com consentimento). Isso já é o resultado ideal descrito no pedido ("visita não deveria
custar banco") — **não é uma lacuna, é o estado atual real**.

`/api/health` (ambos os sites) não toca banco. `/api/health/database` toca (`SELECT 1`,
propositalmente, é o objetivo da rota).

## 8. Estado das queries

Já auditado com detalhe em `RELIABILITY.md` (seção 11) nesta mesma rodada de trabalho anterior.
Resumo aplicado ao caminho crítico: `sales_leads` tem índice em `idempotency_key` (UNIQUE) e
`lead_code` (UNIQUE) — a única leitura da transação de lead usa o índice UNIQUE, é O(1)/O(log n).
`sales_sellers` tem índice composto cobrindo quase toda a query (falta só `unit`, tabela pequena
demais para importar). Nenhum `JOIN` no caminho crítico do lead. Nenhum `ORDER BY` caro (o
`ORDER BY last_assigned_at` já usa o índice). **Queries que valem `EXPLAIN ANALYZE` num banco de
homologação antes de qualquer teste de carga real** (não executado aqui, só listado como pedido):

- `SELECT ... FROM sales_sellers WHERE active = TRUE AND unit = $1 ORDER BY last_assigned_at ASC NULLS FIRST LIMIT 1 FOR UPDATE SKIP LOCKED`
- `SELECT ... FROM sales_leads WHERE idempotency_key = $1`
- `INSERT INTO rate_limit_counters ... ON CONFLICT DO UPDATE` (roda em toda request, é o mais frequente do sistema)
- `SELECT * FROM analytics_events ...` no painel admin (a única com `SELECT *` encontrada)

## 9. Estado de concorrência do rodízio (Campo Grande)

`FOR UPDATE SKIP LOCKED` + transação única + `idempotency_key` único garante **correção**
(nenhum lost update, nenhuma dupla escolha do mesmo vendedor, ordem consistente via
`last_assigned_at ASC NULLS FIRST` + `UPDATE` imediato na mesma transação). Esta rodada foi além
de confirmar correção e investigou o requisito funcional levantado: **uma rajada legítima pode
transformar concorrência momentânea em "nenhum vendedor disponível" mesmo havendo vendedores
ativos?**

> **STATUS (revisado nesta rodada): MITIGADO, NÃO RESOLVIDO.** O retry de 3 tentativas (9-B) é
> uma **mitigação**, não uma garantia matemática de `seller != null` sob qualquer nível de
> concorrência — ela reduz a janela de perda para rajadas pequenas/moderadas, mas não elimina a
> causa raiz (9-A) sob contenção sustentada. A solução estrutural (9-D, Opção B) continua
> dependendo do teste real contra PostgreSQL (9-C). **Este P1 não deve ser declarado resolvido até
> `test/dbIntegration.concurrency.test.js` rodar contra um banco de teste real com 10, 50 e 100
> leads simultâneos** e os números confirmarem se a mitigação é suficiente ou se a Opção B é
> necessária.

### 9-A. Causa raiz real (achado desta rodada, não estava na análise anterior)

A análise anterior (seção 9, versão original) tratava a janela de contenção como "microsegundos"
— isso está **incompleto**. `SELECT ... FOR UPDATE SKIP LOCKED` roda dentro de
`withTransaction(async (client) => {...})` em `createLead` (`Backend.js/salesLeadsStore.js`), e o
lock de linha do `FOR UPDATE` só é liberado no **COMMIT da transação inteira** — não no momento
do `UPDATE sales_sellers`. Essa mesma transação ainda faz, depois de escolher o vendedor: o
`INSERT INTO sales_leads` (com até 5 tentativas em caso de colisão rara de `lead_code`) e 1-2
`INSERT INTO sales_lead_events`. Ou seja, **o lock da linha do vendedor fica preso pela duração
de toda a criação do lead**, não só pela escolha do vendedor — várias idas e vindas de rede entre
a function serverless e o Postgres, não um único `UPDATE` rápido.

Consequência prática: com só **2 vendedores ativos**, no máximo 2 transações podem estar
"segurando" um vendedor a qualquer instante. Qualquer 3ª transação concorrente que tente
`SELECT ... FOR UPDATE SKIP LOCKED` enquanto as 2 primeiras ainda não deram `COMMIT` recebe 0
linhas — não porque não existem vendedores ativos, mas porque os únicos 2 que existem estão
temporariamente "emprestados" a outras transações em andamento. Isso **não é uma janela de
poucos microsegundos** como a análise original sugeria — é da ordem da duração inteira da
transação de criação do lead (tipicamente dezenas de milissegundos, dependendo da latência de
rede até o Postgres), tempo suficiente para que uma rajada real de leads simultâneos produza
`seller_id NULL` só por causa de concorrência, mesmo com vendedores ativos cadastrados.

### 9-B. Mitigação implementada nesta rodada: retry curto e limitado

`Backend.js/salesLeadsStore.js#assignNextSeller` agora tenta a consulta `FOR UPDATE SKIP LOCKED`
até **3 vezes** (a 1ª tentativa + 2 retries), com um espaçamento curto entre tentativas (25ms na
2ª, 50ms na 3ª — não é espera longa, é uma segunda chance para o caso comum de poucas transações
sobrepostas por poucos milissegundos). Só desiste (retorna `null`, lead criado sem vendedor,
comportamento já existente preservado) depois de esgotar as 3 tentativas. Continua usando
`SKIP LOCKED` (não muda a estratégia de lock) — mudança pequena, confinada a uma função, sem
alteração de schema.

**O que essa mitigação resolve**: rajadas pequenas/moderadas, onde a contenção é passageira.
**O que ela NÃO resolve sozinha**: contenção **sustentada** (muito mais requisições concorrentes
do que vendedores, chegando continuamente) — nesse caso os retries também vão encontrar as
mesmas 2 linhas ocupadas na maior parte do tempo, porque o gargalo de fundo (lock preso pela
transação inteira) continua existindo. Testado com mock em
`test/salesLeadsRodizio.test.js` (contenção nas 2 primeiras tentativas resolvida na 3ª; contenção
nas 3 tentativas desiste corretamente; `unit=dourados` nunca aciona nem consulta
`sales_sellers`, preservado).

### 9-C. Teste de concorrência real — ESCRITO, NÃO EXECUTADO

`test/dbIntegration.concurrency.test.js` implementa o cenário pedido contra Postgres real (não
mock): 2 vendedores de teste isolados, rajadas de **10/50/100** leads simultâneos via
`Promise.all`, medindo quantos recebem vendedor vs. `seller_id NULL`, distribuição entre
vendedores, tempo decorrido, além de confirmar as invariantes de correção (nenhum `lead_code`
duplicado, nenhuma atribuição contada 2x, todo `seller_id` pertence aos vendedores de teste).
Também inclui o cenário de idempotência (ver seção 11-A). Nenhuma chamada a WhatsApp/Meta/IMEbot
real acontece (chama `createLead` diretamente, não a rota HTTP — a notificação do IMEbot só é
disparada por `app/api/leads/route.js`, nunca por `createLead`).

**Por que não rodou nesta sessão**: não há `DATABASE_URL` configurada neste ambiente de trabalho,
e a instrução explícita foi não conectar nem executar SQL contra o banco real sem autorização. O
teste tem uma trava dupla deliberada (`DATABASE_URL` **e** `ALLOW_DB_INTEGRATION_TESTS=1`
precisam estar presentes) para nunca rodar sem intenção clara, nem em CI, nem por engano. Rodar
manualmente contra um banco de **homologação** já migrado, quando autorizado:

```bash
ALLOW_DB_INTEGRATION_TESTS=1 DATABASE_URL="postgres://.../homolog" npx vitest run test/dbIntegration.concurrency.test.js
```

**Pendência real**: até esse teste rodar contra um banco de verdade, os números concretos de
"quantos leads ficam sem vendedor sob 10/50/100 simultâneos com só 2 vendedores" continuam
desconhecidos — só o mecanismo (causa raiz + mitigação) está provado por análise e por teste
mockado.

### 9-D. Opções para a correção arquitetural completa (apresentadas, NÃO implementadas)

A causa raiz (seção 9-A) só é eliminada de vez separando a escolha do vendedor da criação do
lead — qualquer solução que mantenha as duas no mesmo `BEGIN...COMMIT` (incluindo trocar
`SKIP LOCKED` por advisory lock ou por um contador atômico) herda o mesmo problema de fundo,
porque o que prende o lock é a duração da transação, não a primitiva de lock em si.

| Opção | Descrição | Resolve a causa raiz? | Risco/custo |
|---|---|---|---|
| **A — Retry curto (implementado nesta rodada)** | Repetir a consulta `SKIP LOCKED` 2-3x com espaçamento curto antes de desistir | Só parcialmente — cobre rajadas pequenas/moderadas, não contenção sustentada | Baixíssimo — mudança confinada a uma função, sem schema, reversível |
| **B — Separar a escolha do vendedor da criação do lead (recomendada)** | Fase 1: transação curta e independente só com `SELECT FOR UPDATE SKIP LOCKED` + `UPDATE last_assigned_at` + `COMMIT` (libera o lock em milissegundos). Fase 2: cria o lead já com o `seller_id` decidido | **Sim** — elimina a causa raiz (lock nunca mais fica preso pela criação do lead inteira) | Moderado — muda a estrutura da transação de `createLead`; precisa decidir o que fazer se a fase 2 falhar depois da fase 1 já ter "gasto" um vendedor (caso raro, mas precisa de uma decisão explícita: aceitar como fairness ligeiramente imperfeita, ou compensar) |
| **C — Advisory lock por unidade em vez de `SKIP LOCKED` nas linhas** | `pg_advisory_xact_lock(hashtext(unit))` serializando a escolha, com `FOR UPDATE` simples (sem skip) | **Não, sozinha** — se a seção protegida continua dentro da mesma transação do lead, o lock fica preso do mesmo jeito (e pior: sem skip, quem espera FILA em vez de pular) | Só faz sentido combinada com a Opção B |
| **D — Contador/sequence atômico (round robin determinístico)** | Uma linha única de "ponteiro de rodízio" por unidade, avançada atomicamente, mapeada para o vendedor da vez | **Não, sozinha** — mesma limitação da Opção C se ficar na mesma transação; e ainda seria só 1 linha para todo o tráfego da unidade (contenção pior, não melhor) | Só faz sentido combinada com a Opção B, e mesmo assim não traz vantagem clara sobre continuar usando `SKIP LOCKED` já isolado na fase 1 |

**Recomendação**: Opção B é a correção estrutural correta (satisfaz diretamente o requisito "não
pode deixar uma transação longa bloquear o sistema" — encurtar a transação é o próprio mecanismo
da correção), mantendo `SKIP LOCKED` como já está dentro da fase 1 (não precisa trocar a
primitiva de lock, seções C/D não agregam nada sozinhas). É uma mudança arquitetural real —
**não implementada nesta rodada**, conforme instrução explícita de só apresentar opções quando a
mudança for grande. Antes de implementar, decidir explicitamente o comportamento de
compensação para o caso raro de falha na fase 2 após a fase 1 já ter avançado o rodízio, e
validar contra o teste de concorrência real (seção 9-C) antes/depois da mudança para comparar
números.

## 10. Estado do alternador Dourados

Já descrito na seção 3 como o único ponto genuinamente serializado do sistema. Para volumes
realistas (mesmo 1.000-5.000 simultâneos, seção 17), um `UPDATE` de uma linha com `CASE WHEN` é
da ordem de frações de milissegundo — o Postgres serializa isso facilmente nessa escala. Só
viraria gargalo real num volume ordens de magnitude maior que qualquer cenário modelado aqui.

**Não alterado nesta rodada** (instrução explícita: só mexer no alternador havendo
vulnerabilidade real, e não foi encontrada nenhuma) — o `UPDATE` atômico de linha única
(`Backend.js/douradosAlternatorStore.js`) já garante serialização correta enquanto o Postgres
está disponível, sem qualquer mudança necessária.

**Documentado explicitamente (pedido desta rodada)**: o fallback em arquivo local
(`os.tmpdir()`) usado quando o banco está indisponível **não consegue garantir alternância
global entre diferentes Functions/instâncias da Vercel** — cada instância serverless tem seu
próprio `os.tmpdir()`, então duas instâncias diferentes respondendo simultaneamente sob
indisponibilidade do Postgres podem alternar de forma independente uma da outra, sem
coordenação entre si. **Isso é uma degradação aceitável, não um bug**: o fallback existe só para
`npm run dev` sem banco local (nunca produção, ver seção 8) e, mesmo no cenário hipotético de
banco fora do ar em produção, o pior resultado possível é a alternância Centro/Fábrica ficar
menos equilibrada durante a indisponibilidade — o cliente **ainda chega a uma loja de Dourados**
em todos os casos, nunca fica sem WhatsApp. Nenhuma correção necessária.

## 11. Idempotência

| Operação | Idempotente hoje? | Como |
|---|---|---|
| Criação de lead | **Sim** | `idempotency_key` (UNIQUE) por visitante+resumo+janela de 60s; colisão tratada explicitamente devolvendo o lead já criado |
| Webhook IMEbot | **Sim** | Dedup por `wamid` (`registerWebhookEventOnce`, `imebot_webhook_events`), auditado a fundo em rodada anterior desta sessão |
| Jobs de feedback | **Parcial** | Processados com `FOR UPDATE SKIP LOCKED` (evita processar o mesmo job 2x em paralelo), mas o lote inteiro é uma transação — uma falha no meio derruba o lote todo (não é reentrância por job, é atomicidade por lote) |
| Alternador Dourados | **Sim, por natureza** | Um `UPDATE` atômico não tem "duplo clique" possível — cada chamada sempre avança exatamente uma vez |
| Carrinho (`linkCartToLead`) | **Sim** | `markCartConverted` é idempotente por `cartCode`; chamada best-effort não bloqueia nem duplica |
| Devoluções | **Sim** | `ON CONFLICT (idempotency_key) DO UPDATE` confirmado em rodada anterior |

**Onde ainda falta (já corrigido nesta rodada)**: o ponto de atenção citado na análise anterior
(`notifyImebotOfNewLead`/`linkCartToLead` sem `waitUntil`) foi corrigido — ver seção 2. Esta
rodada também investigou e corrigiu um segundo ponto, mais sutil, na própria dedup de criação de
lead — ver 11-A abaixo.

### 11-A. Bug de borda do bucket de 60s — CONFIRMADO por teste e CORRIGIDO

`buildIdempotencyKey` (`Backend.js/salesLeadsStore.js`) usava
`Math.floor(Date.now() / dedupWindowMs)` para agrupar tentativas na mesma janela de 60s. Esse
bucket tem uma fronteira dura: duas tentativas da mesma ação (clique duplo, retry de rede),
separadas por poucos milissegundos, podem cair em buckets diferentes se acontecerem exatamente
na virada do minuto — nesse caso a chave muda e a dedup falha, criando 2 leads para o que
deveria ser 1. **Confirmado por teste** (`test/salesLeadsIdempotency.test.js`, com `Date.now`
controlado via fake timers posicionado 2ms antes e 2ms depois de uma fronteira de bucket exata —
o teste mostra as duas chamadas gerando chaves diferentes no caminho legado).

**Correção implementada**: um identificador estável (`clientRequestId`) é gerado **uma única vez
no cliente** por tentativa comercial (`lib/leadWhatsApp.js`, `crypto.randomUUID()`), enviado ao
servidor e validado lá antes de usar (`/^[A-Za-z0-9_-]{8,100}$/` — formato genérico, aceita UUID e
o fallback sem `crypto.randomUUID`; qualquer valor fora desse padrão é ignorado, nunca quebra a
criação do lead). Quando válido, a chave de dedup vira
`sha256("crid:" + visitorId + ":" + clientRequestId)` — **sem componente de tempo**, então não
tem fronteira nenhuma para cruzar: qualquer retry automático do mesmo request (timeout do
navegador, retry de proxy/plataforma) reenvia o mesmo `clientRequestId` dentro do mesmo corpo da
requisição, sempre gerando a mesma chave, não importa quanto tempo real tenha passado entre as
tentativas.

- **Clique duplo**: coberto em duas camadas agora — (1) uma guarda em memória da aba
  (`inFlightLeadAttempts` em `lib/leadWhatsApp.js`) reaproveita a mesma tentativa em andamento
  para o mesmo visitante+mensagem, evitando até abrir um segundo popup; (2) mesmo se a guarda
  falhar por algum motivo, o `clientRequestId` (gerado 1x por chamada da função) chegaria ao
  servidor em requisições distintas — a proteção real contra duplicidade continua sendo o UNIQUE
  do banco (ver abaixo), a guarda de memória só evita o efeito colateral visível (popup extra).
- **Retry do browser / timeout+retry / retry de proxy**: cobertos pelo `clientRequestId` estável
  por tentativa, sem depender de relógio.
- **UNIQUE no banco preservado**: nenhuma mudança em `sales_leads.idempotency_key` (continua
  `UNIQUE`) nem na lógica de tratar colisão (`err.code === "23505"` → busca e devolve o lead já
  criado pela transação concorrente).
- **`clientRequestId` só serve para dedup**: participa apenas do hash acima — `seller_id`,
  `status` e `lead_code` continuam decididos exclusivamente pelo servidor
  (`assignNextSeller`/`generateLeadCode`), nunca influenciados pelo valor recebido do cliente.
- **Fallback legado preservado**: chamadores que não enviam `clientRequestId` (hoje, só o webhook
  do IMEbot em `app/api/imebot/webhook/route.js`, que já tem sua própria dedup por
  conversa/telefone) continuam no esquema antigo por bucket de tempo — com a mesma limitação de
  borda documentada, não corrigida ali (fora do fluxo do navegador, onde o bug realmente importa).

**Testado**:
- `test/salesLeadsIdempotency.test.js` — 6 casos: bug confirmado no caminho legado; corrigido com
  `clientRequestId` cruzando a mesma fronteira; `clientRequestId` inválido (curto/caracteres
  fora do padrão) cai no fallback sem quebrar; `clientRequestId`s diferentes para a mesma
  visita/resumo continuam isolados (não colam tentativas realmente diferentes); mesmo
  `clientRequestId` para visitantes diferentes nunca cola dedup entre eles.
- `test/leadWhatsApp.test.js` (estendido) — `clientRequestId` presente em toda chamada a
  `createLead`; clique duplo (2 chamadas antes da 1ª terminar) só dispara 1 `createLead` e 1
  popup; depois da 1ª tentativa terminar, uma nova chamada com a mesma mensagem cria uma tentativa
  nova (retry manual do botão "tentar novamente" continua funcionando).
- **100 requisições concorrentes com a mesma `idempotency_key` → exatamente 1 lead**: escrito em
  `test/dbIntegration.concurrency.test.js` (contra Postgres real) e em
  `test/salesLeadsIdempotency.test.js` (garantia de hash estável, sem I/O) — o cenário de
  concorrência real contra banco **não foi executado** nesta sessão, mesma razão/trava da seção
  9-C (sem banco de teste disponível, sem autorização para conectar ao banco real).

### 11-B. Ciclo de vida completo do `clientRequestId` (revisão final desta rodada)

A rodada anterior corrigiu a fronteira de 60s, mas não tinha sido revisada contra o ciclo de vida
completo de retries. Nesta revisão, tracei os 5 cenários pedidos:

| Cenário | Comportamento |
|---|---|
| **A) Clique duplo imediato** | Bloqueado ANTES de gerar qualquer `clientRequestId` novo: `inFlightLeadAttempts` (`lib/leadWhatsApp.js`) devolve a MESMA promise em andamento para o mesmo `visitorId+mensagem` — só 1 chamada a `createLead`, só 1 popup. |
| **B) Fetch/retry automático da mesma operação** (timeout do navegador, retry de proxy) | Sem risco: o `clientRequestId` já está dentro do corpo da requisição (serializado antes do primeiro `fetch`), então qualquer reenvio automático do MESMO request (por baixo do JS) chega ao servidor com o MESMO valor. |
| **C) Lead criado no servidor, resposta sofreu timeout** | `lib/leads.js` não conseguiu confirmar o resultado (exceção de rede ou corpo ilegível) → devolve `{ok:false, ambiguous:true}`. |
| **D) Usuário clica de novo após o timeout de C** | **Antes desta correção: podia criar um SEGUNDO lead** (ver abaixo). Agora: como o resultado de C foi `ambiguous:true`, o `clientRequestId` da tentativa anterior continua em cache (`pendingClientRequestIds`, TTL de 3 minutos) e é REAPROVEITADO — o servidor encontra o lead já criado pela tentativa C (mesma `idempotency_key`) e devolve ele, sem duplicar. |
| **E) Orçamento novo legítimo alguns minutos depois** | Se o resultado da tentativa anterior foi DEFINITIVO (sucesso ou falha explícita do servidor - `ambiguous:false`), a chave em cache é apagada IMEDIATAMENTE - a próxima tentativa (mesmo com texto idêntico) já ganha uma chave nova, sem esperar o TTL. Se a tentativa anterior ficou ambígua e o usuário tenta de novo DEPOIS do TTL de 3 minutos, também ganha uma chave nova (tratado como desistência da tentativa anterior). |

**C+D consegue criar dois leads hoje? Não mais — corrigido nesta rodada.** Antes da correção,
`clientRequestId` era gerado a cada chamada de `openWhatsAppWithLead` (mesmo para o mesmo
conteúdo), então um timeout ambíguo seguido de um novo clique gerava uma chave diferente da
primeira tentativa — o servidor não tinha como saber que era a mesma tentativa, e criava um
segundo lead.

**Correção aplicada** (`lib/leads.js` + `lib/leadWhatsApp.js`): `createLead` (cliente) agora
distingue resultado **ambíguo** (`ambiguous:true` — exceção de rede, ou corpo de resposta
ilegível; não sabemos se o servidor processou) de resultado **definitivo** (`ambiguous:false` —
qualquer resposta com `{ok: true|false}` claramente lida, sucesso ou falha). `lib/leadWhatsApp.js`
só reaproveita o `clientRequestId` da tentativa anterior quando ela foi ambígua; qualquer resultado
definitivo limpa a chave imediatamente, garantindo que o botão "tentar novamente" (lead criado sem
vendedor) continue gerando uma tentativa nova de verdade (não reaproveitando uma chave que só
devolveria o mesmo lead sem vendedor de novo).

**Confere com o objetivo pedido**: a MESMA tentativa comercial (ambígua) mantém a mesma chave
durante retries; uma tentativa comercial NOVA (definitiva, ou ambígua além do TTL de 3 minutos)
ganha chave nova. `clientRequestId` continua usado SOMENTE para dedup (participa apenas do hash em
`buildIdempotencyKey` - nunca decide `seller_id`/`status`/`lead_code`, que continuam calculados só
pelo servidor). Nenhuma persistência permanente criada: o cache (`pendingClientRequestIds`) vive
só em memória da aba, com TTL curto, nunca gravado em `localStorage`/servidor, some ao recarregar a
página.

**Testado**: `test/leads.test.js` (novo - 5 casos cobrindo `ambiguous` true/false em cada
combinação de resposta) e `test/leadWhatsApp.test.js` (estendido - 3 casos novos: C+D reaproveita a
mesma chave; resultado definitivo gera chave nova; "tentar novamente" após lead sem vendedor
continua gerando chave nova).

## 12. Operações que deveriam sair do caminho síncrono

**Já estão fora** (confirmado por leitura, não suposição):

| Operação | Onde já está isolada |
|---|---|
| Analytics | Rota própria (`/api/analytics/track`), fetch separado do cliente, nunca dentro de `createLead` |
| IMEbot (notificação) | Agendado via `after()` após a resposta já montada (corrigido nesta rodada, seção 2) |
| Sentry | SDK gerencia sua própria fila/descarte, nunca bloqueia |
| Meta Pixel/GA4 | Scripts client-side, fora de qualquer rota de API |
| Pós-venda/handoff | Fila própria em Postgres (`sales_feedback_jobs`), processada por cron separado |

**Continua síncrono, corretamente** (não deveriam sair): validação, rate limit, resolução de
região/unidade, transação de rodízio/alternador, criação do lead, definição do vendedor —
exatamente a lista que o pedido classificou como "provavelmente deve ser síncrona".

**Conclusão desta seção**: não há operação secundária "vazando" para dentro do caminho crítico
hoje. O ajuste técnico (`after()`) já foi aplicado nesta rodada, não é mais pendência.

## 13. Proposta de fila (não implementar agora)

```
Lead confirmado → resposta rápida ao cliente
                        ↓
                    QUEUE (futura)
                        ↓
                    WORKERS
                    ├─ IMEbot (já teria o wamid como idempotência natural)
                    ├─ analytics agregado
                    ├─ notificações
                    └─ pós-venda (sales_feedback_jobs já é isso, hoje via cron)
```

| Opção | Custo | Complexidade | Confiabilidade | Retries/DLQ | Vendor lock-in | Comentário |
|---|---|---|---|---|---|---|
| **Postgres como fila** (`FOR UPDATE SKIP LOCKED` + cron) | Já pago (mesmo banco) | Baixa — já é o padrão usado em `sales_feedback_jobs` | Boa até volume moderado | Manual (já existe `attempts`/`max_attempts`) | Nenhum | **Já é o que existe hoje** — extensão natural antes de qualquer serviço novo |
| **Vercel Queues / `after()`** | Incluso no plano Vercel (se disponível) | Baixa | Depende da garantia do produto (verificar documentação atual da Vercel) | A confirmar | Médio (Vercel) | Mais próximo da stack atual, vale avaliar primeiro quando o volume justificar |
| **Upstash QStash** | Pay-per-use, barato em baixo volume | Baixa-média (HTTP-based, sem infra própria) | Boa, com retry/DLQ nativos | Sim | Baixo (é HTTP, portável) | Bom meio-termo se Postgres-como-fila não bastar |
| **Redis (BullMQ etc.)** | Serviço novo pago | Média-alta | Boa | Sim | Médio | Só se o padrão Postgres realmente não aguentar — não há evidência disso hoje |

**Recomendação**: não introduzir nada agora. `sales_feedback_jobs` já prova que o padrão
Postgres-fila funciona neste projeto. Evoluí-lo (e replicar o mesmo padrão para IMEbot/analytics
pós-lead) é o passo natural antes de qualquer serviço externo — **P2**, só quando volume real
justificar.

## 14. Graceful degradation

| Cenário | O que o usuário vê | O que o sistema faz | Venda continua? | Fallback |
|---|---|---|---|---|
| A) Postgres lento | Nada diferente (timeout de conexão em 5s) | `connectionTimeoutMillis` falha rápido em vez de pendurar | Sim, se falhar → 503 → frontend cai no WhatsApp padrão | Já implementado |
| B) Postgres indisponível | Igual acima | `createLead` devolve `{ok:false}`, nunca lança | **Sim** | Já implementado (`app/api/leads/route.js:139-142`) |
| C) Meta API indisponível | Nenhuma mudança visível (Meta ainda não está implementada nesta fase) | N/A | Sim | N/A hoje |
| D) IMEbot indisponível/desligado | Nenhuma mudança | `IMEBOT_ENABLED=false` já é o padrão; falha isolada nunca afeta lead | **Sim** | Já implementado |
| E) Analytics indisponível | Nenhuma mudança | Rota própria, cliente não espera resposta dela para navegar | **Sim** | Já implementado |
| F) Sentry indisponível | Nenhuma mudança | SDK descarta/enfileira internamente | **Sim** | Já implementado |
| G) Geolocalização indisponível | Campo "localização" some/fica vazio | Componente já trata ausência (é opt-in, clique explícito) | Sim, nunca era bloqueante | Já implementado |
| H) Fila indisponível (futura) | N/A hoje | A definir quando a fila existir | — | Documentar quando implementar: fallback = síncrono degradado, nunca perder o lead em si |

**Nenhuma lacuna real encontrada nos cenários A-G** — o princípio "nenhuma integração secundária
pode impedir o cliente de chegar ao vendedor" já é verdade hoje, por construção.

## 15. Circuit breakers futuros

Já existe (IMEbot, não duplicar). Onde faria sentido no futuro, com o mesmo padrão
(`Backend.js/rateLimiter.js` como base, sem serviço novo):

| Onde | Threshold conceitual | Fallback |
|---|---|---|
| Meta API (quando implementada) | N falhas consecutivas em janela curta | Pausa envio, mantém lead+rodízio (já funcionam sem Meta), alerta |
| Fila futura | Fila não confirma em X segundos | Processa síncrono degradado ou reagenda, nunca perde o evento |
| Geolocalização/serviço externo futuro | Timeout curto (não é crítico) | Simplesmente omite o dado, sem retry agressivo |

**Não implementar agora** — nenhuma dessas integrações existe de verdade ainda para proteger.

## 16. Read replica

**Não implementar.** Nível de tráfego em que começa a fazer sentido: quando consultas de
**leitura pesada** (relatório comercial, painel de analytics paginado) competirem de forma
mensurável com o pool usado pelo caminho crítico de escrita — hoje o pool é `max=3` por instância
e o caminho de leitura pesada (`analyticsStore.js`, `commercialReportStore.js`) já é
administrativo/autenticado, não público, então o volume que bate nele é ordens de magnitude menor
que o de leads.

- **Candidatos naturais a replica no futuro**: `analyticsStore.js` (listagem paginada),
  `commercialReportStore.js` (relatório agregado) — leitura pura, tolera alguns segundos de
  atraso de replicação.
- **Nunca devem usar replica**: `sales_leads`/`sales_sellers` (rodízio precisa ler o estado mais
  recente para não repetir vendedor), `rate_limit_counters` (decisão de bloquear precisa ser
  consistente), `dourados_alternator_state` (alternância exige consistência forte),
  `admin_sessions` (autenticação nunca pode ler estado atrasado).

## 17. Observabilidade necessária

Já parcialmente implementada nesta mesma sessão (`Backend.js/logger.js` com categorias
SECURITY/CIRCUIT_BREAKER, `rate_limit_triggered`, `database_unavailable`, `imebot_paused`,
`health_degraded`, `job_failed` — ver `RELIABILITY.md`). O que falta, classificado por
severidade:

| Categoria | Métrica | Nível |
|---|---|---|
| HTTP | requests/s, p50/p95/p99, taxa 4xx/5xx | WARNING se p95 > ~1s sustentado, CRITICAL se 5xx > 1% |
| Database | conexões ativas vs `POOL_MAX`, latência de query, slow queries, locks | WARNING perto do limite do pool, CRITICAL em `database_unavailable` (já logado) |
| Comercial | latência de criação de lead, leads/min, falhas de criação, taxa de fallback pro WhatsApp padrão, distribuição do rodízio | CRITICAL se taxa de fallback subir muito (sinal de banco degradado) |
| IMEbot | mensagens, bloqueios (`imebot_abuse_blocked`), `imebot_paused` (já logado) | WARNING em paused, INFO em bloqueio pontual |
| Fila futura | profundidade, taxa de processamento, idade da mensagem mais antiga, retries, dead letters | A definir quando existir |

Já existe destino (Sentry preparado, `MONITORING_ENABLED`/Better Stack agora conectado a um
status real no painel, ver `RELIABILITY.md`) — falta só ligar esses logs a alertas de verdade no
provedor externo, que é configuração de conta, não código.

## 18. Plano CI/CD (não implementar mudança nova agora — o pipeline básico já existe)

Já implementado nesta sessão: `.github/workflows/ci.yml` (lint+test+build por projeto, sem
secrets, sem deploy). O que falta para chegar no fluxo completo pedido — **só configuração no
GitHub, não código**:

```
push/PR → CI (já existe) → Preview (Vercel, já automático)
   → homologação manual → aprovação → merge em main → Production (Vercel)
```

Falta ativar (dashboard do GitHub, não código): **branch protection** exigindo os checks
`imesul-vendas (lint, test, build)` e `imesul (lint, build)` como obrigatórios antes de merge em
`main`, bloqueando push direto. **P1** — configuração de plataforma, zero código novo.

## 19. Plano de load test (não executar agora)

**Nunca contra Production.** Ambiente: Preview + banco de homologação + Meta/IMEbot mockados
(nunca credenciais reais — já é regra do projeto).

| Cenário | O que testar |
|---|---|
| A) Navegação pura | Home, catálogo — deve ser quase 100% CDN, sem tocar banco |
| B) Catálogo | Páginas de produto (SSG/estático) |
| C) Busca | Se existir busca server-side, medir latência |
| D) Carrinho | localStorage — sem carga real de servidor, mas medir `cart/track` |
| E) Criação de lead | O cenário que importa de verdade — mede o caminho crítico inteiro |
| F) Mistura realista | 80-90% navegação/catálogo, 5-10% carrinho, 1-5% lead — proporção real de qualquer e-commerce |

Métricas: RPS, p50/p95/p99, taxa de erro, conexões de banco em uso, latência de query, locks,
throughput do rate limiter. Ferramenta: **k6** (scriptável em JS, se encaixa bem no stack;
suporta cenários com pico e sustentado) como primeira opção; Artillery como alternativa
equivalente. **Não executado nesta fase.**

## 20. Modelo de capacidade (tráfego)

230.000 visitas/mês **não é concorrência** — é volume acumulado.

```
230.000 / 30 dias        ≈ 7.667 visitas/dia
7.667 / 24h               ≈ 320 visitas/hora (média)
320 / 3600s                ≈ 0,09 visitas/segundo (média)
```

**A média não importa — o pico importa.** Tráfego de site institucional/comercial é
extremamente não-uniforme (horário comercial, dias de semana, campanhas). Multiplicadores sobre
a média/hora (320) só como referência de ordem de grandeza, não previsão:

| Multiplicador | Visitas/hora equivalente | Contexto |
|---|---|---|
| 10x | ~3.200/h (~0,9/s) | Horário de pico normal de um dia comum |
| 25x | ~8.000/h (~2,2/s) | Dia forte / início de semana |
| 50x | ~16.000/h (~4,4/s) | Campanha ativa |
| 100x | ~32.000/h (~8,9/s) | Pico excepcional |

**Cenário de campanha (concorrência real, não média)**:

| Cenário | Requests/segundo equivalente (aprox.) |
|---|---|
| 1.000 pessoas em 1 minuto | ~17 req/s sustentado no minuto |
| 5.000 pessoas em 5 minutos | ~17 req/s sustentado (mesma ordem, mais gente) |
| 10.000 pessoas em 10 minutos | ~17 req/s sustentado |

Note que os três cenários de campanha convergem para uma faixa parecida de req/s sustentado —
isso é o número que realmente importa para dimensionar (não o total de pessoas). Mesmo o cenário
mais agressivo (10.000 em 10min) fica na casa de **dezenas de requests/segundo**, muito abaixo do
que o rate limiter global já aceita por IP individualmente (10 req/10s) — o volume agregado de
muitos IPs diferentes é o que precisa de capacidade de banco/functions, não de rate limit mais
permissivo.

**Isso não afirma que vai acontecer — é planejamento de capacidade**, exatamente como pedido.

## 21. Arquitetura alvo (adaptada ao código real, nada especulativo além do já proposto)

```
CLIENTES
    ↓
VERCEL EDGE / CDN            ← já existe (assets estáticos)
    ↓
CACHE (implícito: catálogo estático no bundle)   ← já existe, sem trabalho extra
    ↓
FUNCTIONS (Route Handlers)
    ↓
RATE LIMIT / BACKPRESSURE (Backend.js/rateLimiter.js, Postgres distribuído)  ← já existe
    ↓
CAMINHO CRÍTICO (checkOrigin → rate limit → withTransaction → rodízio/alternador → INSERT)
    ↓
POOLER (confirmar Transaction Pooler no Supabase — P0, não é código)
    ↓
POSTGRES PRIMARY

                    ┌─────────────────────────────┐
LEAD CONFIRMADO →   │  after() (Next.js) - já      │  futuro: QUEUE (Postgres-fila,
                    │  corrigido nesta rodada      │  extensão de sales_feedback_jobs)
                    └─────────────────────────────┘
                              ↓ (futuro)
                          WORKERS
                          ├─ IMEbot
                          ├─ analytics agregado
                          ├─ notificações
                          └─ pós-venda

                                                    (futuro, só quando leitura pesada
                                                     justificar)
                                              READ REPLICA
                                                    ↓
                                    dashboard / relatório comercial / analytics
```

## 22. Prioridades

**P0 — risco antes de Production**
- Confirmar no dashboard do Supabase/Vercel se `DATABASE_URL` usa o **Transaction Pooler** (não a
  conexão direta) — checklist objetiva pronta na seção 5-A, ainda não conferida manualmente.

**P1 — implementado nesta rodada**
- ~~Trocar `linkCartToLead`/`notifyImebotOfNewLead` (sem `await`) por `after()` do Next.js~~ —
  **feito** (seção 2).
- Ativar branch protection no GitHub exigindo os checks do CI já existente antes de merge em
  `main` (seção 18) — configuração de plataforma, sem código novo, ainda pendente (fora do
  escopo de código desta rodada).

**P1 — novo, desta rodada**
- Rodar `test/dbIntegration.concurrency.test.js` contra um banco de homologação real, quando
  autorizado, para medir os números reais de contenção do rodízio e confirmar (ou não) a
  necessidade da correção arquitetural da seção 9-D (Opção B).
- Decidir e implementar a Opção B da seção 9-D (separar escolha de vendedor da criação do lead)
  se o teste acima confirmar perda relevante de rodízio sob concorrência real.

**P2 — preparar quando crescimento aparecer**
- Estender o padrão Postgres-fila (`sales_feedback_jobs`) para cobrir a notificação do IMEbot
  pós-lead, em vez de só corrigir o `await` pontual (seção 13).
- Trocar o `SELECT *` de `analyticsStore.js` (painel admin) por colunas explícitas (seção 4/8 de
  `RELIABILITY.md`).
- Rodar o load test (k6) descrito na seção 19 num ambiente de homologação real, com os cenários
  A-F, antes de qualquer campanha grande.

**P3 — infraestrutura futura, só com evidência real de necessidade**
- Read replica (seção 16) — só quando relatório/analytics competir de fato com o pool de escrita.
- Fila dedicada (Upstash/Redis) — só se o padrão Postgres-fila (já em uso) comprovadamente não
  bastar.
- Índice `unit` em `sales_sellers` — só se a tabela crescer a ponto de importar (hoje é uma
  tabela de vendedores, não de eventos).

## Conclusão objetiva

**O sistema atual está preparado para qual nível de carga?** Sem teste de carga real, esta
pergunta não pode ser respondida com um número. O que a análise estática (código + testes
unitários/mockados, sem infraestrutura real) permite afirmar é que o caminho crítico da venda é
**arquiteturalmente compatível** com os cenários modelados na seção 20 (dezenas de req/s
sustentado, picos de centenas/milhares de pessoas em poucos minutos): transação atômica,
idempotência por `clientRequestId` (sem a fronteira de 60s corrigida nesta rodada), retry curto
no rodízio, rate limit distribuído, zero acoplamento síncrono a integrações secundárias,
fail-closed onde precisa e fail-open (com fallback pro WhatsApp padrão) onde a venda não pode
parar. **Isso não é uma declaração de capacidade** ("o sistema aguenta X req/s") — é uma
declaração de compatibilidade arquitetural. A capacidade real depende de fatores que só um teste
de carga de verdade mede: modo do pooler e plano do Postgres (seção 5-A, ainda não confirmado),
latência real de rede até o banco, número de vendedores ativos cadastrados de fato, concorrência
real observada, limites do plano Vercel, e o comportamento medido do rodízio sob carga real
(seção 9-C, teste escrito e não executado). Nenhum desses cinco fatores é decidido pelo código.

**O que precisamos mudar antes de colocar a nova IMESUL oficialmente em operação?**
1. Confirmar a checklist do pooler (P0, seção 5-A) — risco de configuração, não de código.
2. Rodar o teste de concorrência real do rodízio (seção 9-C) contra homologação, para decidir se
   a Opção B (seção 9-D) é necessária antes ou depois de operação normal.
3. Rodar o teste de carga completo (k6, seção 19) antes de qualquer campanha de tráfego elevado —
   continua sendo a única forma de transformar "arquiteturalmente compatível" em um número real
   de capacidade.

Os dois ajustes de código pequenos e de baixo risco identificados na análise anterior (`after()`
nas tarefas pós-resposta, dedup por `clientRequestId`) já foram implementados e testados nesta
rodada — não são mais pendência.
