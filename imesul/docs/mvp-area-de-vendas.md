# MVP da Área de Vendas

## Objetivo do MVP

Validar se uma jornada orientada por projeto gera solicitações de orçamento mais completas e aumenta os contatos comerciais pelo WhatsApp.

## Incluído

- Entrada pela aba Produtos.
- Pergunta "O que você está construindo?".
- Sete projetos iniciais.
- Recomendações de categorias por projeto.
- Seleção e remoção de materiais.
- Acesso às dez categorias do catálogo.
- Medidas, quantidade, cidade, prazo e observações opcionais.
- Resumo editável.
- Geração de mensagem para WhatsApp.
- Fallback para copiar a mensagem.
- Layout responsivo e acessível.

## Não incluído

- Carrinho de compras.
- Pagamento.
- Login ou conta do cliente.
- Preços em tempo real.
- Estoque em tempo real.
- Cálculo automático de frete.
- Orçamento final em PDF.
- Dimensionamento ou cálculo estrutural.
- Recomendação técnica garantida.
- Marketplace com busca e filtros avançados.
- Painel administrativo.
- Persistência de solicitações em banco de dados.

## Fases de implementação

### Fase 1: base de dados

- Consolidar IDs de projetos e produtos.
- Validar o mapeamento de recomendações com a equipe de vendas.
- Confirmar números de WhatsApp e regras por unidade.

### Fase 2: fluxo funcional

- Criar a rota ou experiência da aba Produtos.
- Implementar estado, navegação entre etapas e validações.
- Gerar resumo e mensagem de WhatsApp.

### Fase 3: acabamento visual

- Aplicar identidade IMESUL.
- Integrar imagens aprovadas.
- Ajustar transições e responsividade.
- Revisar acessibilidade.

### Fase 4: validação

- Testar os sete tipos de projeto.
- Testar sem medidas e com dados parciais.
- Testar WhatsApp em desktop e mobile.
- Validar conteúdo com a equipe comercial.
- Medir conversão após publicação.

## Critérios de aceite

- O cliente conclui o fluxo sem conhecimento técnico prévio.
- É possível avançar sem informar medidas.
- As recomendações podem ser editadas.
- O resumo reproduz corretamente as escolhas.
- A mensagem do WhatsApp é legível e não contém campos indevidos.
- Nenhuma etapa promete preço, estoque ou cálculo técnico.
- A experiência funciona em mobile e desktop.
- A homepage e seus componentes atuais permanecem inalterados.

## Decisões pendentes

- Rota final da área.
- Número principal e números por unidade.
- Mapeamento comercial definitivo entre projetos e produtos.
- Campos realmente necessários para vendas.
- Necessidade de analytics e ferramenta escolhida.
- Política de persistência durante a sessão.

## Próximo passo

Antes de iniciar a interface, validar esta documentação com representantes de vendas de Campo Grande e Dourados. A implementação deve começar somente após o catálogo, as recomendações e o destino do WhatsApp estarem aprovados.
