# Catálogo de Produtos

## Objetivo

Manter uma fonte organizada para as categorias usadas pela experiência de pré-orçamento. O catálogo deve atender tanto à navegação direta quanto às recomendações por projeto.

## Categorias iniciais

| ID sugerido | Nome | Uso geral |
| --- | --- | --- |
| `tubos-metalicos` | Tubos metálicos | Estruturas, condução e fabricação |
| `chapas` | Chapas | Fechamentos, bases, reforços e fabricação |
| `perfis-estruturais` | Perfis estruturais | Estruturas e suportes |
| `telhas-metalicas` | Telhas metálicas | Coberturas e fechamentos |
| `cantoneiras` | Cantoneiras | Reforços, quadros e estruturas |
| `barras` | Barras | Fabricação, reforço e serralheria |
| `metalon` | Metalon | Portões, móveis, quadros e estruturas leves |
| `bobininhas` | Bobininhas | Arremates e aplicações metálicas diversas |
| `solventes-acessorios` | Solventes e acessórios | Preparação, acabamento e apoio à fabricação |
| `acessorios-serralheria` | Acessórios para serralheria | Montagem, acabamento e instalação |

## Estrutura de dados sugerida

```js
{
  id: "metalon",
  name: "Metalon",
  shortDescription: "Perfis tubulares para estruturas leves e serralheria.",
  image: "/products/metalon.png",
  active: true,
  projectIds: ["portao", "serralheria", "cobertura"],
  keywords: ["quadrado", "retangular", "tubo", "serralheria"]
}
```

## Regras editoriais

- Usar nomes comerciais reconhecidos pelos clientes.
- Complementar termos técnicos com explicações curtas.
- Não duplicar categorias apenas para variar nomenclatura.
- Evitar descrições promocionais longas dentro do fluxo.
- Utilizar imagens consistentes com a identidade visual atual.
- Manter IDs estáveis, sem acentos e em `kebab-case`.
- Separar dados de catálogo da apresentação visual.

## Informações futuras por produto

Quando houver dados validados pela IMESUL, cada categoria poderá receber:

- Variações e formatos.
- Espessuras e dimensões disponíveis.
- Acabamentos.
- Aplicações comuns.
- Unidade de venda.
- Unidade ou região de atendimento.
- Observações técnicas.

Esses dados não fazem parte do primeiro MVP e não devem ser inventados durante a implementação.

## Integração com projetos

As relações entre projetos e produtos funcionam como recomendações iniciais, não como regras rígidas. O cliente sempre poderá editar a seleção antes de abrir o WhatsApp.
