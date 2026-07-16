# IMESUL - Site institucional

Site vitrine da IMESUL Distribuicao. A pagina apresenta a marca, a historia da empresa, os diferenciais, as linhas de produtos, as unidades e os canais de contato. A compra nao acontece aqui: os links de produtos levam para a Area de Vendas.

## Tecnologias

- Next.js 16 com App Router e Turbopack
- React 18
- Tailwind CSS
- GSAP e ScrollTrigger para animacoes ligadas a rolagem
- Framer Motion com LazyMotion para entradas e transicoes
- Lenis para suavizar a rolagem em dispositivos compativeis
- `next/image` e `next/font` para imagens e fontes

## Estrutura

```text
app/          rotas, layout, metadata, estilos e paginas de erro
components/   secoes da homepage e recursos de navegacao
data/         produtos, links, diferenciais e contato comercial
docs/         arquitetura, auditorias e material de manutencao
public/       imagens e videos publicados sem processamento manual
```

O fluxo da homepage e montado em `app/page.jsx`: Navbar, Hero, Nossa Historia, Diferenciais, Showroom, CTA final, Footer e WhatsApp flutuante.

## Relacao com a Area de Vendas

O endereco comercial e lido de `NEXT_PUBLIC_SALES_URL`. Os links de produtos e o CTA final abrem o projeto `imesul-vendas` em outra aba. Os dois projetos sao independentes no build e no deploy.

## Variaveis de ambiente

Copie `.env.example` para `.env.local` e informe os enderecos publicos:

```env
NEXT_PUBLIC_SITE_URL=https://grupoimesul.com.br
NEXT_PUBLIC_SALES_URL=https://imesul-vendas.vercel.app/
```

`NEXT_PUBLIC_SITE_URL` alimenta metadata, canonical, sitemap e dados estruturados. Variaveis com prefixo `NEXT_PUBLIC_` ficam visiveis no navegador e nao devem conter segredos.

## Comandos

```bash
npm install
npm run dev
npm run lint
npm run build
npm start
```

O desenvolvimento usa a porta 3000 por padrao. `next.config.js` permite o acesso local pelo IP cadastrado em `allowedDevOrigins`.

## Animacoes e video

`SmoothScroll.jsx` inicializa Lenis e GSAP fora do carregamento inicial. As secoes carregam GSAP sob demanda e removem seus gatilhos no cleanup. `MotionProvider.jsx` limita o Framer Motion ao conjunto `domAnimation`.

O Hero usa WebM com MP4 de fallback e poster WebP. Em `prefers-reduced-motion` ou `Save-Data`, o video nao e baixado. Os originais ficam em `docs/performance-assets-originals/` e nao devem ser usados diretamente pela pagina.

## Conteudo e contato

`data/products.js` concentra:

- linhas e imagens do showroom;
- links da navegacao;
- diferenciais institucionais;
- numero e mensagem do WhatsApp;
- URL da Area de Vendas.

Ao adicionar um produto, mantenha `id`, `number`, imagem, textos, variacoes e uso principal. A imagem deve existir em `public/products` e preferencialmente estar em WebP.

## Build e deploy

Antes de publicar:

```bash
npm run lint
npm run build
npm audit --omit=dev
```

O deploy precisa preservar os headers definidos em `next.config.js` e servir videos com suporte a requisicoes parciais. Configure cache longo para `_next/static` e assets versionados.

## Arquivos que nao devem ser editados manualmente

- `node_modules/`
- `.next/`
- `package-lock.json`
- imagens, videos e fontes
- backups em `docs/performance-assets-originals/`
- relatorios e caches gerados por ferramentas

Veja `docs/arquitetura.md` para o fluxo tecnico e `docs/glossario.md` para os termos usados no projeto.
