# Arquitetura da Area de Vendas

## Visao geral

A aplicacao usa uma unica pagina comercial. `ProjectSelector` controla o caminho inicial e entrega a selecao para `QuoteBuilder`. O estado fica no cliente porque escolhas dependentes, formulario e montagem da mensagem acontecem no navegador.

## Fluxo da pagina

1. O cliente escolhe entre projeto e material.
2. No caminho de projeto, escolhe um subtipo e recebe materiais recomendados.
3. No caminho direto, escolhe categoria, produto e opcoes tecnicas disponiveis.
4. O formulario coleta quantidade, localidade e observacoes.
5. O resumo confirma os dados.
6. A biblioteca de WhatsApp gera a mensagem e abre o canal comercial.

## Componentes principais

- `ProjectSelector`: caminhos, projetos, materiais e estado visual da selecao.
- `ProductCatalog`: categorias e cards do catalogo.
- `ProductOptionSelector`: dependencia entre medida, espessura e comprimento.
- `QuoteBuilder`: estado do formulario, validacao e coordenacao do fluxo.
- `ProductSummary`: leitura final da solicitacao.

## Dados e comunicacao

Nao existe backend ou banco. Componentes importam modulos de `data/`. IDs ligam categorias, produtos e especificacoes; por isso devem permanecer estaveis. Campos tecnicos vazios indicam dado ausente, nao permissao para inventar valores.

## WhatsApp

`lib/whatsapp.js` limpa o numero, normaliza textos, limita o tamanho final e codifica a URL. O numero vem do ambiente e possui fallback oficial. Nenhum dado e enviado antes do clique do cliente.

## Seguranca e performance

Headers e CSP ficam em `next.config.js`. O projeto nao possui segredos no frontend. Imagens usam `next/image`, os dados sao estaticos e o build e prerenderizado sempre que possivel.

## Pontos de manutencao

- Preserve a relacao entre IDs de categoria, produto e especificacao.
- Nao ofereca medidas que nao estejam no catalogo.
- Atualize resumo e WhatsApp juntos ao criar um campo.
- Teste os dois caminhos em mobile e desktop.
- Rode lint, build e `git diff --check` antes de publicar.
