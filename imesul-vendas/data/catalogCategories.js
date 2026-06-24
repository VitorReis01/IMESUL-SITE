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
    name: "Laminados",
    description: "Cantoneiras e barras para fabricação, reforço e montagem estrutural.",
    image: "/catalog-products/cantoneiras.webp",
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
    name: "Acessórios para Serralheria",
    description: "Ferragens, roldanas, guias, fechaduras e itens para montagem.",
    image: "/catalog-products/acessorios-serralheria.webp",
    icon: Wrench,
  },
  {
    id: "tintas-solventes-consumiveis",
    name: "Tintas, Solventes e Consumíveis",
    description: "Produtos para preparação, proteção e acabamento de estruturas metálicas.",
    image: "/catalog-products/tintas-solventes.webp",
    icon: FlaskConical,
  },
];

export function getCatalogCategory(categoryId) {
  return catalogCategories.find((category) => category.id === categoryId);
}
