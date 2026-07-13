# Inventario do projeto

## Codigo-fonte

- `app/`: layout, pagina, estilos e tratamento de erros.
- `components/`: entrada por projeto, catalogo, seletores tecnicos, formulario e resumo.
- `lib/`: geracao segura do link e da mensagem do WhatsApp.

## Dados

- `data/catalogCategories.js`: categorias comerciais.
- `data/catalogProducts.js`: produtos e imagens.
- `data/catalogSpecifications.js`: tabelas tecnicas extraidas do catalogo.
- `data/materials.js`, `projects.js` e `quoteOptions.js`: apresentacao e regras do formulario.

## Configuracoes

- `next.config.js`: Turbopack, CSP e headers.
- `tailwind.config.js`: cores e fontes.
- `postcss.config.js`: Tailwind e Autoprefixer.
- `eslint.config.mjs`: regras do Next.js.
- `.env.example`: URL institucional e numero comercial.
- `package.json`: scripts e dependencias, documentados no README.

## Documentacao e assets

`docs/` registra jornada, catalogo, extracao tecnica e arquitetura. `public/catalog-products` guarda imagens WebP e `public/logo` guarda a marca.

## Arquivos ignorados

Nao recebem comentarios: `package-lock.json`, PDF, imagens, fontes, binarios, `.next`, `node_modules`, caches e arquivos gerados. JSON puro permanece sem comentarios e e explicado no README.
