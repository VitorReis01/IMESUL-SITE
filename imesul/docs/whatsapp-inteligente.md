# WhatsApp Inteligente

## Objetivo

Transformar as escolhas do fluxo em uma mensagem comercial organizada. O recurso deve economizar tempo do cliente e fornecer contexto útil para o primeiro atendimento.

## Comportamento

1. O sistema reúne os dados preenchidos.
2. Campos vazios são omitidos ou indicados como "a confirmar".
3. A mensagem é codificada para uso em uma URL do WhatsApp.
4. O botão abre a conversa em uma nova aba ou no aplicativo.
5. O cliente pode editar a mensagem antes de enviá-la.

## Modelo inicial de mensagem

```text
Olá, equipe IMESUL! Gostaria de solicitar um orçamento.

Projeto: Portão
Materiais de interesse:
- Metalon
- Chapas
- Acessórios para serralheria

Medidas: 3,00 m x 2,20 m
Quantidade: 1
Cidade: Campo Grande - MS
Prazo desejado: a confirmar

Observações:
Preciso de ajuda para definir as espessuras.

Solicitação enviada pela Área de Vendas do site IMESUL.
```

## Regras de composição

- Usar linguagem clara e profissional.
- Não incluir campos vazios desnecessários.
- Evitar mensagens excessivamente longas.
- Preservar quebras de linha para facilitar a leitura.
- Identificar a origem como Área de Vendas do site.
- Não afirmar preço, estoque, prazo de entrega ou adequação técnica.
- Codificar o texto com `encodeURIComponent` antes de montar o link.

## Unidade de atendimento

Quando houver escolha de cidade ou unidade, o fluxo poderá direcionar a mensagem para o contato correspondente. Se essa regra ainda não estiver definida, deve ser utilizado o número comercial principal já aprovado no site.

## Fallback

Se o WhatsApp não abrir:

- Exibir a mensagem pronta.
- Oferecer uma ação para copiar o texto.
- Mostrar o número comercial de destino.
- Preservar o resumo para o cliente não perder as informações.

## Privacidade

- Evitar solicitar CPF, CNPJ ou outros dados sensíveis no fluxo inicial.
- Informar que o envio ao WhatsApp segue os termos do próprio serviço.
- Não armazenar conteúdo do orçamento sem necessidade e consentimento.
- Se houver analytics, registrar eventos do fluxo sem capturar as observações livres.

## Eventos futuros

- `sales_assistant_started`
- `project_selected`
- `products_selected`
- `quote_summary_viewed`
- `whatsapp_quote_opened`

Os nomes são sugestões e devem seguir o padrão de analytics adotado no projeto.
