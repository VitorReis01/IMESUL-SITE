# Auditoria Final de Publicação

Data: 24/06/2026

## Resultado Lighthouse

Auditoria executada com Lighthouse 12.8.2 contra build de produção local (`next build` + `next start`).

| Categoria | Mobile | Desktop | Meta |
| --- | ---: | ---: | ---: |
| Performance | **98** | **99** | 90+ |
| Accessibility | **100** | **100** | 90+ |
| Best Practices | **100** | **100** | 90+ |
| SEO | **100** | **100** | 90+ |

### Core Web Vitals e métricas de laboratório

| Métrica | Mobile | Desktop | Avaliação |
| --- | ---: | ---: | --- |
| LCP | 2,1 s | 0,7 s | Bom |
| CLS | 0 | 0,001 | Bom |
| TBT | 60 ms | 0 ms | Bom; proxy de responsividade em laboratório |
| FCP | 1,5 s | 0,4 s | Bom |

INP não é medido de forma representativa em uma execução sintética sem interação. A validação definitiva depende de dados reais de campo (CrUX/RUM) após publicação. O TBT baixo indica baixo risco inicial.

## Problemas encontrados e corrigidos

- Fontes do Google bloqueavam renderização: migradas para `next/font` e servidas localmente.
- H1 principal aguardava animação para pintar: agora fica disponível imediatamente, preservando animações secundárias.
- Smooth scroll iniciava durante a fase crítica: carregamento passou a ocorrer quando o navegador fica ocioso.
- Segundo vídeo era transferido antes de chegar à seção: fontes de vídeo são adicionadas somente próximo da viewport.
- Imagens de produtos ocultas recebiam prioridade indevida: passaram a usar lazy loading normal.
- Ícone do WhatsApp estava superdimensionado: reduzido para 128 x 128 e 3,3 KB.
- Contraste insuficiente e headings fora de ordem no rodapé: corrigidos.
- Nome acessível do CTA divergia do texto visível: corrigido.
- Favicon ausente: metadata passou a usar o logo WebP existente.
- Cache `.next` antigo causava erros falsos de chunks durante a primeira medição: build e servidor foram reiniciados de forma limpa.

## SEO técnico

- `robots.txt`: criado e validado com HTTP 200.
- `sitemap.xml`: criado e validado com HTTP 200.
- Canonical URL: presente.
- Metadata: título, descrição, keywords e robots.
- Open Graph: título, descrição, URL, locale, site name e imagem.
- Twitter Card: `summary_large_image`.
- Favicon: logo institucional WebP.
- JSON-LD: `Organization` e duas unidades `LocalBusiness`.
- Idioma do documento: `pt-BR`.

## Imagens e mídia

- Nenhuma imagem em `public` supera 300 KB.
- Imagens de conteúdo usam `next/image` com dimensões ou contêiner de proporção estável.
- Imagens abaixo da dobra usam lazy loading.
- WebM é a fonte principal de vídeo; MP4 permanece como fallback.
- A transferência inicial ainda inclui aproximadamente 2,8 MB do vídeo principal. É o maior custo restante e uma escolha visual consciente.

## Bundle

Build final:

- Página inicial: aproximadamente 102 KB de código específico.
- First Load JS: aproximadamente 189 KB.
- Chunk de animações (Framer Motion/GSAP): aproximadamente 197 KB bruto.
- Lenis: chunk separado de aproximadamente 17 KB e carregamento dinâmico/ocioso.

Framer Motion, GSAP e Lenis são as dependências mais relevantes. Não foram removidas porque sustentam o comportamento cinematográfico atual e o score final já supera a meta. Uma redução adicional exigiria reescrever animações, com risco visual alto para ganho marginal.

## Segurança

Headers ativos e validados:

- `Content-Security-Policy`
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` bloqueando câmera, microfone, geolocalização e pagamentos.

A CSP permite apenas recursos locais, dados/blob necessários para mídia e HTTPS para conexões. Em desenvolvimento, `unsafe-eval` e WebSocket são liberados somente para o HMR.

Não foram encontrados `.env` reais versionados, segredos, tokens ou logs de console no frontend. DevTools, código entregue ao navegador e URLs públicas não podem ser ocultados por uma aplicação frontend.

## Pontos que ainda podem melhorar

1. Criar uma versão curta/menor do vídeo principal para redes móveis lentas.
2. Medir INP, LCP e CLS reais após publicação usando CrUX ou RUM.
3. Atualizar Next.js e dependências em uma etapa isolada, com teste de regressão.
4. Considerar substituir parte das animações por CSS somente se o bundle se tornar um problema real em dados de campo.
5. Executar Lighthouse novamente no domínio final, pois CDN, cache, TLS e latência alteram os números.

## Pronto para produção?

**Sim, com uma condição operacional:** configurar no ambiente de deploy:

- `NEXT_PUBLIC_SITE_URL` com o domínio institucional definitivo.
- `NEXT_PUBLIC_SALES_SITE_URL` com a URL pública da Área de Vendas.

Sem essas variáveis, os fallbacks locais/de domínio genérico podem gerar links e canonical incorretos.
