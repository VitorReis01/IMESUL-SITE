# Especificações extraídas do Catálogo IMESUL 2024

## Fonte e método

- Fonte: catálogo PDF original mantido em armazenamento privado, fora do frontend
- Arquivo de dados: `data/catalogSpecifications.js`
- O PDF é composto por imagens e não possui camada de texto pesquisável.
- As páginas técnicas foram revisadas visualmente em resolução original.
- Somente valores claramente legíveis foram transcritos.
- Pesos teóricos e massas não foram incluídos nesta etapa.

## Categorias processadas

### Tubos metálicos

Extração concluída para:

- Tubos retangulares
- Tubos quadrados
- Tubos redondos

Foram registradas as combinações legíveis entre dimensão e espessura. O catálogo não informa explicitamente o comprimento das barras nessas tabelas, portanto `comprimentos` permanece vazio.

### Perfis estruturais

Extração concluída para:

- Perfil U enrijecido
- Perfil U simples

Foram registradas as combinações entre dimensão e espessura. O comprimento não aparece claramente nas tabelas.

### Telhas metálicas

Extração concluída para:

- Telha trapezoidal 40
- Telha trapezoidal 25
- Telha ondulada

Foram registrados largura, passo, altura do perfil e espessuras de 0,43 mm e 0,50 mm.

As cumeeiras aparecem somente como imagens. Não há medidas legíveis para extração.

### Laminados

Dados extraídos para:

- Cantoneiras de abas iguais
- Barras chatas
- Barras quadradas
- Barras redondas

As cantoneiras indicam barras de 6 metros. Para cantoneiras e barras chatas, as larguras e espessuras foram preservadas como listas independentes porque a matriz completa de combinações exige validação adicional.

Uma linha da tabela de barras chatas aparece repetida como `3/8"` e não foi incluída.

### Chapas planas

Espessuras extraídas para:

- Chapas finas a frio (FF)
- Chapas finas a quente (FQ)
- Chapas grossas (CG)
- Chapas de piso (CP)

O catálogo não apresenta largura e comprimento das chapas nessa página.

A tabela de chapa de piso associa `1/4"` a `3,30 mm`. O valor foi mantido conforme o documento, mas precisa de validação comercial antes de ser exibido ao cliente.

### Chapas frisadas e lambris

Extração concluída para:

- Chapa frisada em U: largura de 1095 mm e comprimentos de 1800 a 2500 mm
- Chapa meia cana de 1090 mm: comprimentos de 1800 a 3000 mm
- Chapa meia cana de 545 mm: comprimentos de 2000 a 3000 mm

Também foram preservadas as referências de chapa `#22` e `#20`.

### Perfis para serralheria

Não foi possível extrair medidas. A página apresenta aplicações para portões, portas e janelas, mas não contém tabela técnica.

### Acessórios para serralheria

Não foi possível extrair medidas. A página funciona como catálogo visual de itens e não apresenta dimensões, espessuras ou comprimentos.

## Categorias com dados técnicos encontrados

1. Tubos metálicos
2. Perfis estruturais
3. Telhas metálicas
4. Laminados
5. Chapas planas
6. Chapas frisadas e lambris

## Categorias sem dados técnicos suficientes

1. Perfis para serralheria
2. Acessórios para serralheria
3. Cumeeiras

## Pontos para validação futura

- Comprimento comercial dos tubos e perfis estruturais.
- Combinações exatas entre largura e espessura de cantoneiras e barras chatas.
- Medidas das cumeeiras.
- Dimensões padrão das chapas planas.
- Divergência aparente na equivalência de `1/4"` da chapa de piso.
- Disponibilidade atual de cada medida nas unidades da IMESUL.

## Escopo da base

Esta base prepara a próxima etapa de implementação de selects dependentes. Ela ainda não deve ser usada para cálculo de peso, preço, estoque ou disponibilidade.
