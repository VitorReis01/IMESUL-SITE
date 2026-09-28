# 7. Checklist de variáveis de ambiente (nomes apenas — nenhum valor)

Preencher em `/etc/imesul/imesul-vendas.env` e `/etc/imesul/imesul-institucional.env` na VPS
(`chmod 600`, dono `root:imesul`, nunca versionados). Formato: `NOME=valor`, uma por linha, sem
aspas a menos que o valor tenha espaço.

## Regra para o `DATABASE_URL` numa VPS (persistente, não-serverless)

O `.env.example` do `imesul-vendas` recomenda o **pooler em modo "Transaction" (porta 6543)** do
Supabase, pensando em ambiente serverless (Vercel, muitas instâncias curtas). **Numa VPS com um único
processo Node persistente (como já validamos no cPanel atual), o modo certo é o contrário: pooler em
modo "Session" (porta 5432)** — um processo de vida longa se beneficia de conexões mantidas, e é
esse o modo já usado com sucesso na produção cPanel de hoje. Ao pegar a connection string no painel
do Supabase, escolher **Connect → Session pooler**, não Transaction.

## `imesul-vendas` (43 variáveis em `.env.example`)

| Variável | Obrigatória? | Nota |
|---|---|---|
| `DATABASE_URL` | **sim** | Session pooler do Supabase (ver acima). Sem ela, o app cai no fallback não-persistente — nunca válido em produção. |
| `DATABASE_POOL_MAX` | opcional | manter baixo (2–3) — VPS com pouca RAM, um só processo. |
| `DATABASE_MIGRATION_URL` | não (nesta VPS) | só usada por `scripts/migrate-db.mjs`; migrations não rodam como parte do deploy da VPS. |
| `NEXT_PUBLIC_INSTITUTIONAL_SITE_URL` | **sim** | build falha sem ela em produção (`lib/siteUrl.js`). |
| `SALES_SITE_URL` | **sim** | idem. |
| `SITE_ENV` | **sim** para indexar | `production` libera indexação; qualquer outro valor ou ausente = noindex (postura segura por padrão). |
| `NEXT_PUBLIC_NOINDEX` | opcional | reforço explícito de noindex em homologação. |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | **sim** | DDI+DDD+número, sem pontuação. |
| `ADMIN_DEMO_USER` | **sim** (login admin) | comparação em tempo constante. |
| `ADMIN_PASSWORD_HASH` | **sim em produção** | gerar com `node scripts/generate-admin-password-hash.mjs` — nunca colar a senha em texto puro em produção. |
| `ADMIN_DEMO_PASSWORD` | não em produção | só aceito fora de produção e só se `ADMIN_PASSWORD_HASH` estiver ausente. |
| `ANALYTICS_SECURITY_KEY` | recomendada | criptografa IP em investigação de segurança; reusar a mesma chave já em uso hoje (não gerar uma nova sem necessidade — perde histórico). |
| `NEXT_PUBLIC_INSTITUTIONAL_URL` | opcional | alternativa a `NEXT_PUBLIC_INSTITUTIONAL_SITE_URL` para CORS de `/api/leads`. |
| `CART_ABANDONMENT_THRESHOLD_MINUTES` | opcional | default 120. |
| `NEXT_PUBLIC_TRACKING_ENABLED` | opcional | `false` mantém GA4/Meta desligados mesmo com IDs presentes. |
| `NEXT_PUBLIC_GA_CAMPO_GRANDE_ID` | opcional | reusar valor já em produção. |
| `NEXT_PUBLIC_GA_DOURADOS_ID` | opcional | idem. |
| `NEXT_PUBLIC_META_PIXEL_ID` | opcional | idem. |
| `NEXT_PUBLIC_META_PIXEL_ID_REMARKETING` | opcional | idem. |
| `MONITORING_ENABLED` | opcional | flag hoje não conectada a nada real no código (ver `CLAUDE.md`); não depender dela. |
| `MONITORING_HEALTH_SECRET` | recomendada | protege `/api/health/database`; reusar o valor atual se possível. |
| `CONSENT_SYNC_SECRET` | **sim** | **precisa ser idêntico** ao valor usado em `imesul-institucional` — é o segredo HMAC compartilhado do consent-sync. |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_AUTH_TOKEN` | opcionais | `SENTRY_ENVIRONMENT` deve refletir a VPS nova (ex.: `production` só depois da virada; usar algo como `staging-vps` durante os testes pré-DNS). |
| `IMEBOT_ENABLED` | opcional | manter `false` a menos que decida ativar nesta migração. |
| `META_WHATSAPP_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID`, `META_WHATSAPP_VERIFY_TOKEN`, `META_APP_SECRET` | **nunca preencher com valor de teste/inventado** | deixar vazio até existir credencial real (regra do projeto). |
| `IMEBOT_PUBLIC_BASE_URL` | condicional | só se IMEbot ativo. |
| `IMEBOT_CRON_SECRET` | condicional | idem; hoje sem `vercel.json`/cron versionado — na VPS isso vira um **cron do systemd (timer) ou `cron` do sistema**, a decidir separadamente. |
| `IMEBOT_HANDOFF_CHECK_DELAY_MINUTES`, `IMEBOT_HANDOFF_MAX_RETRIES`, `IMEBOT_POST_SALE_DELAY_MINUTES` | condicionais | operação do IMEbot. |
| `IMEBOT_MIN_RESPONSE_INTERVAL_SECONDS`, `IMEBOT_MAX_MESSAGES_PER_MINUTE`, `IMEBOT_MAX_MESSAGES_PER_5_MINUTES`, `IMEBOT_BLOCK_DURATION_SECONDS`, `IMEBOT_MAX_RESPONSES_PER_HOUR`, `IMEBOT_MAX_RESPONSES_PER_DAY`, `IMEBOT_DAILY_COST_WARNING`, `IMEBOT_DAILY_COST_HARD_STOP` | condicionais | proteção de custo/abuso do IMEbot. |
| `IMEBOT_BRIDGE_SECRET` | condicional | PDF Bridge do IMEbot. |

## `imesul` institucional (15 variáveis em `.env.example`)

| Variável | Obrigatória? | Nota |
|---|---|---|
| `NEXT_PUBLIC_SALES_URL` | **sim** | build falha sem ela em produção (CSP `connect-src` depende dela). |
| `SITE_URL` | **sim** | canônico/sitemap. |
| `SITE_LASTMOD` | opcional | data de última modificação do sitemap. |
| `SITE_ENV` | **sim** para indexar | mesma regra do vendas. |
| `NEXT_PUBLIC_NOINDEX` | opcional | idem. |
| `NEXT_PUBLIC_TRACKING_ENABLED` | opcional | idem. |
| `NEXT_PUBLIC_GA_CAMPO_GRANDE_ID`, `NEXT_PUBLIC_GA_DOURADOS_ID` | opcionais | `NEXT_PUBLIC_GA_DOURADOS_ID` hoje é código morto (rota `/dourados` não existe no institucional) — não é bug desta migração. |
| `NEXT_PUBLIC_META_PIXEL_ID` | opcional | | 
| `MONITORING_ENABLED` | opcional | mesma flag morta do vendas. |
| `MONITORING_HEALTH_SECRET` | recomendada | | 
| `CONSENT_SYNC_SECRET` | **sim** | **idêntico** ao do `imesul-vendas` — repetido aqui de propósito, é o ponto mais fácil de errar numa migração com dois apps. |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_AUTH_TOKEN` | opcionais | mesma nota de ambiente do vendas. |
| `ALLOWED_DEV_ORIGINS` | só dev | não usar em produção. |

## Nunca fazer

- Nunca commitar `/etc/imesul/*.env` em nenhum repositório.
- Nunca colar um valor real de env var no chat, em issue, ou em qualquer arquivo desta pasta
  `HOSTGATOR-MIGRACAO/`.
- Nunca gerar um novo `ANALYTICS_SECURITY_KEY`/`CONSENT_SYNC_SECRET` "para simplificar" — quebra
  dados já criptografados e o sync entre os dois sites, respectivamente. Reusar os valores atuais.
- Nunca preencher variáveis `META_*` com valor inventado.

## Como transferir os valores reais com segurança (quando chegar a hora)

Não copiar por chat. Opções recomendadas: colar direto no editor da VPS via SSH (sessão já
autenticada), ou usar um gerenciador de segredos que você já tenha (1Password/Bitwarden CLI) para
exportar direto no servidor. Este documento não prescreve qual — só reforça o "nunca por chat".
