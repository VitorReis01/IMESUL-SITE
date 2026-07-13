# Inventario do projeto

## Codigo-fonte

- `app/`: layout raiz, homepage, estilos, metadata, sitemap, robots e paginas de erro.
- `components/`: navegacao, secoes institucionais, animacoes, contato e runtime de scroll.
- `data/`: conteudo do showroom, navegacao, diferenciais e configuracoes comerciais.

## Configuracoes

- `next.config.js`: Turbopack, imagens, origem de desenvolvimento, CSP e headers.
- `tailwind.config.js`: tokens de cor, tipografia e animacoes utilitarias.
- `postcss.config.js`: Tailwind e Autoprefixer.
- `eslint.config.mjs`: regras do Next.js e exclusao de arquivos gerados.
- `.env.example`: URLs publicas esperadas.
- `package.json`: scripts e dependencias; documentado no README por ser JSON.

## Documentacao

- `README.md`: operacao e manutencao diaria.
- `docs/`: arquitetura, glossario, auditorias e backups de referencia.

## Assets

- `public/images`: imagens institucionais.
- `public/products`: imagens transparentes do showroom.
- `public/logo`: marca publicada.
- `public/videos`: poster e formatos WebM/MP4 usados na pagina.

## Arquivos ignorados

Nao recebem comentarios: `package-lock.json`, PDFs, imagens, videos, fontes, arquivos binarios, `.next`, `node_modules`, caches e backups. Esses formatos sao gerados, nao aceitam comentarios ou nao devem ser modificados manualmente.
