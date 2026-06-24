# Implementação do Catálogo Comercial Completo

## Escopo

A Área de Vendas foi organizada como catálogo técnico e gerador de pré-orçamento. Não há preço, estoque, carrinho, checkout, login ou integração com Datasul.

Fontes utilizadas:

- catálogo PDF original mantido em armazenamento privado, fora do frontend
- `catalogo-estruturado.md`
- `especificacoes-extraidas.md`
- leitura visual das tabelas das páginas 3 a 12 do PDF

## Estrutura implementada

- 9 categorias comerciais
- 42 produtos e subprodutos
- 297 combinações técnicas cadastradas
- 31 imagens WebP extraídas do catálogo
- seleção dependente de medida, espessura e comprimento
- peso automático quando a combinação possui peso no catálogo
- resumo técnico e mensagem de WhatsApp completos

## Categorias e produtos

### Tubos Metálicos

- Tubo Retangular
- Tubo Quadrado
- Tubo Redondo

### Perfis Estruturais

- Perfil U Enrijecido
- Perfil U Simples

### Telhas Metálicas

- Telha Trapezoidal 40
- Telha Trapezoidal 25
- Telha Ondulada
- Cumeeiras

### Laminados

- Cantoneiras de Abas Iguais
- Barras Chatas
- Barras Quadradas
- Barras Redondas

### Chapas

- Chapas Planas
- Chapas Grossas
- Chapas Finas a Frio
- Chapas Finas a Quente
- Chapas de Piso

### Chapas Frisadas e Lambris

- Chapas Frisadas em U
- Chapa Meia Cana 1090 mm
- Chapa Meia Cana 545 mm
- Lambris

### Perfis para Serralheria

- Perfis para Portões de Elevação
- Perfis para Portas de Aço
- Perfis para Janelas de Aço

### Acessórios para Serralheria

- Roldanas
- Trilhos
- Fechos
- Dobradiças
- Guias
- Parafusos
- Discos de Corte
- Fechaduras
- Trincos
- Puxadores
- Thinner
- Consumíveis

### Tintas, Solventes e Consumíveis

- Solventes
- Primers
- Galvanizantes a Frio
- Thinner
- Consumíveis para Acabamento e Proteção

## Produtos com dados técnicos e peso

Os 19 produtos abaixo possuem combinações estruturadas e peso informado no catálogo:

- Tubos retangulares, quadrados e redondos: peso teórico em `kg/barra`
- Perfis U enrijecido e U simples: peso teórico em `kg/barra`
- Telhas trapezoidais 40 e 25 e telha ondulada: peso em `kg/m`
- Cantoneiras e barras chatas, quadradas e redondas: massa linear em `kg/m`
- Chapas grossas, finas a frio, finas a quente e de piso: massa em `kg/m²`
- Chapas frisadas em U e meias canas de 1090 mm e 545 mm: peso em `kg/peça`

## Produtos com dados incompletos

Permanecem com campo livre "Informe as características desejadas":

- Chapas Planas como família genérica
- Cumeeiras
- Lambris
- Perfis para portões de elevação
- Perfis para portas de aço
- Perfis para janelas de aço
- todos os acessórios para serralheria
- tintas, solventes, primers, galvanizantes e consumíveis

Esses itens aparecem visualmente no catálogo, mas não possuem tabela técnica individual completa e legível.

## Comprimentos

- Comprimentos só foram cadastrados quando aparecem explicitamente no catálogo.
- Cantoneiras: barra de 6 m indicada no cabeçalho da tabela.
- Chapas frisadas e meias canas: comprimentos específicos por peça.
- Tubos e perfis estruturais: o catálogo informa peso por barra, mas não declara o comprimento da barra nas páginas técnicas; o campo não foi inventado.

## Pontos que exigem confirmação comercial

- Cantoneira de 5 polegadas por 1/4: peso ilegível; combinação omitida.
- Barras chatas: última linha repetida como 3/8 no PDF; linha ambígua omitida.
- Chapas de piso: algumas equivalências entre polegada/MSG, milímetro e massa parecem inconsistentes; valores foram mantidos como impressos e sinalizados no dado.
- Cumeeiras, lambris, perfis de serralheria, acessórios e tintas não apresentam medidas e pesos completos.

## Imagens

As imagens foram recortadas das páginas do catálogo, convertidas para WebP e salvas em `public/catalog-products`.

Quando o catálogo apresenta somente uma composição de família, o mesmo recorte é reutilizado nos produtos relacionados. Nenhuma imagem externa foi utilizada.
