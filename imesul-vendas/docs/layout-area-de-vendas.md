# Layout da Área de Vendas

## Direção visual

A Área de Vendas deve continuar a experiência premium e industrial do site, com fundo escuro, tipografia forte, vermelho IMESUL e imagens de produto em destaque. A interface precisa ser mais funcional que promocional, sem perder a identidade cinematográfica existente.

Não deve parecer marketplace:

- Sem grade extensa de produtos na primeira tela.
- Sem preços, descontos, carrinho ou selos promocionais.
- Sem excesso de cards, filtros ou informações simultâneas.
- Sem competição visual entre etapas e chamadas para ação.

## Arquitetura da página

### 1. Introdução

- Título curto.
- Explicação de uma frase.
- Pergunta principal: **"O que você está construindo?"**

### 2. Escolha do projeto

- Opções claras para os sete projetos iniciais.
- Uma única seleção por vez.
- Ícones ou imagens discretas, quando existirem assets aprovados.

### 3. Materiais recomendados

- Lista curta derivada do projeto.
- Seleção simples e editável.
- Acesso secundário ao catálogo completo.

### 4. Medidas e detalhes

- Campos opcionais.
- Unidades de medida explícitas.
- Explicações breves apenas quando necessárias.

### 5. Resumo

- Projeto e materiais em ordem de leitura.
- Dados opcionais preenchidos.
- Ação para editar.
- Aviso de validação comercial.

### 6. Conversão

- Botão principal **Falar no WhatsApp**.
- Fallback para copiar a mensagem.

## Comportamento responsivo

### Mobile

- Uma etapa principal por tela.
- Alvos de toque confortáveis.
- Barra de progresso compacta.
- Resumo em coluna única.
- CTA visível sem cobrir conteúdo.

### Desktop

- Conteúdo centralizado com largura controlada.
- Possibilidade de mostrar etapa e resumo lado a lado.
- Navegação entre etapas sem rolagem confusa.
- Imagens usadas como apoio, nunca como obstáculo ao formulário.

## Estados necessários

- Estado inicial.
- Projeto selecionado.
- Recomendações carregadas.
- Sem seleção.
- Campos inválidos.
- Resumo pronto.
- Redirecionamento ao WhatsApp.
- Falha ao abrir WhatsApp.

## Acessibilidade

- Navegação completa por teclado.
- Foco visível.
- Contraste adequado.
- Rótulos associados aos campos.
- Mensagens de erro objetivas.
- Sem depender apenas de cor para indicar seleção.
- Respeito a `prefers-reduced-motion`.

## Integração com o site atual

A implementação futura deve ser isolada da homepage existente. Não deve alterar Hero, Navbar, Footer, ProductScrollExperience, imagens ou animações atuais sem uma decisão específica de design.
