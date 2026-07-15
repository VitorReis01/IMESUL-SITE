# IMESUL - Area de Vendas

Catalogo comercial e gerador de pre-orcamentos da IMESUL. O cliente pode comecar por um projeto ou por um material conhecido, selecionar opcoes reais do catalogo e enviar um resumo organizado para o WhatsApp.

O projeto nao calcula preco, nao consulta estoque e nao funciona como e-commerce.

## Tecnologias

- Next.js 16 com App Router e Turbopack
- React 18
- Tailwind CSS
- `next/image` e fontes Google carregadas pelo CSS global
- Dados locais em modulos JavaScript
- WhatsApp Web por URL codificada

## Estrutura

```text
app/          layout, pagina principal, estilos e paginas de erro
components/   seletores, catalogo, formulario e resumo
data/         projetos, categorias, produtos, medidas e opcoes comerciais
lib/          montagem e validacao da mensagem do WhatsApp
public/       imagens do catalogo e marca
Backend.js/   apoio local para analytics e sessao admin demo
```

## Como os dois sites se conectam

O site institucional abre esta aplicacao por `NEXT_PUBLIC_SALES_SITE_URL`. A Area de Vendas retorna ao institucional usando `NEXT_PUBLIC_INSTITUTIONAL_SITE_URL`. Os builds e deploys sao independentes.

## Fluxos comerciais

### Tenho um projeto

`ProjectSelector` apresenta projetos e subtipos. `QuoteBuilder` recebe medidas opcionais, quantidade, cidade, estado e observacoes. Os materiais recomendados vem de `data/projects.js` e aparecem no resumo.

### Ja sei o material

`ProductCatalog` organiza categorias e produtos. `ProductOptionSelector` usa `catalogSpecifications.js` para limitar medida, espessura e comprimento a combinacoes presentes no catalogo. Produtos sem tabela confiavel mantem um campo livre identificado.

Nos dois caminhos, `ProductSummary` mostra a solicitacao antes do envio. `lib/whatsapp.js` normaliza os dados, limita o tamanho da mensagem e cria o link para o numero oficial.

## Variaveis de ambiente

```env
NEXT_PUBLIC_INSTITUTIONAL_SITE_URL=https://grupoimesul.com.br
NEXT_PUBLIC_WHATSAPP_NUMBER=556733125600
ADMIN_DEMO_USER=
ADMIN_DEMO_PASSWORD=
ANALYTICS_SECURITY_KEY=
```

O numero possui fallback no codigo para evitar um CTA sem destino. Variaveis `NEXT_PUBLIC_` sao publicas e nao devem conter credenciais. O login administrativo demo usa `ADMIN_DEMO_USER` e `ADMIN_DEMO_PASSWORD` somente no servidor; em producao, substituir por autenticacao real com sessao segura. `ANALYTICS_SECURITY_KEY` protege o IP completo usado apenas em investigacao de seguranca.

## Comandos

```bash
npm install
npm run dev -- -p 3001
npm run lint
npm run build
npm start -- -p 3001
```

## Dados do catalogo

- `catalogCategories.js`: grupos exibidos no catalogo.
- `catalogProducts.js`: produtos, textos, imagens, usos e disponibilidade tecnica.
- `catalogSpecifications.js`: medidas, espessuras, comprimentos e pesos extraidos do PDF.
- `materials.js`: apresentacao resumida das familias comerciais.
- `projects.js`: projetos, subtipos e materiais recomendados.
- `quoteOptions.js`: cidades, estados e opcoes compartilhadas pelo formulario.

Nao invente medidas ou pesos. Quando o PDF nao for legivel, mantenha o campo vazio e registre a limitacao diretamente nos dados tecnicos correspondentes.

## Build e deploy

Antes de publicar:

```bash
npm run lint
npm run build
npm audit --omit=dev
```

Configure as variaveis publicas no provedor de deploy e confirme o numero comercial com a equipe responsavel.

## Arquivos que nao devem ser editados manualmente

- `node_modules/`
- `.next/`
- `package-lock.json`
- PDF do catalogo
- imagens e outros arquivos binarios
- caches e resultados gerados por ferramentas
