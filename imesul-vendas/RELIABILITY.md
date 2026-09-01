<!-- title: Confiabilidade e infraestrutura - IMESUL-SITE -->

# Confiabilidade e infraestrutura

Documento de auditoria/planejamento desta rodada de hardening de infraestrutura. **Nada aqui foi
executado contra produção** - é a mesma regra dos outros documentos deste tipo no repositório
(`POSTGRES_ROLE_PROPOSAL.md`).

Arquitetura permanece: `GitHub → Vercel → Next.js → PostgreSQL/Supabase → IMEbot/Meta/Analytics`.
Nada de AWS (EC2/ECS/RDS/ALB/CloudFront/Kubernetes) nem Redis/Kafka/SQS foi adicionado - a Vercel
já cobre compute serverless, edge, distribuição, scaling e Preview Deployments.

## 1. O que a Vercel já substitui da arquitetura "clássica" de nuvem

| Peça clássica (AWS-style) | Equivalente já coberto pela Vercel hoje |
|---|---|
| Load Balancer / Auto Scaling | Scaling automático por invocação serverless, sem configuração |
| CDN (CloudFront) | Edge Network da própria Vercel para assets estáticos |
| Blue/green ou canary deploy manual | Preview Deployment por commit/branch + alias de produção |
| Health check de infraestrutura (ALB target group) | Não existe um equivalente direto - é por isso que `/api/health` e o painel admin importam (seção 3) |
| Log aggregation (CloudWatch) | Logs de função da Vercel + Sentry (erros) - Better Stack como destino externo opcional (`MONITORING_ENABLED`, ver seção 9) |
| Container orchestration | Não se aplica - cada rota é uma function serverless isolada por padrão |

## 2. Fluxo recomendado até Production

```
feature/dev → preview/mobile-ajustes → CI (.github/workflows/ci.yml) → Vercel Preview
→ homologação manual → aprovação → merge/promote → Production
```

**Auditado nesta rodada**: não existe `vercel.json` versionado (confirmado em auditoria anterior)
e não há branch protection/status checks configurados no GitHub neste momento - qualquer push
direto a `main` hoje dispara Preview na Vercel sem nenhum gate automático de CI (o workflow novo
desta rodada só passa a existir a partir do commit em que for aplicado; antes disso, não havia CI
nenhum). Nada foi alterado nas configurações do GitHub/Vercel nesta rodada - só a auditoria.

**Checks que recomendo tornar obrigatórios no futuro** (Settings → Branches → Branch protection
rule, no GitHub, quando você decidir aplicar):
- `imesul-vendas (lint, test, build)` - job do `.github/workflows/ci.yml` desta rodada.
- `imesul-institucional (lint, build)` - idem.
- Exigir PR (sem push direto) para `main` antes de promover para Production.
- Exigir branch atualizada com a base antes do merge.

Não configurei nada disso agora - só listo o que os nomes dos jobs seriam, para quando você for
ativar a proteção pelo dashboard do GitHub.

## 3. Health checks - público vs interno

| Rota | Uso | Exposição |
|---|---|---|
| `GET /api/health` (2 sites) | Liveness público | `{status:"ok", service:"..."}` - sem detalhe interno, confirmado por leitura de código |
| `GET /api/health/database` (vendas) | Diagnóstico focado, protegido por `x-monitoring-key` (`timingSafeEqual`) | `{status, database}` - nunca a connection string |
| `GET /api/health/imebot` (vendas) | Diagnóstico focado | Só `{status, imebot: "enabled"/"disabled"}` |
| `GET /api/admin/monitoring/status` (vendas) | Painel interno completo, exige sessão admin (cookie) | Agrega os serviços abaixo, nunca segredo/stack trace |

Os três primeiros já satisfaziam a separação público/interno pedida - não precisaram de mudança.
`/api/admin/monitoring/status` ganhou nesta rodada:
- Estado `degraded` para o banco quando a query `SELECT 1` responde mas acima de 500ms (antes só
  existia `online`/`offline` - esperava o timeout de 1500ms inteiro para dizer "algo errado").
- Estado `paused` para o IMEbot, refletindo o circuit breaker de custo já existente
  (`Backend.js/imebotAbuseGuard.js`) em vez de só `online`/`disabled`.
- Duas linhas novas: **Rate Limiter** (reflete o mesmo resultado da checagem de banco - rate
  limit já é Postgres-backed, então uma segunda conexão só para isso seria checagem redundante,
  contrariando "não fazer operação pesada em toda requisição") e **Monitoramento Externo**
  (liga o valor de `MONITORING_ENABLED`, que antes era uma flag morta sem nenhum efeito - agora
  alimenta esse status).

Nenhuma das checagens faz operação pesada por request: `SELECT 1` com timeout de 1500ms (já
existia), sem scan de tabela nem agregação.

## 4. Graceful degradation - auditado

| Dependência | Comportamento hoje | Ação |
|---|---|---|
| Analytics (`/api/analytics/track`) | Rota própria, chamada via `fetch` fire-and-forget do cliente (`lib/localAnalytics.js`) - nunca bloqueia navegação/orçamento | Confirmado, já correto |
| Sentry | SDK gerencia sua própria falha (fila/descarte interno); `tracesSampleRate`/replay em 0 | Confirmado, já correto |
| Monitoramento (`/api/admin/monitoring/status`) | Endpoint isolado, só o painel admin depende dele | Confirmado, já correto |
| IMEbot | Atrás de `IMEBOT_ENABLED` + tratamento de erro em toda a rota do webhook (nunca derruba lead/rodízio) | Confirmado, já correto |
| Meta API | Envio real ainda não implementado nesta fase (endpoint de download devolve `501` documentado, não finge sucesso) - não há chamada bloqueante a auditar ainda | Documentado - quando for implementado, é o ponto de aplicar timeout/circuit breaker (seção 6/7) |
| Tracking GA4/Meta Pixel | Scripts client-side (`next/script`), carregam só com consentimento+flag; falha de carregamento não afeta o fluxo comercial | Confirmado, já correto |
| Banco em função não essencial | `/api/leads` (crítico) **não depende de analytics/Sentry/monitoramento** - só de `checkGlobalApiRateLimit`/`checkRateLimitLayers` (intencionalmente fail-closed, é segurança, não disponibilidade) e `createLead` | Confirmado por leitura direta de `app/api/leads/route.js` |

**Nada precisou de implementação nova aqui** - a arquitetura já isola bem os componentes
secundários. O único ponto que mudou de comportamento nesta rodada foi o health check do banco
(`degraded` antes de `offline`), que é justamente uma forma de detectar degradação sem esperar
falha total.

## 5. Classificação de dependências

| Categoria | Itens | Como a aplicação reage hoje |
|---|---|---|
| **CRÍTICO** | Criação/roteamento de lead (`/api/leads`, rodízio de vendedor), sessão admin (login/cookie) | Fail-closed: erro real vira 5xx/401 explícito, nunca finge sucesso |
| **IMPORTANTE** | IMEbot (Campo Grande), PDF Bridge, jobs de pós-venda/handoff | Atrás de feature flag (`IMEBOT_ENABLED`), falha isolada nunca derruba lead/rodízio; jobs re-tentam no próximo ciclo do cron |
| **NÃO CRÍTICO** | Analytics interno, tracking GA4/Meta Pixel, Sentry, monitoramento externo (Better Stack) | Fire-and-forget client-side ou try/catch server-side que nunca propaga para a resposta principal |

Não criei nenhuma classe/framework para isso - é só esta tabela + o tratamento que já existia
(try/catch, feature flags, endpoints isolados) em cada camada.

## 6. Circuit breakers - auditoria

Já existe (não duplicado): proteção de custo/abuso do IMEbot (`Backend.js/imebotAbuseGuard.js`) -
separação abuse guard / orçamento pago, circuit breaker real na quota global hora/dia.

**Auditoria de outras integrações externas**: hoje a aplicação **não faz nenhuma chamada HTTP
de saída repetitiva/automatizada** além dos health checks internos institucional↔vendas (que já
têm timeout via `AbortController`, ver seção 7) e do `fetch` do painel admin. A integração real
com a Meta (envio de mensagem, download de mídia) ainda não está implementada - o endpoint
`/api/imebot/bridge/download/[fileId]` devolve `501` documentado em vez de tentar uma chamada
real sem credenciais.

**Não implementei circuit breaker novo** porque não há chamada externa repetitiva hoje para
proteger. **Quando a Meta for implementada de verdade**, esse é o ponto candidato: mesmo padrão
já usado pelo IMEbot (falha repetida → pausa temporária → fallback para atendimento humano →
alerta → tenta de novo após cooldown) - reaproveitando `Backend.js/rateLimiter.js`, não um
sistema novo.

## 7. Timeouts - auditoria

| Chamada externa | Timeout hoje |
|---|---|
| `/api/health/database` (query `SELECT 1`) | 1500ms (`Promise.race`) - já existia |
| `/api/admin/monitoring/status` → `checkHttpHealth`/`checkDatabase` | 1500ms via `AbortController` - já existia |
| Download de mídia da Meta (PDF Bridge) | Não se aplica ainda - chamada não implementada (ver seção 6) |

Nenhuma chamada HTTP externa importante fica esperando indefinidamente hoje - as únicas que
existem já tinham timeout antes desta rodada. Não havia timeout "faltando" para adicionar.

## 8. Retries - auditoria

Não existe nenhum retry automático de chamada HTTP hoje (nem precisava - não há chamada HTTP
externa repetitiva em produção, ver seção 6). O que já existe e **não foi duplicado**:

- **Jobs de feedback/pós-venda** (`sales_feedback_jobs`): colunas `attempts`/`max_attempts`
  próprias, com `run_after` escalonando o reagendamento - já é um retry com limite e atraso,
  administrado pelo próprio cron (`/api/imebot/jobs/process`).
- **Geração de código de lead** (`Backend.js/salesLeadsStore.js`): retry local bounded
  (`maxLeadCodeAttempts`) em caso de colisão de código único - não é chamada externa, é geração
  local com nova tentativa em caso de constraint violation.

Quando a Meta for implementada, a regra a seguir (documentada, não implementada): retry só em
timeout/429/5xx transitório, nunca em 4xx permanente; limite baixo (2-3 tentativas), backoff com
jitter, nunca loop infinito - mesmo espírito do `IMEBOT_HANDOFF_MAX_RETRIES` que já existe.

## 9. Observabilidade

`Backend.js/logger.js` já existia (info/warn/error, sempre sanitizado via
`lib/monitoring/sanitize.js`). Nesta rodada ganhou duas categorias adicionais - `logger.security`
e `logger.circuitBreaker` - que são os mesmos `console.warn` de sempre, só com um campo
`category` a mais no JSON para dar pra filtrar/alertar no provedor de log (Better Stack) sem
criar um sistema de observabilidade novo.

**Eventos novos instrumentados** (nenhum log com senha/token/cookie/`DATABASE_URL`/payload
completo - só `err.message` ou dado já público):

| Evento | Onde | Categoria |
|---|---|---|
| `rate_limit_triggered` | `Backend.js/rateLimiter.js#checkGlobalApiRateLimit` (camada global, não duplica o log próprio do IMEbot abuse guard) | SECURITY |
| `database_unavailable` | `Backend.js/db.js` (handler `pool.on("error")`, antes era só `console.error`) | error |
| `imebot_paused` | `Backend.js/imebotAbuseGuard.js#reservePaidActionBudget` (evento novo, adicional ao `imebot_cost_guard_blocked` que já existia - não renomeei o existente pra não quebrar os testes que já checam esse nome) | CIRCUIT_BREAKER |
| `health_degraded` | `app/api/admin/monitoring/status/route.js` (log agregado, um por checagem, não um por serviço) | warn |
| `job_failed` | `app/api/imebot/jobs/process/route.js` (catch do lote de jobs) | error |

`external_service_failure` e `imebot_abuse_blocked` já são cobertos conceitualmente pelo
`imebot_cost_guard_blocked` existente - não criei um evento paralelo com nome diferente para a
mesma coisa.

## 10. Request/Correlation ID

Adicionado `getRequestId(request)` em `Backend.js/requestGuards.js`: usa `x-vercel-id` (a
própria Vercel injeta esse header em toda invocação) quando disponível, gera `crypto.randomUUID()`
como fallback (dev local). Nunca deriva de dado pessoal.

**Adoção**: fiz a implementação de referência em `/api/admin/monitoring/status` (devolve
`X-Request-ID` no header da resposta e inclui o mesmo valor no log `health_degraded`). Não apliquei
nas outras ~20 rotas — isso exigiria tocar cada uma delas, o que você pediu para evitar ("não
fazer se isso exigir mudança grande"). A função já está pronta para qualquer rota adotar
incrementalmente: `noStoreJson(body, { headers: { "X-Request-ID": getRequestId(request) } })`.

## 11. Banco - escalabilidade (auditoria, nada implementado)

- **Connection pool**: `DATABASE_POOL_MAX` (default 3) por instância serverless - adequado ao
  padrão "muitas instâncias pequenas" da Vercel, não precisa mudar agora.
- **Índices**: 39 `CREATE INDEX` no total (7 em `001`, 5 em `002`, 1 em `003`, 26 em `004`,
  nenhum novo necessário em `005` - tabela de uma linha só). Cobertura já é boa nas tabelas mais
  usadas em `WHERE`/`JOIN`.
- **`SELECT *`**: um caso encontrado, em `Backend.js/analyticsStore.js` (listagem paginada de
  eventos) - já tem `LIMIT`/`OFFSET`, então o impacto é limitado ao tamanho da página, não da
  tabela inteira. Candidato a trocar por colunas explícitas no futuro, não urgente.
  Não alterei agora, por não ser uma vulnerabilidade nem um problema de escala real hoje.
- **N+1 candidato**: `Backend.js/feedbackStore.js#processDueFeedbackJobs` roda até 20 jobs por
  lote, cada um com 1-3 `UPDATE`s individuais dentro da MESMA transação (não é N+1 de conexões
  separadas, mas é N+1 de round-trips). Só vira um problema real se o volume de jobs crescer
  muito - documentado, não otimizado agora.
- **Transações/locks**: `FOR UPDATE SKIP LOCKED` já usado corretamente em rodízio de vendedor e
  fila de jobs - evita lock convoy entre instâncias concorrentes.

**Read replica**: candidatos naturais, se algum dia for implementada -
`Backend.js/analyticsStore.js` (listagem/paginação), `Backend.js/commercialReportStore.js`
(relatório comercial agregado) e o painel de analytics do admin de forma geral. Escrita
(leads, sessões, IMEbot, rodízio) continuaria sempre no primary. **Não implementado** - só
identificação de onde encaixaria no futuro, conforme pedido.

## 12. Filas/workers - necessidade futura

`sales_feedback_jobs` já é uma fila rudimentar sobre Postgres (`FOR UPDATE SKIP LOCKED` +
`run_after` + `attempts`) - funciona bem no volume atual (cron chamando
`/api/imebot/jobs/process` periodicamente). Isso deixaria de ser adequado quando:

- O volume de jobs por execução do cron ultrapassar a janela de tempo da function serverless
  (hoje processa até 20 por chamada, num `LIMIT` fixo).
- Surgir processamento pesado de verdade (ex.: geração de PDF, transcrição, chamada de IA) em
  vez de só atualizar linhas e enviar texto.
- Precisar de prioridade/retry mais sofisticado do que "tentar nas próximas N execuções do cron".

Quando isso acontecer, o candidato é Vercel Queue (mais próximo da arquitetura atual, sem sair da
Vercel) antes de Redis/SQS. **Não implementado agora** - nenhuma dessas condições existe hoje.

## 13. Prevenção de cascata

Cenário do pedido (banco lento → API acumula → chamadas externas aumentam → funções lentas →
usuário tenta de novo → carga aumenta) - o que já protege isso hoje:

- **Timeout**: 1500ms nas checagens de banco do painel (evita function pendurada esperando o
  Postgres).
- **Rate limit**: camada global (10 req/10s por IP) + camada específica por rota, distribuído via
  Postgres - já existia, agora com log (`rate_limit_triggered`, seção 9) para você ver quando
  está acontecendo.
- **Pool pequeno por instância** (`DATABASE_POOL_MAX=3`): limita quantas conexões uma única
  instância trava esperando, mesmo sob carga.
- **Idempotência**: dedup de lead (60s), dedup de webhook por `wamid`, UPSERT idempotente em
  devoluções (`ON CONFLICT DO UPDATE` no idempotency_key) - um retry do cliente não duplica
  efeito colateral.
- **Fallback sem banco**: `isDatabaseConfigured()` gate em `analyticsStore`/`cartStore`/
  `adminSecurity` - se o Postgres cair, funções não essenciais degradam para
  memória/no-op em vez dederrubar a instância inteira.

Nenhuma lacuna simples e óbvia foi encontrada para preencher agora - as proteções que já existiam
cobrem o cenário descrito. O health check `degraded` (seção 3) é o único acréscimo real desta
rodada aqui: dá visibilidade ANTES do cenário de cascata começar, não depois.

## 14. Status no painel

Ver seção 3 - `MonitoringPanel.jsx` não foi redesenhado; os estados `online/degraded/offline/
disabled/paused` (mapeados para ONLINE/DEGRADADO/OFFLINE/DESATIVADO/PAUSED na UI) já existiam em
`statusStyles`/`statusLabels` antes desta rodada - só precisavam de dados reais alimentando-os
(banco "degraded" por latência, IMEbot "paused" pelo circuit breaker, mais as linhas Rate Limiter
e Monitoramento Externo). Nenhum segredo é exibido - mesmo padrão de antes (nome do serviço,
status, latência, timestamp).

## 15. Readiness vs liveness

Não copiei o padrão Kubernetes. Na arquitetura serverless da Vercel, cada invocação de function
JÁ é a própria prova de liveness (se a function responde, está viva - não existe um processo de
longa duração para monitorar separadamente). Mapeando para o que já existe:

- **Liveness** → `GET /api/health` (público, já existe, já minimalista).
- **Readiness** (dependências críticas disponíveis para uma operação específica) →
  `GET /api/health/database` (protegido) já cobre isso para o caso mais relevante (banco).

**Não criei endpoints novos de readiness/liveness** - os dois já existem e já cobrem o uso
prático que essa distinção teria aqui. Um probe estilo Kubernetes (verificação periódica externa
decidindo se reinicia/tira de rotação) não se aplica: a Vercel não expõe esse controle para
functions serverless.

## O que fica de fora desta rodada (nunca implementar sem decisão explícita)

EC2, ECS, RDS, Application Load Balancer, AWS Auto Scaling, CloudFront, Kubernetes, Redis, Kafka,
SQS, read replica, multi-region, microservices - nenhum tem necessidade real hoje, todos citados
só como possível evolução futura nas seções acima quando aplicável.
