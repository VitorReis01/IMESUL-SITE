# Auditoria de Performance e Segurança

Data: 24/06/2026

## Escopo

Auditoria do site institucional IMESUL. O projeto `imesul-vendas` não foi alterado.

## Performance

### Arquivos pesados encontrados

| Asset | Tamanho aproximado | Situação |
| --- | ---: | --- |
| `public/videos/fabrica-dourados-hero.mp4` | 5,03 MB | Mantido como fallback para navegadores sem WebM |
| `public/videos/fabrica-dourados-hero.webm` | 2,74 MB | Formato principal do vídeo |
| `public/images/company/historia-imesul.png` | 2,65 MB | Removido; substituído pelo WebP de 244 KB |
| `public/images/company/clientes-imesul.png` | 1,97 MB | Removido; substituído pelo WebP de 127 KB |
| `public/products/acessorios-serralheria-showroom.png` | 352 KB | Removido; substituído pelo WebP de 88 KB |
| `public/products/tintas-solventes-solda-corte.png` | 298 KB | Removido; substituído pelo WebP de 60 KB |
| JPEGs de estrutura e matriz | 248 KB | Removidos; substituídos por WebP |

### Assets convertidos e referências atualizadas

- Imagens institucionais da história, clientes, estrutura e matriz agora usam WebP.
- Imagens do showroom de acessórios e tintas agora usam WebP.
- O ícone atual do WhatsApp foi convertido de PNG (82 KB) para WebP (18 KB), preservando transparência.
- O vídeo já estava corretamente configurado com WebM primeiro e MP4 como fallback.
- O `next/image` voltou a usar a otimização nativa do Next, com negociação WebP/AVIF.

### Duplicações e arquivos sem uso removidos

- Fontes PNG/JPEG que já possuíam equivalente WebP e não tinham mais referência.
- Uma cópia duplicada da imagem de tubos em `public/images/products`.
- `bobinas.webp` e `solventes-acessorios.webp`, sem referência no código atual.

### Redução aproximada

- `public` antes: 15.581.342 bytes (14,86 MB).
- `public` depois: 9.410.798 bytes (8,97 MB).
- Redução: 6.170.544 bytes, aproximadamente **39,6%**.
- O MP4 representa mais da metade do peso restante, mas foi mantido intencionalmente como fallback.

### Carregamento e bundle

- As imagens de conteúdo continuam usando `next/image`, que aplica lazy loading por padrão quando `priority` não é informado.
- Apenas imagens iniciais relevantes recebem prioridade.
- Lenis já é carregado dinamicamente na página inicial.
- GSAP, Framer Motion e Lenis continuam sendo as principais dependências do cliente. São justificadas pela experiência visual atual, mas devem ser monitoradas em futuras revisões de bundle.

## WhatsApp flutuante

- Mantido o ícone visual existente.
- Criada base circular com profundidade, sombra externa, brilho verde discreto e sombras internas.
- Hover com elevação e escala moderadas.
- Animação restrita ao brilho e desativável por `prefers-reduced-motion`.
- Tamanhos responsivos e conteúdo centralizado.
- Link externo mantém `noopener noreferrer`.

## Segurança básica

### Verificações realizadas

- Nenhum arquivo `.env` real encontrado no projeto; existe somente `.env.example`.
- `.env*` está ignorado pelo Git, com exceção dos arquivos `.env.example` públicos.
- Nenhuma chave de API, senha, token ou segredo foi encontrada no frontend.
- `NEXT_PUBLIC_SALES_SITE_URL` é uma configuração pública por definição e não deve receber segredos.
- Nenhum `console.log`, `console.debug`, `console.info`, `console.warn` ou `console.error` foi encontrado no código do site.
- Links externos revisados usam `rel="noopener noreferrer"`.
- O site não possui endpoints próprios, autenticação ou armazenamento de dados pessoais neste projeto institucional.
- Em produção, o Next apresenta respostas de erro genéricas; detalhes técnicos não devem ser enviados ao usuário.

### Headers adicionados

- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`

### Limites da blindagem no frontend

Não é possível impedir que visitantes usem DevTools, leiam o HTML/CSS/JavaScript entregue ao navegador, vejam URLs públicas ou baixem imagens já exibidas. Minificação e ofuscação não substituem segurança. Segredos, tokens privados e regras críticas nunca devem ser enviados ao frontend.

## Riscos e recomendações futuras

1. Configurar `NEXT_PUBLIC_SALES_SITE_URL` com a URL pública real no ambiente de produção; o fallback atual é local.
2. Avaliar uma versão menor do vídeo para telas móveis ou imagem poster para conexões lentas.
3. Monitorar Core Web Vitals e transferência real do vídeo após o deploy.
4. Manter dependências atualizadas e executar `npm audit` periodicamente.
5. Considerar CSP depois de mapear fontes, analytics e integrações externas do ambiente de produção.
6. Se o site passar a receber formulários ou dados pessoais, validar tudo no backend e adicionar proteção contra abuso, CSRF conforme arquitetura e política de retenção.
