# Fluxo de Pré-Orçamento

## Papel do fluxo

O fluxo organiza uma solicitação comercial inicial. Ele não calcula preço, não confirma estoque, não define especificações estruturais e não gera um orçamento vinculante.

## Sequência

```text
Produtos
  ↓
Escolha do projeto
  ↓
Materiais recomendados
  ↓
Seleção de produtos
  ↓
Medidas e observações opcionais
  ↓
Resumo
  ↓
WhatsApp com mensagem pronta
```

## Etapa 1: projeto

Campo obrigatório:

- Tipo de projeto.

Opções:

- Portão
- Cobertura
- Galpão
- Estrutura Metálica
- Serralheria
- Rural
- Outro / Preciso de ajuda

## Etapa 2: produtos

O sistema carrega recomendações iniciais conforme o projeto. O cliente pode:

- Manter uma recomendação.
- Remover uma recomendação.
- Adicionar outra categoria.
- Informar que precisa de ajuda para escolher.

Ao menos um produto ou a opção de ajuda deve estar selecionado para continuar.

## Etapa 3: detalhes opcionais

Campos sugeridos:

- Largura.
- Comprimento.
- Altura.
- Quantidade.
- Unidade de medida.
- Cidade ou unidade de preferência.
- Prazo desejado.
- Observações.

Os campos devem aceitar informações incompletas. O cliente não deve ser bloqueado por não conhecer uma medida.

## Etapa 4: resumo

O resumo deve mostrar:

- Projeto escolhido.
- Categorias selecionadas.
- Medidas informadas.
- Quantidade, quando disponível.
- Cidade ou unidade de preferência.
- Observações.
- Aviso de que especificações, estoque e valores serão confirmados pela equipe.

O cliente poderá voltar e editar qualquer etapa.

## Etapa 5: envio

O botão principal abre o WhatsApp da unidade ou canal comercial definido. A mensagem será gerada conforme o padrão descrito em [WhatsApp inteligente](./whatsapp-inteligente.md).

## Dados mínimos do estado

```js
{
  projectId: "",
  selectedProductIds: [],
  dimensions: {
    width: "",
    length: "",
    height: "",
    unit: "m"
  },
  quantity: "",
  city: "",
  preferredUnit: "",
  deadline: "",
  notes: "",
  needsHelp: false
}
```

Esta estrutura é uma referência inicial e poderá ser ajustada durante a implementação.

## Regras de segurança comercial

- Não prometer disponibilidade.
- Não exibir preço estimado sem uma fonte comercial confiável.
- Não recomendar dimensionamento estrutural como cálculo de engenharia.
- Não coletar dados pessoais desnecessários antes do WhatsApp.
- Identificar as recomendações como ponto de partida sujeito à validação da IMESUL.
