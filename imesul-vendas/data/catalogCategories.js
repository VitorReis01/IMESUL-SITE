import {
  AlignJustify,
  CircleDot,
  DoorOpen,
  FlaskConical,
  Grid3X3,
  Layers3,
  PanelsTopLeft,
  Waves,
  Wrench,
} from "lucide-react";

// Categorias exibidas antes dos produtos; ID, nome, imagem e icone sao obrigatorios.
// ProductCatalog usa o ID para buscar os itens correspondentes.
export const catalogCategories = [
  {
    id: "tubos-metalicos",
    name: "Tubos Metálicos",
    description: "Tubos para estruturas, portões, serralheria e aplicações industriais.",
    image: "/catalog-products/tubo-retangular.webp",
    icon: CircleDot,
  },
  {
    id: "perfis-estruturais",
    name: "Perfis Estruturais",
    description: "Perfis U para coberturas, galpões, reforços e estruturas sob medida.",
    image: "/catalog-products/perfil-u-enrijecido.webp",
    icon: PanelsTopLeft,
  },
  {
    id: "telhas-metalicas",
    name: "Telhas Metálicas",
    description: "Coberturas em aço galvalume para projetos residenciais, comerciais e rurais.",
    image: "/catalog-products/telha-trapezoidal-40.webp",
    icon: Waves,
  },
  {
    id: "laminados",
    name: "Barras",
    description: "Barras laminadas para fabricação, reforço e montagem estrutural.",
    image: "/catalog-products/barras-chatas.webp",
    icon: AlignJustify,
  },
  {
    id: "chapas",
    name: "Chapas",
    description: "Chapas planas, finas, grossas e de piso para corte e fabricação.",
    image: "/catalog-products/chapas-planas.webp",
    icon: Layers3,
  },
  {
    id: "chapas-frisadas-lambris",
    name: "Chapas Frisadas e Lambris",
    description: "Soluções de fechamento e acabamento para portões, fachadas e serralheria.",
    image: "/catalog-products/chapas-frisadas.webp",
    icon: Grid3X3,
  },
  {
    id: "perfis-serralheria",
    name: "Perfis para Serralheria",
    description: "Perfis destinados a portões, portas e janelas de aço.",
    image: "/catalog-products/perfis-portoes-elevacao.webp",
    icon: DoorOpen,
  },
  {
    id: "acessorios-serralheria",
    name: "Acessórios",
    description: "Ferragens, roldanas, guias, fechaduras e itens para montagem.",
    image: "/catalog-products/acessorios-serralheria.webp",
    icon: Wrench,
  },
  {
    id: "thinner-fixadores",
    name: "Thinner e Solventes",
    description: "Thinner e solventes para diluição, limpeza e preparação para pintura.",
    image: "/catalog-products/tintas-solventes.webp",
    icon: FlaskConical,
  },
  {
    id: "tintas-solventes-consumiveis",
    name: "Tintas, Solventes e Consumíveis",
    description: "Produtos para preparação, proteção e acabamento de estruturas metálicas.",
    image: "/catalog-products/tintas-solventes.webp",
    icon: FlaskConical,
  },
];

// Resolve o rotulo da categoria usado no formulario, resumo e WhatsApp.
export function getCatalogCategory(categoryId) {
  return catalogCategories.find((category) => category.id === categoryId);
}
