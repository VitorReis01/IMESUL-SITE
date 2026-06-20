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

export const materials = [
  {
    id: "tubos-metalicos",
    name: "Tubos Metálicos",
    description:
      "Soluções versáteis para estruturas, serralheria, portões e aplicações industriais.",
    subcategories: [
      "Tubos retangulares",
      "Tubos quadrados",
      "Tubos redondos",
    ],
    icon: CircleDot,
  },
  {
    id: "perfis-estruturais",
    name: "Perfis Estruturais",
    description:
      "Perfis de aço para coberturas, galpões, mezaninos, reforços e estruturas sob medida.",
    subcategories: ["Perfil U enrijecido", "Perfil U simples"],
    icon: PanelsTopLeft,
  },
  {
    id: "telhas-metalicas",
    name: "Telhas Metálicas",
    description:
      "Coberturas resistentes em aço galvalume para projetos residenciais, comerciais e rurais.",
    subcategories: [
      "Telha trapezoidal 40",
      "Telha trapezoidal 25",
      "Telha ondulada",
      "Cumeeiras",
    ],
    icon: Waves,
  },
  {
    id: "laminados",
    name: "Laminados",
    description:
      "Cantoneiras e barras para fabricação, reforços, suportes e estruturas metálicas.",
    subcategories: [
      "Cantoneiras de abas iguais",
      "Barras chatas",
      "Barras quadradas",
      "Barras redondas",
    ],
    icon: AlignJustify,
  },
  {
    id: "chapas-planas",
    name: "Chapas Planas",
    description:
      "Chapas para fechamentos, dobras, bases, reforços, pisos e fabricação industrial.",
    subcategories: [
      "Chapas finas a frio (FF)",
      "Chapas finas a quente (FQ)",
      "Chapas grossas (CG)",
      "Chapas de piso (CP)",
    ],
    icon: Layers3,
  },
  {
    id: "chapas-frisadas-lambris",
    name: "Chapas Frisadas e Lambris",
    description:
      "Linha de acabamento e fechamento para portões, fachadas e projetos de serralheria.",
    subcategories: [
      "Chapas frisadas em U",
      "Chapa meia cana de 1090 mm",
      "Chapa meia cana de 545 mm",
    ],
    icon: Grid3X3,
  },
  {
    id: "perfis-serralheria",
    name: "Perfis para Serralheria",
    description:
      "Perfis específicos para portões, portas, janelas, grades e esquadrias de aço.",
    subcategories: [
      "Perfis para portões de elevação",
      "Perfis para portas de aço",
      "Perfis para janelas de aço",
    ],
    icon: DoorOpen,
  },
  {
    id: "acessorios-serralheria",
    name: "Acessórios para Serralheria",
    description:
      "Ferragens, roldanas, guias, fechaduras e consumíveis para montagem e acabamento.",
    subcategories: [
      "Movimentação e guias",
      "Ferragens para portões e portas",
      "Fechaduras e puxadores",
      "Acabamento e montagem",
    ],
    icon: Wrench,
  },
  {
    id: "tintas-solventes-consumiveis",
    name: "Tintas, Solventes e Consumíveis",
    description:
      "Produtos para proteção, preparação, pintura, solda, corte e vedação de estruturas.",
    subcategories: [
      "Tintas para proteção e acabamento",
      "Thinner e solventes",
      "Consumíveis de solda e corte",
    ],
    icon: FlaskConical,
  },
];

const materialAliases = {
  chapas: "chapas-planas",
  cantoneiras: "laminados",
  barras: "laminados",
  "solventes-acessorios": "tintas-solventes-consumiveis",
};

export function getMaterialsByIds(ids) {
  const uniqueIds = ids.map((id) => materialAliases[id] ?? id);

  return uniqueIds
    .map((id) => materials.find((material) => material.id === id))
    .filter(
      (material, index, resolvedMaterials) =>
        material &&
        resolvedMaterials.findIndex((item) => item?.id === material.id) === index
    );
}
