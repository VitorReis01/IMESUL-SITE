# 1. Inventário completo

Gerado em 28/09/2026, por leitura do repositório local (`C:\Users\Administrador\Documents\IMESUL-SITE`,
branch `preview/mobile-ajustes`). Nenhum comando foi executado contra a produção.

## 1.1 As duas aplicações

| | `imesul-vendas` | `imesul` (institucional) |
|---|---|---|
| Papel | Catálogo comercial + pré-orçamento + backend real | Vitrine institucional |
| Next.js | **16.3.5** | **16.3.5** |
| Node exigido (`engines`) | **>=22.16.0** | **>=22.16.0** |
| `output` | `standalone` (`next.config.js`) | `standalone` (`next.config.js`) |
| Build de produção (cPanel) | `npm run build:cpanel` → `next build --webpack && node scripts/prepare-standalone.mjs` | `npm run build:cpanel` → `next build && node scripts/prepare-standalone.mjs` |
| Startup file | `app.js` (wrapper Passenger, carrega `.next/standalone/server.js`) | não tem `app.js` — só `scripts/prepare-standalone.mjs` |
| Testes | Vitest, 150 testes (lógica pura, sem I/O) | nenhum |
| Porta interna planejada na VPS | **3001** | **3002** |

**Observação sobre o build:** `imesul-vendas` força `--webpack` no `build:cpanel` porque o Turbopack
disparava `EAGAIN` ao abrir ~31 workers num ambiente de poucos recursos (cPanel); `next.config.js`
também limita `experimental.cpus: 1` nesse projeto. O institucional **não** tem essa flag nem esse
limite hoje. Numa VPS de **1 vCPU**, é provável que o institucional precise do mesmo tratamento
(`--webpack` e/ou `experimental.cpus: 1`) — sinalizado em [08-deploy.md](08-deploy.md) como algo a
testar no primeiro build, não presumido resolvido.

`imesul-vendas/app.js` documenta a regra de fundo: **o build standalone precisa ser Linux** —
nunca copiar um `.next/standalone` gerado no Windows (binários nativos como `sharp` ficam
incompatíveis). Isso **não** significa que o build precise ser feito *na própria VPS*: existe um
pacote Linux já validado em produção para o `imesul-vendas` (FINAL5, seção 1.7) que deve ser
**reaproveitado como caminho principal**; build direto na VPS (1 vCPU / 2 GB RAM) fica como
**fallback**, não como padrão. Detalhes e correção desta classificação na seção 1.7.

## 1.2 Rotas principais

### `imesul-vendas`

| Rota | Fonte |
|---|---|
| `/` | `app/page.jsx` |
| `/materiais/[categorySlug]` | 10 categorias roteadas (`data/catalogCategories.js` + `catalogRoutes.js`) |
| `/materiais/[categorySlug]/[productSlug]` | 52 produtos roteados |
| `/materiais/[categorySlug]/[productSlug]/[variantSlug]` | 69 variações roteadas |
| `/politica-de-privacidade` | `app/politica-de-privacidade/page.jsx` |
| `/campo-grande`, `/campogrande` | unidade Campo Grande (URLs antigas restauradas) |
| `/dourados`, `/douradosmatriz` | unidade Dourados |
| `/r/[token]` | redirect de handoff do IMEbot (`app/r/[token]/route.js`) |
| Redirect real (`next.config.js#redirects`) | `/materiais/acessorios/consumiveis` → `/materiais/acessorios/eletrodo` (308, funciona) |
| Redirects "legados" via `permanentRedirect()` em página (`data/catalogRoutes.js`) | 10 rotas antigas de categoria/produto — **achado da auditoria de 25–26/09: em produção (cPanel) saem com `Location` duplicado e caem em 404.** Não reproduzido localmente; testar de novo na VPS/Nginx, porque o defeito pode ser específico do Litespeed/Passenger do cPanel atual. |

Contagem gerada por `data/catalogRoutes.js#getRoutedCatalogCategories/Products/Variants`:
**10 categorias · 52 produtos · 69 variações · 47 imagens de produto**.

### `imesul` (institucional)

| Rota | Fonte |
|---|---|
| `/` | `app/page.jsx` |
| `/links` | `app/links/page.jsx` |
| `/politica-de-privacidade` | `app/politica-de-privacidade/page.jsx` |
| CTAs "Falar no WhatsApp" | chamam `POST {NEXT_PUBLIC_SALES_URL}/api/leads` cross-origin (`credentials: "omit"`) |

## 1.3 Health checks

| Rota | App | Auth | Observação |
|---|---|---|---|
| `GET /api/health` | vendas | pública | `{"status":"ok","service":"imesul-vendas"}`, `Cache-Control: no-store` |
| `GET /api/health/database` | vendas | header `x-monitoring-key` == `MONITORING_HEALTH_SECRET` (`timingSafeEqual`) | `SELECT 1` com timeout curto |
| `GET /api/health/imebot` | vendas | pública (resposta genérica) / detalhada com o mesmo `x-monitoring-key` | reporta `IMEBOT_ENABLED` só para quem tem o segredo |
| `GET /api/health` | institucional | pública | resposta mínima |
| `GET /api/admin/monitoring/status` | vendas | sessão admin | agrega saúde dos dois sites |

## 1.4 Dependências (runtime)

**`imesul-vendas`**: `@sentry/nextjs`, `lucide-react`, `next`, `pg`, `react`, `react-dom`,
`server-only`, `three`. Dev: `eslint`, `vitest`, `tailwindcss`, `postcss`, `autoprefixer`.

**`imesul` (institucional)**: `@sentry/nextjs`, `framer-motion`, `gsap`, `lenis`, `next`, `react`,
`react-dom`. Dev: `eslint`, `tailwindcss`, `postcss`, `autoprefixer`.

**`sharp`**: não aparece como dependência direta em nenhum `package.json` — é um *optional
dependency* do próprio `next` (usado por `next/image` no servidor), confirmado em
`package-lock.json` (`"sharp": "^0.35.4"` sob a árvore de `next`). Isso significa que **um
`npm ci`/`npm install` rodado direto na VPS (Linux/x64) já baixa o binário nativo correto
(`@img/sharp-linux-x64-*`)** — não precisa de nenhuma ação extra, só rodar o install no Linux de
destino (nunca reusar `node_modules` copiado do Windows).

## 1.5 Variáveis de ambiente (nomes apenas — ver [07-env-checklist.md](07-env-checklist.md) para a lista completa e anotada)

Resumo rápido: `imesul-vendas` tem ~43 variáveis documentadas em `.env.example` (banco, admin,
analytics, consentimento, Sentry, IMEbot); `imesul` tem ~15 (URL de vendas, SEO/indexação,
analytics, consentimento, monitoramento, Sentry). Nenhum valor foi lido, copiado ou incluído aqui.

## 1.6 `db/migrations/` (referência — banco continua no Supabase, nada disso roda na VPS)

`001_initial.sql` … `009_fix_campo_grande_function_permissions.sql` (9 arquivos, aplicados via
`npm run db:migrate` / `scripts/migrate-db.mjs`, cada um idempotente com `IF NOT EXISTS`). A VPS só
precisa de `DATABASE_URL` apontando pro Supabase existente — **nenhuma migration deve rodar durante
a migração de infraestrutura**, o schema já está aplicado.

## 1.7 Validação dos pacotes/artefatos disponíveis (item 2 do pedido) — **corrigido em 28/09**

> Correção sobre a primeira versão deste inventário: eu tinha classificado "não existe build Linux
> validado" com base só no que está *neste checkout local* (`C:\Users\Administrador\Documents\IMESUL-SITE`).
> Isso estava incompleto — existe um pacote standalone **Linux, já validado em produção no cPanel**,
> gerado numa sessão anterior de deploy e guardado no próprio servidor cPanel (não neste repositório
> local). Reclassificado abaixo como o artefato **principal** para o `imesul-vendas`.

### a) `imesul-vendas-standalone-final5-20260921.tar.gz` — **artefato principal do `imesul-vendas`**

- **Build standalone Linux, já testado em produção real** no cPanel atual: rodou com Passenger/Node
  22, serviu `public/`, `.next/static/` e `/_next/image` (otimização de imagem via `sharp` Linux)
  corretamente.
- `BUILD_ID`: `XR0DFQkI7dmJ2lqwGGSwL`
- `SHA-256`: `8dd0514bfb75d64e4bd3d01332fc89796d001f611ec48c24df7060dbff6a3507`
- **Onde está hoje:** no servidor cPanel (histórico de deploy do `imesul-vendas`), não neste
  checkout do Windows — precisa ser **baixado de lá** (scp/download pelo File Manager) antes de
  poder ser copiado para a VPS. Este repositório local não tem cópia dele; por isso a primeira
  versão deste documento não o via.
- **Antes de reaproveitar na VPS, confirmar (não presumir):**
  1. **SHA-256 bate** com o valor acima depois de baixado e depois de subir para a VPS (`sha256sum`
     nas duas pontas — garante que não corrompeu no transporte).
  2. **Arquitetura/ABI compatível com a VPS AlmaLinux:** o binário nativo do `sharp` dentro do
     pacote precisa ser `@img/sharp-linux-x64-*` (glibc, não `musl`/Alpine) — conferir com
     `find .next/standalone/node_modules/@img -maxdepth 1` depois de extrair. cPanel (CloudLinux) e
     AlmaLinux são ambos RHEL-based/glibc/x86_64, então a expectativa é compatibilidade direta, mas
     **verificar, não assumir** — um `node .next/standalone/server.js` de teste + `curl` local na
     VPS confirma na prática (procedimento em [08-deploy.md](08-deploy.md)).
  3. **Node da VPS na mesma major version** usada para gerar o pacote (Node 22 — mesma exigida pelo
     `engines` do projeto e já prevista em `02-provisionamento.sh`).
  4. **`BUILD_ID` e conteúdo condizem com o código-fonte atual do branch** que vai para produção —
     se o código mudou desde 21/09 (a data do BUILD_ID), o FINAL5 está desatualizado e vira só uma
     referência de "isso funciona neste servidor", não o pacote final a publicar. Decidir, no dia do
     deploy, se o FINAL5 ainda reflete o código que você quer publicar ou se só serve como
     comprovação de compatibilidade antes de um build mais novo.
- **Se qualquer verificação acima falhar:** cai para o fallback da seção 1.7c (build fora da VPS) ou,
  em último caso, build na própria VPS (mais lento, mas ainda funciona numa VPS de 1 vCPU/2 GB —
  só não é o caminho preferido).

### b) `imesul-vendas-cpanel.tar.gz` (raiz deste repo) — pacote de código-fonte, não um build

- Conteúdo: `app/`, `components/`, `Backend.js/`, `lib/`, `data/`, `db/`, `hooks/`, `public/`,
  `scripts/`, `app.js`, `package.json`, `package-lock.json`, configs — **399 entradas**, **sem**
  `node_modules/`, **sem** `.next/standalone/`, **sem** `server.js`.
- Tamanho: 72.130.718 bytes (≈ 68,8 MB). **SHA-256:**
  `02030f706817d6c78552847c503d411b721dced974559d75c485dd28993f05d4`
- Existe um `.zip` irmão (`imesul-vendas-cpanel.zip`, 15/09), mais antigo — usar o `.tar.gz`.
- **Uso:** referência de código-fonte e ponto de partida se o FINAL5 (item a) falhar na verificação
  de compatibilidade, ou se o código mudou desde o BUILD_ID do FINAL5 e um build novo for necessário.

### c) `.next/standalone/` já presentes em `imesul/` e `imesul-vendas/` neste checkout (builds Windows locais)

| | `imesul/.next/standalone` | `imesul-vendas/.next/standalone` |
|---|---|---|
| `server.js` existe | sim (19/09, 31 MB de árvore) | sim (21/09, 45 MB de árvore) |
| `BUILD_ID` | `M-2iQOU1v8GPFEBFa37Mh` | `9RDZEgMFe0wlKPdowf-rl` |
| `public/` copiado | **não** (`prepare-standalone.mjs` não rodou depois do build) | **não** |
| `.next/static/` copiado | **não** | **não** |
| binário nativo do `sharp` | **`@img/sharp-win32-x64` (Windows)** | **`@img/sharp-win32-x64` (Windows)** |

**Estes dois continuam reprovados para uso direto na VPS** — essa parte da conclusão original não
mudou, só não se aplica ao FINAL5 (que é outro artefato, gerado em Linux). Dois motivos, cada um
suficiente sozinho: faltam `public/`/`.next/static/`, e o `sharp` é Windows x64
(`sharp-win32-x64-0.35.4.node`) — confirma na prática o aviso já escrito em `imesul-vendas/app.js`.

### d) `imesul` institucional — **build de validação Linux (28/09/2026, via WSL2) — não é o artefato de produção**

Diferente do vendas, não havia equivalente ao FINAL5 para o institucional (nem localmente, nem
registrado no cPanel). Preparei um agora, fora da VPS, para não depender do build-na-VPS como
caminho principal: **WSL2 (Ubuntu 24.04, Node 22.23.3 via `nvm`, kernel Linux real, x86_64/glibc)**
— escolhido em vez de Docker porque já estava disponível no ambiente e evita a armadilha do Alpine
(`musl`, incompatível com o binário do `sharp` que a VPS AlmaLinux — glibc — precisa).

**Artefato gerado:** `imesul-institucional-standalone-20260928.tar.gz`, na raiz deste repositório
(`C:\Users\Administrador\Documents\IMESUL-SITE\`, ao lado do `imesul-vendas-cpanel.tar.gz`) —
**fora** de `HOSTGATOR-MIGRACAO/` de propósito (essa pasta fica só docs/scripts pequenos, para
versionamento limpo; artefato binário de ~51 MB não entra junto).

| | |
|---|---|
| Tamanho | 53.361.051 bytes (≈ 50,9 MB) |
| SHA-256 | `d97e5123f3bc1fee10eeb9cdd60eb39c69976fca27313e290da585a73b126ce7` |
| BUILD_ID | `yy8FdnPmDlPoOwa92Lbjv` |
| Conteúdo | `.next/standalone/` completo: `server.js`, `public/` (`images/`, `catalogo/`), `.next/static/` (`chunks/`, `media/`), `node_modules/@img/sharp-linux-x64` (glibc, o que a VPS precisa) |

**Validado com smoke test real (servidor rodando, requisições HTTP de verdade, dentro do WSL2):**

| Verificação | Resultado |
|---|---|
| `GET /` | 200, 394.901 bytes |
| `GET /links` | 200 |
| `GET /politica-de-privacidade` | 200 |
| `GET /api/health` | 200, `{"status":"ok","service":"imesul-institucional"}` |
| `GET /robots.txt` | 200, `text/plain` |
| `GET /sitemap.xml` | 200, `application/xml` |
| `GET /pagina-inexistente-xyz` | 404 (correto, sem soft-404) |
| `GET /_next/static/chunks/<hash>.js` | 200, `application/javascript`, `Cache-Control: public, max-age=31536000, immutable` |
| `GET /_next/image?url=%2Fimages%2Flogo-imesul-oficial.png&w=640&q=75` | 200, `image/png` — **prova o `sharp` Linux funcionando de verdade**, não só presente no diretório |
| Headers de segurança (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`, `Strict-Transport-Security`) | todos presentes, batendo com `next.config.js` |

**⚠️ Atenção antes de publicar este artefato específico:** o build usou **valores placeholder** para
as variáveis públicas obrigatórias no build (`NEXT_PUBLIC_SALES_URL=https://vendas.exemplo.com.br`,
`SITE_URL=https://www.exemplo.com.br`) porque a decisão de domínio real ainda está em aberto (ver
resumo no chat). **`NEXT_PUBLIC_*` é inlineado no JavaScript do cliente em tempo de build** — dá
para confirmar isso no próprio CSP capturado no smoke test (`connect-src ... https://vendas.exemplo.com.br...`).
Ou seja: **este tar.gz prova que o build funciona e que o `sharp` é compatível com a VPS — não é o
artefato final para publicar.** Assim que o domínio real for decidido, repetir exatamente o mesmo
processo (mesmo script, só trocando os dois valores de env) para gerar o pacote definitivo. Passo a
passo completo, incluindo como reproduzir isso do zero, em [08-deploy.md](08-deploy.md) §8.3a.

Build direto na VPS (1 vCPU/2 GB) continua documentado como **fallback** em
[08-deploy.md](08-deploy.md) §8.3b — só necessário se este artefato falhar na verificação já feita
na própria VPS (repetir SHA-256 + smoke test lá, mesmo assim, antes de subir o systemd).

## 1.8 Achados desta auditoria (25–26/09/2026) relevantes para a migração

- **Redirects legados quebrados** (seção 1.2) — reavaliar na VPS; pode ser defeito do
  Litespeed/Passenger do cPanel, não do código.
- **Sem compressão gzip/brotli** e **sem HTTP/2** no cPanel atual, mesmo com `Accept-Encoding`
  correto — no Nginx da VPS isso é resolvido de fábrica (ver [03](03-nginx-vendas.conf)/[04](04-nginx-institucional.conf)).
- **Rajada de `/_next/image` (~2 req/s por alguns minutos) coincidiu com o site parar de responder**
  na infraestrutura atual — não comprovado como causa, mas motivou o rate limit "generoso" sugerido
  em [12-seguranca.md](12-seguranca.md) (não travar tráfego legítimo, mas evitar rajada crua).
- `X-Powered-By: Phusion Passenger` exposto hoje — não existe mais na VPS (sem Passenger).
