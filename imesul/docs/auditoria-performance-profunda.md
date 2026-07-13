# Auditoria profunda de performance

Data: 2 de julho de 2026

## Escopo e metodologia

A auditoria foi executada no projeto institucional `imesul`, com Next.js 16.2.10 e Turbopack. A linha de base foi coletada antes das alteracoes com `next build`, `next experimental-analyze`, inventario de `public` e leitura do manifesto de referencias do cliente. Depois das alteracoes, as mesmas medicoes foram repetidas.

Os tamanhos de JavaScript abaixo sao os arquivos de entrada da rota `/`, sem compressao HTTP. Em producao, Brotli ou gzip reduz ainda mais a transferencia. O HTML atual da rota possui 138.931 bytes sem compressao e 16.862 bytes com gzip.

## Comparativo

| Metrica | Antes | Depois | Variacao |
| --- | ---: | ---: | ---: |
| First Load JS da rota `/` | 345.465 B | 153.068 B | -55,7% |
| Pasta `public` | 9.396.396 B (8,96 MB) | 5.047.689 B (4,81 MB) | -46,3% |
| Video WebM | 2.878.101 B (2,74 MB) | 1.503.785 B (1,43 MB) | -47,8% |
| Video MP4 | 5.273.519 B (5,03 MB) | 2.276.184 B (2,17 MB) | -56,8% |
| Videos somados | 8.151.620 B | 3.779.969 B | -53,6% |
| Imagens WebP em `public` | 14 / 1.244.776 B | 14 / 1.267.720 B | +22.944 B pelo poster |
| Arquivos de fonte gerados | 44 | 35 | -20,5% |
| Client Components | 9 | 9 | mesmo total, limites menores |
| Vulnerabilidades de producao | 0 | 0 | sem regressao |

O total de Client Components permaneceu em nove porque foram criados dois limites pequenos de infraestrutura (`MotionProvider` e `SmoothScroll`). Em contrapartida, `app/page.jsx` e `Footer.jsx` deixaram de ser Client Components, removendo a pagina inteira como um unico limite hidratado.

## Bundle JavaScript

### Linha de base

- A homepage era entregue em um chunk principal de aproximadamente 279,7 KB.
- GSAP + ScrollTrigger: aproximadamente 45,4 KB comprimidos no relatorio do analisador.
- Framer Motion: aproximadamente 56,1 KB comprimidos.
- Lenis: aproximadamente 5,0 KB comprimidos.
- Codigo proprio da homepage: aproximadamente 16,1 KB comprimidos.

### Depois

- Entrada inicial da rota dividida em 53,4 KB, 68,2 KB, 23,3 KB e pequenos runtimes.
- First Load JS total medido: 149,5 KiB.
- GSAP e ScrollTrigger passaram a ser importados dinamicamente dentro dos efeitos.
- Lenis continua instalado e funcional, mas inicializa durante tempo ocioso e fora do caminho critico.
- Framer Motion usa `LazyMotion` com `domAnimation`; recursos nao usados de drag/layout nao entram no caminho inicial.
- Nenhuma dependencia foi removida: GSAP, Framer Motion e Lenis continuam justificadas pelo comportamento atual.

## Video

- Resolucao preservada: 640 x 368.
- Duracao preservada: 45,17 segundos.
- Audio ausente no original e nas novas versoes.
- FPS reduzido de 30 para 24, adequado ao uso cinematografico de fundo.
- MP4 codificado em H.264 High Profile, CRF 28, com `faststart`.
- WebM codificado em VP9 com alvo de 240 kbps.
- Similaridade estrutural medida do WebM: SSIM 0,9266; a camada escura do hero reduz a percepcao das perdas.
- Poster WebP de 26.248 B adicionado.
- `preload="none"` evita baixar o video antes da hidratacao.
- `saveData` e `prefers-reduced-motion` mantem apenas o poster.
- Falha de reproducao conserva o poster como fallback.
- Os originais foram preservados em `docs/performance-assets-originals/`.

## Imagens, fontes e CSS

- Todas as imagens renderizadas pela homepage usam `next/image`, exceto o poster nativo do elemento `<video>`.
- Imagens abaixo da dobra mantem lazy loading padrao do Next.js.
- Apenas a logo critica da navbar usa prioridade.
- Nenhuma imagem quebrada foi encontrada em desktop, tablet ou mobile.
- O ativo raster antigo do WhatsApp, sem referencia no codigo, foi removido.
- Foram removidos os pesos 900 de Barlow e 800/900 de Barlow Condensed, que nao eram usados.
- CSS compilado caiu de 61,4 KiB para 58,6 KiB.
- Filtros e sombras da identidade visual foram mantidos; nao foi feita simplificacao visual especulativa.

## Validacao

- `npm run lint`: passou.
- `npm run build`: passou.
- `npm audit --omit=dev`: 0 vulnerabilidades.
- `next experimental-analyze`: dados gerados e analisados; o processo servidor do relatorio foi encerrado pelo limite de tempo.
- `git diff --check`: passou, somente avisos de normalizacao LF/CRLF.
- Desktop 1440 x 900: passou.
- Tablet 768 x 1024: passou.
- Mobile 390 x 844: passou.
- Rede local `192.168.1.117:3000`: passou.
- Console: nenhum erro ou warning observado.
- `prefers-reduced-motion`: dois posters presentes, zero `<source>` de video e zero referencia WebM no DOM hidratado.
- WhatsApp: link `https://wa.me/556733125600` confirmado.

## Otimizacoes nao aplicadas

- As secoes institucionais nao foram removidas do SSR nem transformadas em placeholders. Isso reduziria o HTML, mas prejudicaria SEO, acessibilidade e estabilidade visual.
- O showroom ainda renderiza estruturas responsivas de desktop e mobile no HTML. A resposta possui 138,9 KB sem compressao, mas apenas 16,9 KB com gzip; uma unificacao completa exigiria refatoracao visual de maior risco.
- Nao foi removido GSAP, Framer Motion ou Lenis. O custo foi controlado por divisao e carregamento tardio, preservando as animacoes aprovadas.
- Nao foram recomprimidas as imagens transparentes de produtos: os arquivos ja sao WebP pequenos e nova compressao poderia degradar bordas e brilho metalico.

## Proximos passos

1. Validar visualmente os dois videos otimizados em aparelhos iOS e Android reais.
2. Configurar CDN com Brotli, cache imutavel para `_next/static` e cache longo para os videos versionados.
3. Rodar Lighthouse/WebPageTest no dominio de producao, onde latencia, CDN e compressao representam o ambiente real.
4. Considerar uma refatoracao futura do showroom para compartilhar um unico DOM entre desktop e mobile, somente com comparacao visual automatizada.
