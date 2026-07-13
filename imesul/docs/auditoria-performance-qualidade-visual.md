# Auditoria de performance e qualidade visual

## Escopo

Revisao do site institucional com prioridade para preservar videos, imagens e animacoes. Nenhum ativo foi recomprimido nesta etapa. Os arquivos originais continuam em `docs/performance-assets-originals`.

## Comparacao dos videos

| Perfil | Arquivo | Resolucao | FPS | Bitrate aproximado | Peso | Uso |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Desktop principal | `fabrica-dourados-hero-desktop.mp4` | 640x368 | 30 | 934 kbps | 5.03 MB | Hero e video final em telas a partir de 768 px |
| Desktop fallback | `fabrica-dourados-hero-desktop.webm` | 640x368 | 30 | 510 kbps | 2.74 MB | Fallback quando MP4 nao estiver disponivel |
| Mobile principal | `fabrica-dourados-hero.mp4` | 640x368 | 24 | 403 kbps | 2.17 MB | Hero e video final abaixo de 768 px |
| Mobile fallback | `fabrica-dourados-hero.webm` | 640x368 | 24 | 266 kbps | 1.43 MB | Fallback quando MP4 nao estiver disponivel |
| Poster | `fabrica-dourados-poster.webp` | 640x368 | - | - | 25.6 KB | Primeiro paint, Save-Data e movimento reduzido |

O MP4 mobile obteve SSIM 0.962044 e PSNR 37.234778 dB em relacao ao original. O WebM mobile obteve SSIM 0.926570 e PSNR 32.140704 dB. Por isso o MP4 ficou em primeiro lugar nas fontes: a comparacao lado a lado mostrou maior nitidez e nenhuma perda perceptivel no tamanho usado pelo Hero.

No desktop e tablet o arquivo principal e uma copia exata do original, portanto nao existe perda por recompressao. O enquadramento e a duracao foram preservados em todos os perfis.

## Estrategia adaptativa

- Desktop e tablet usam o MP4 original de maior qualidade.
- Mobile usa o MP4 otimizado, com menor transferencia e boa preservacao de detalhes.
- `Save-Data` e `prefers-reduced-motion` mantem apenas o poster e nao inserem fontes de video.
- O video de Nossa Historia so recebe fontes quando o painel final se aproxima da viewport.
- MP4 e priorizado pela qualidade medida; WebM permanece como fallback.

## Imagens

As imagens visiveis continuam usando `next/image`, com `sizes` e lazy loading abaixo da dobra. Os WebP existentes nao foram recomprimidos porque os arquivos-fonte equivalentes nao estao disponiveis para uma comparacao justa. Alterar esses ativos sem original poderia introduzir perda visual sem ganho comprovado.

## Animacoes

GSAP, ScrollTrigger, Framer Motion e Lenis foram preservados. Os imports de GSAP continuam dinamicos nas secoes que dependem da rolagem. Os gatilhos existentes possuem cleanup e as regras de movimento reduzido continuam ativas.

## Validacao de producao

| Viewport | Video carregado | FPS durante rolagem | Long tasks no trecho medido | Overflow | Imagens quebradas |
| --- | --- | ---: | ---: | --- | ---: |
| Desktop 1440x900 | Desktop MP4 | 60.1 | 5, maximo 236 ms no carregamento inicial | Nao | 0 |
| Tablet 768x1024 | Desktop MP4 | 60.4 | 0 | Nao | 0 |
| Mobile 390x844 | Mobile MP4 | 60.1 | 0 | Nao | 0 |
| Mobile com movimento reduzido | Somente poster | 60.4 | 1, 59 ms | Nao | 0 |

As long tasks do desktop ocorreram durante o primeiro carregamento e inicializacao das secoes animadas, sem reduzir a media medida de 60 FPS. A captura visual confirmou texto legivel, video nitido e composicao preservada em desktop e mobile.

## Codigo e comentarios

- `hooks/useAdaptiveVideoProfile.js`: documenta selecao por viewport, Save-Data, movimento reduzido e cleanup das assinaturas.
- `data/videoAssets.js`: documenta os perfis e o fallback sem video.
- `components/Hero.jsx`: documenta carregamento adaptativo e a prioridade do MP4 baseada na comparacao visual.
- `components/CompanyStory.jsx`: documenta carregamento por proximidade, reproducao e politica compartilhada com o Hero.

Os comentarios foram mantidos curtos e proximos dos blocos alterados. Tags, imports evidentes e propriedades individuais nao receberam comentarios porque isso apenas repetiria o codigo.

## Validacoes tecnicas

- `npm run lint`: aprovado.
- `npm run build`: aprovado com Next.js 16.2.10.
- `npm audit --omit=dev`: 0 vulnerabilidades.
- `git diff --check`: aprovado; apenas avisos de normalizacao LF/CRLF do repositorio.

## Pontos futuros

- Repetir a medicao em um celular fisico intermediario antes da publicacao final.
- Medir Core Web Vitals no ambiente hospedado, onde CDN, cache e latencia real influenciam o resultado.
- Manter os originais ate a aprovacao definitiva do marketing.
