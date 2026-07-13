# Arquitetura do site institucional

## Visao geral

O projeto usa o App Router do Next.js. `app/page.jsx` e um Server Component que entrega a estrutura da homepage. Interacoes e animacoes ficam em Client Components pequenos, evitando transformar a pagina inteira em codigo hidratado.

## Fluxo da pagina

1. `app/layout.jsx` carrega metadata, fontes, dados estruturados e estilos globais.
2. `Navbar` mantem navegacao, menu mobile e progresso de leitura.
3. `Hero` apresenta o video e o titulo principal.
4. `CompanyStory` controla a narrativa horizontal no desktop e vertical no mobile.
5. `WhyChoose` apresenta diferenciais e unidades.
6. `ProductScrollExperience` monta o showroom e conecta cada produto a Area de Vendas.
7. `FinalCTA`, `Footer` e `WhatsAppFloat` encerram a jornada comercial.

## Comunicacao entre componentes

Nao existe estado global. Os componentes leem dados de `data/products.js` e mantem apenas o estado local necessario para menu, produto ativo e carregamento de video. Links externos recebem `noopener noreferrer`.

`MotionProvider` disponibiliza o conjunto leve do Framer Motion. `SmoothScroll` conecta Lenis ao ticker do GSAP depois do carregamento inicial. Cada secao cria e remove seus proprios ScrollTriggers.

## Assets

Imagens de interface usam `next/image`, com dimensoes e `sizes` definidos. O Hero escolhe WebM primeiro e MP4 como fallback. Poster, `Save-Data`, lazy loading e movimento reduzido evitam downloads desnecessarios.

## Seguranca

`next.config.js` aplica CSP, bloqueio de iframe, `nosniff`, politica de referencia e restricao de permissoes. O frontend nao armazena segredos; valores `NEXT_PUBLIC_` sao publicos por definicao.

## Performance

O HTML e gerado estaticamente. GSAP, ScrollTrigger e Lenis sao carregados no cliente quando necessarios. Fontes usam `next/font`, videos sao comprimidos e source maps de producao ficam desativados.

## Pontos de manutencao

- Atualize produtos e links em `data/products.js`.
- Mantenha IDs de secao sincronizados com a navegacao.
- Preserve cleanup de efeitos ao alterar animacoes.
- Teste desktop e mobile ao mudar alturas de secoes fixadas.
- Rode lint, build e `git diff --check` antes de publicar.
