import { catalogSpecifications } from "./catalogSpecifications";

// Normaliza produtos e deriva os indicadores de tabela tecnica automaticamente.
// Especificacoes e nota tecnica sao opcionais; os demais campos sao obrigatorios.
const product = ({
  id,
  categoryId,
  name,
  description,
  usage,
  image,
  specifications = null,
  technicalNote = "",
}) => ({
  id,
  categoryId,
  name,
  description,
  usage,
  image,
  specifications,
  technicalNote,
  hasStructuredOptions: Boolean(specifications?.variacoes?.length),
  hasCompleteData: Boolean(specifications?.dadosCompletos && specifications?.variacoes?.length),
});

// Para adicionar um item, use um ID unico e um categoryId existente.
// Vincule somente especificacoes extraidas e documentadas no catalogo oficial.
export const catalogProducts = [
  product({
    id: "tubo-retangular",
    categoryId: "tubos-metalicos",
    name: "Tubo Retangular",
    description: "Formato versátil para estruturas leves e médias com bom aproveitamento geométrico.",
    usage: ["Portões", "Estruturas", "Serralheria"],
    image: "/catalog-products/tubo-retangular.webp",
    specifications: catalogSpecifications.tubosMetalicos.retangular,
  }),
  product({
    id: "tubo-quadrado",
    categoryId: "tubos-metalicos",
    name: "Tubo Quadrado",
    description: "Perfil tubular para montagens que exigem simetria, estabilidade e acabamento limpo.",
    usage: ["Grades", "Móveis metálicos", "Estruturas"],
    image: "/catalog-products/tubo-quadrado.webp",
    specifications: catalogSpecifications.tubosMetalicos.quadrado,
  }),
  product({
    id: "tubo-redondo",
    categoryId: "tubos-metalicos",
    name: "Tubo Redondo",
    description: "Tubo metálico para serralheria, componentes e aplicações industriais diversas.",
    usage: ["Corrimãos", "Estruturas", "Indústria"],
    image: "/catalog-products/tubo-redondo.webp",
    specifications: catalogSpecifications.tubosMetalicos.redondo,
  }),

  product({
    id: "perfil-u-enrijecido",
    categoryId: "perfis-estruturais",
    name: "Perfil U Enrijecido",
    description: "Perfil conformado com abas enrijecidas para maior estabilidade estrutural.",
    usage: ["Galpões", "Coberturas", "Estruturas"],
    image: "/catalog-products/perfil-u-enrijecido.webp",
    specifications: catalogSpecifications.perfisEstruturais.uEnrijecido,
  }),
  product({
    id: "perfil-u-simples",
    categoryId: "perfis-estruturais",
    name: "Perfil U Simples",
    description: "Perfil estrutural de seção aberta para suportes, travamentos e estruturas metálicas.",
    usage: ["Suportes", "Reforços", "Coberturas"],
    image: "/catalog-products/perfil-u-simples.webp",
    specifications: catalogSpecifications.perfisEstruturais.uSimples,
  }),

  product({
    id: "telha-trapezoidal-40",
    categoryId: "telhas-metalicas",
    name: "Telha Trapezoidal 40",
    description: "Telha em aço galvalume com perfil trapezoidal para coberturas de maior exigência.",
    usage: ["Galpões", "Coberturas industriais", "Barracões"],
    image: "/catalog-products/telha-trapezoidal-40.webp",
    specifications: catalogSpecifications.telhasMetalicas.trapezoidal40,
  }),
  product({
    id: "telha-trapezoidal-25",
    categoryId: "telhas-metalicas",
    name: "Telha Trapezoidal 25",
    description: "Telha metálica para coberturas leves, comerciais e residenciais.",
    usage: ["Garagens", "Comércio", "Residências"],
    image: "/catalog-products/telha-trapezoidal-25.webp",
    specifications: catalogSpecifications.telhasMetalicas.trapezoidal25,
  }),
  product({
    id: "telha-ondulada",
    categoryId: "telhas-metalicas",
    name: "Telha Ondulada",
    description: "Perfil ondulado em aço galvalume para coberturas e fechamentos leves.",
    usage: ["Coberturas", "Fechamentos", "Área rural"],
    image: "/catalog-products/telha-ondulada.webp",
    specifications: catalogSpecifications.telhasMetalicas.ondulada,
  }),
  product({
    id: "cumeeiras",
    categoryId: "telhas-metalicas",
    name: "Cumeeiras",
    description: "Peças de acabamento para o encontro superior de telhados metálicos.",
    usage: ["Coberturas", "Arremates", "Vedação superior"],
    image: "/catalog-products/cumeeiras.webp",
    specifications: catalogSpecifications.telhasMetalicas.cumeeiras,
  }),

  product({
    id: "cantoneiras-abas-iguais",
    categoryId: "perfis-estruturais",
    name: "Cantoneiras de Abas Iguais",
    description: "Perfil laminado em L para reforços, suportes e montagens metálicas.",
    usage: ["Travamentos", "Suportes", "Estruturas"],
    image: "/catalog-products/cantoneiras.webp",
    specifications: catalogSpecifications.laminados.cantoneirasAbasIguais,
  }),
  product({
    id: "barras-chatas",
    categoryId: "laminados",
    name: "Barras Chatas",
    description: "Barras laminadas para fabricação de peças, reforços e componentes.",
    usage: ["Grades", "Suportes", "Fabricação"],
    image: "/catalog-products/barras-chatas.webp",
    specifications: catalogSpecifications.laminados.barrasChatas,
  }),
  product({
    id: "barras-quadradas",
    categoryId: "laminados",
    name: "Barras Quadradas",
    description: "Barras maciças de seção quadrada para componentes e serralheria.",
    usage: ["Eixos", "Grades", "Componentes"],
    image: "/catalog-products/barras-quadradas.webp",
    specifications: catalogSpecifications.laminados.barrasQuadradas,
  }),
  product({
    id: "barras-redondas",
    categoryId: "laminados",
    name: "Barras Redondas",
    description: "Barras maciças redondas para fabricação, usinagem e manutenção.",
    usage: ["Eixos", "Pinos", "Fabricação"],
    image: "/catalog-products/barras-redondas.webp",
    specifications: catalogSpecifications.laminados.barrasRedondas,
  }),

  product({
    id: "chapas-planas",
    categoryId: "chapas",
    name: "Chapas Planas",
    description: "Família de chapas para corte, dobra, fechamento e fabricação.",
    usage: ["Corte", "Dobra", "Fabricação"],
    image: "/catalog-products/chapas-planas.webp",
    specifications: catalogSpecifications.chapas.planas.generica,
  }),
  product({
    id: "chapas-grossas",
    categoryId: "chapas",
    name: "Chapas Grossas",
    description: "Chapas de maior espessura para bases, reforços e aplicações estruturais.",
    usage: ["Bases", "Reforços", "Indústria"],
    image: "/catalog-products/chapas-planas.webp",
    specifications: catalogSpecifications.chapas.planas.grossa,
  }),
  product({
    id: "chapas-finas-frio",
    categoryId: "chapas",
    name: "Chapas Finas a Frio",
    description: "Chapas com boa qualidade superficial para peças e acabamentos.",
    usage: ["Peças", "Dobras", "Acabamento"],
    image: "/catalog-products/chapas-planas.webp",
    specifications: catalogSpecifications.chapas.planas.finaFrio,
  }),
  product({
    id: "chapas-finas-quente",
    categoryId: "chapas",
    name: "Chapas Finas a Quente",
    description: "Chapas laminadas a quente para fabricação e aplicações gerais.",
    usage: ["Estruturas", "Fabricação", "Reforços"],
    image: "/catalog-products/chapas-planas.webp",
    specifications: catalogSpecifications.chapas.planas.finaQuente,
  }),
  product({
    id: "chapas-piso",
    categoryId: "chapas",
    name: "Chapas de Piso",
    description: "Chapas com superfície adequada para pisos, passarelas e acessos.",
    usage: ["Pisos", "Passarelas", "Acessos"],
    image: "/catalog-products/chapas-planas.webp",
    specifications: catalogSpecifications.chapas.planas.piso,
  }),

  product({
    id: "chapas-frisadas-u",
    categoryId: "chapas-frisadas-lambris",
    name: "Chapas Frisadas em U",
    description: "Chapa frisada para fechamentos e fabricação de portões.",
    usage: ["Portões", "Fechamentos", "Fachadas"],
    image: "/catalog-products/chapas-frisadas.webp",
    specifications: catalogSpecifications.chapas.frisadasELambris.frisadaU,
  }),
  product({
    id: "chapa-meia-cana-1090",
    categoryId: "chapas-frisadas-lambris",
    name: "Chapa Meia Cana 1090 mm",
    description: "Chapa perfilada meia cana para fechamentos metálicos largos.",
    usage: ["Portões", "Fechamentos", "Serralheria"],
    image: "/catalog-products/chapa-meia-cana-1090.webp",
    specifications: catalogSpecifications.chapas.frisadasELambris.meiaCana1090,
  }),
  product({
    id: "chapa-meia-cana-545",
    categoryId: "chapas-frisadas-lambris",
    name: "Chapa Meia Cana 545 mm",
    description: "Chapa perfilada compacta para painéis e fechamentos metálicos.",
    usage: ["Painéis", "Portões", "Acabamentos"],
    image: "/catalog-products/chapa-meia-cana-545.webp",
    specifications: catalogSpecifications.chapas.frisadasELambris.meiaCana545,
  }),
  product({
    id: "lambris",
    categoryId: "chapas-frisadas-lambris",
    name: "Lambris",
    description: "Solução de revestimento e fechamento para projetos de serralheria.",
    usage: ["Revestimentos", "Portões", "Fachadas"],
    image: "/catalog-products/chapas-frisadas.webp",
    specifications: catalogSpecifications.chapas.frisadasELambris.lambris,
  }),

  product({
    id: "perfis-portoes-elevacao",
    categoryId: "perfis-serralheria",
    name: "Perfis para Portões de Elevação",
    description: "Perfis e soluções para fabricação de portões basculantes e de elevação.",
    usage: ["Portões basculantes", "Garagens", "Serralheria"],
    image: "/catalog-products/perfis-portoes-elevacao.webp",
    specifications: catalogSpecifications.perfisSerralheria.portoesElevacao,
  }),
  product({
    id: "perfis-portas-aco",
    categoryId: "perfis-serralheria",
    name: "Perfis para Portas de Aço",
    description: "Perfis destinados à produção de portas, portas de enrolar e esquadrias.",
    usage: ["Portas", "Esquadrias", "Comércio"],
    image: "/catalog-products/perfis-portas-aco.webp",
    specifications: catalogSpecifications.perfisSerralheria.portasAco,
  }),
  product({
    id: "perfis-janelas-aco",
    categoryId: "perfis-serralheria",
    name: "Perfis para Janelas de Aço",
    description: "Perfis para janelas, grades e conjuntos metálicos sob medida.",
    usage: ["Janelas", "Grades", "Esquadrias"],
    image: "/catalog-products/perfis-janelas-aco.webp",
    specifications: catalogSpecifications.perfisSerralheria.janelasAco,
  }),

  ...[
    ["roldanas", "Roldanas", "Movimentação de portões e estruturas móveis.", "/catalog-products/roldanas.webp"],
    ["trilhos", "Trilhos", "Guiamento de portões e sistemas deslizantes.", "/catalog-products/acessorios-serralheria.webp"],
    ["fechos", "Fechos", "Travamento e fechamento de portas e portões.", "/catalog-products/fechos.webp"],
    ["dobradicas", "Dobradiças", "Articulação de portas, portões e painéis.", "/catalog-products/dobradicas.webp"],
    ["guias", "Guias", "Condução e alinhamento de sistemas móveis.", "/catalog-products/guias.webp"],
    ["parafusos", "Parafusos", "Fixação e montagem de componentes metálicos.", "/catalog-products/parafusos.webp"],
    ["discos-corte", "Discos de Corte", "Corte e preparação de peças metálicas.", "/catalog-products/discos-corte.webp"],
    ["fechaduras", "Fechaduras", "Segurança para portas e portões metálicos.", "/catalog-products/fechaduras.webp"],
    ["trincos", "Trincos", "Fechamento mecânico de portas e janelas.", "/catalog-products/fechos.webp"],
    ["puxadores", "Puxadores", "Acionamento e acabamento de portas e portões.", "/catalog-products/puxadores.webp"],
    ["consumiveis-acessorios", "Consumíveis", "Itens de apoio para solda, corte e montagem.", "/catalog-products/consumiveis.webp"],
  ].map(([id, name, description, image]) =>
    product({
      id,
      categoryId: "acessorios-serralheria",
      name,
      description,
      usage: ["Serralheria", "Montagem", "Manutenção"],
      image,
      specifications: catalogSpecifications.acessorios,
    })
  ),

  ...[
    ["primers", "Primers", "Preparação de superfícies metálicas antes do acabamento.", "/catalog-products/tintas-solventes.webp"],
    ["galvanizantes-frio", "Galvanizantes a Frio", "Proteção de áreas metálicas e pontos de manutenção.", "/catalog-products/tintas-solventes.webp"],
    ["consumiveis-acabamento", "Consumíveis para Acabamento e Proteção", "Itens complementares para acabamento de estruturas metálicas.", "/catalog-products/consumiveis.webp"],
  ].map(([id, name, description, image]) =>
    product({
      id,
      categoryId: "tintas-solventes-consumiveis",
      name,
      description,
      usage: ["Preparação", "Proteção", "Acabamento"],
      image,
      specifications: catalogSpecifications.tintasSolventes,
    })
  ),

  ...[
    ["solventes", "Solventes", "Produtos para limpeza, preparação e diluição.", "/catalog-products/tintas-solventes.webp", catalogSpecifications.tintasSolventes],
    ["thinner", "Thinner", "Diluição e limpeza em processos de pintura e serralheria.", "/catalog-products/tintas-solventes.webp", catalogSpecifications.tintasSolventes],
  ].map(([id, name, description, image, specifications]) =>
    product({
      id,
      categoryId: "thinner-fixadores",
      name,
      description,
      usage: ["Diluição", "Limpeza", "Preparação"],
      image,
      specifications,
    })
  ),
];

// Filtra os cards exibidos depois que o cliente escolhe uma categoria.
export function getCatalogProductsByCategory(categoryId) {
  return catalogProducts.filter((item) => item.categoryId === categoryId);
}

// Localiza o produto selecionado pelo ProjectSelector.
export function getCatalogProduct(productId) {
  return catalogProducts.find((item) => item.id === productId);
}
