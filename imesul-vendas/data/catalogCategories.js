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
    description: "Tubos metálicos, metalons e opções para estruturas, portões e serralheria.",
    image: "/catalog-products/tubo-retangular.webp",
    icon: CircleDot,
  },
  {
    id: "perfis-estruturais",
    name: "Perfis Estruturais",
    description: "Perfis U e cantoneiras usados em coberturas, galpões e reforços.",
    image: "/catalog-products/perfil-u-enrijecido.webp",
    icon: PanelsTopLeft,
  },
  {
    id: "telhas-metalicas",
    name: "Telhas Metálicas",
    description: "Telhas e cumeeiras para cobertura residencial, comercial e rural.",
    image: "/catalog-products/telha-trapezoidal-40.webp",
    icon: Waves,
  },
  {
    id: "laminados",
    name: "Barras",
    description: "Barras chatas, redondas e quadradas para fabricação e manutenção.",
    image: "/catalog-products/barras-chatas.webp",
    icon: AlignJustify,
  },
  {
    id: "chapas",
    name: "Chapas",
    description: "Chapas para corte, dobra, piso, fechamento e fabricação de peças.",
    image: "/catalog-products/chapas-planas.webp",
    icon: Layers3,
  },
  {
    id: "telas-e-bobininhas",
    name: "Telas e Bobininhas",
    description: "Telas eletrossoldadas e bobininhas galvanizadas para cercamentos, reforços e aplicações rurais.",
    image: "/images/vendas/materiais/categoria-telas-e-bobininhas.webp",
    icon: Grid3X3,
  },
  {
    id: "perfis-serralheria",
    name: "KIT PARA PORTÃO",
    description: "Kits completos para montagem de portões, vendidos por unidade de caixa.",
    image: "/catalog-products/perfis-portoes-elevacao.webp",
    icon: DoorOpen,
  },
  {
    id: "acessorios-serralheria",
    name: "Acessórios",
    description: "Roldanas, guias, fechaduras, dobradiças e itens de montagem.",
    image: "/catalog-products/acessorios-serralheria.webp",
    icon: Wrench,
  },
  {
    id: "thinner-fixadores",
    name: "Thinner e Solventes",
    description: "Thinner, solventes e itens de apoio para acabamento.",
    image: "/catalog-products/tintas-solventes.webp",
    icon: FlaskConical,
  },
  {
    id: "tintas-solventes-consumiveis",
    name: "Tintas e Consumíveis",
    description: "Tintas, primers, galvanizantes e consumíveis para proteção das peças.",
    image: "/catalog-products/tintas-solventes.webp",
    icon: FlaskConical,
  },
];

// Resolve o rotulo da categoria usado no formulario, resumo e WhatsApp.
export function getCatalogCategory(categoryId) {
  return catalogCategories.find((category) => category.id === categoryId);
}
