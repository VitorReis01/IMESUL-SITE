# Projetos dos Clientes

## Objetivo

Traduzir necessidades reais em pontos de entrada simples. Cada projeto deve sugerir materiais comuns sem assumir medidas, especificações ou responsabilidade técnica.

## Mapeamento inicial

### Portão

Recomendações iniciais:

- Metalon
- Chapas
- Cantoneiras
- Barras
- Acessórios para serralheria
- Solventes e acessórios

### Cobertura

Recomendações iniciais:

- Telhas metálicas
- Perfis estruturais
- Tubos metálicos
- Metalon
- Cantoneiras
- Bobininhas

### Galpão

Recomendações iniciais:

- Perfis estruturais
- Telhas metálicas
- Tubos metálicos
- Chapas
- Cantoneiras
- Bobininhas

### Estrutura Metálica

Recomendações iniciais:

- Perfis estruturais
- Tubos metálicos
- Chapas
- Cantoneiras
- Barras

### Serralheria

Recomendações iniciais:

- Metalon
- Tubos metálicos
- Chapas
- Cantoneiras
- Barras
- Solventes e acessórios
- Acessórios para serralheria

### Rural

Recomendações iniciais:

- Tubos metálicos
- Telhas metálicas
- Perfis estruturais
- Chapas
- Cantoneiras
- Barras

### Outro / Preciso de ajuda

Não pré-selecionar materiais. Solicitar uma descrição curta do projeto e permitir que o cliente consulte o catálogo completo.

## Estrutura sugerida

```js
{
  id: "portao",
  name: "Portão",
  prompt: "Que tipo de portão você pretende construir?",
  recommendedProductIds: [
    "metalon",
    "chapas",
    "cantoneiras",
    "barras",
    "acessorios-serralheria",
    "solventes-acessorios"
  ]
}
```

## Regras das recomendações

- Exibir primeiro os materiais mais prováveis.
- Limitar a lista inicial para evitar sobrecarga.
- Permitir inclusão e remoção de qualquer categoria.
- Informar que a seleção será validada pela equipe comercial.
- Não sugerir quantidades ou dimensionamento estrutural sem dados técnicos.
- Validar este mapeamento com vendas antes da publicação.
