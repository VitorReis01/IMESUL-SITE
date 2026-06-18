import {
  AlignJustify,
  Box,
  CircleDot,
  FlaskConical,
  Layers3,
  Minus,
  PanelsTopLeft,
  Waves,
} from "lucide-react";

export const materials = [
  {
    id: "tubos-metalicos",
    name: "Tubos Metálicos",
    description: "Redondos, quadrados e retangulares.",
    icon: CircleDot,
  },
  {
    id: "chapas",
    name: "Chapas",
    description: "Lisas, grossas, finas, frisadas e de piso.",
    icon: Layers3,
  },
  {
    id: "perfis-estruturais",
    name: "Perfis Estruturais",
    description: "Perfil U simples e U enrijecido.",
    icon: PanelsTopLeft,
  },
  {
    id: "telhas-metalicas",
    name: "Telhas Metálicas",
    description: "Trapezoidais, onduladas e cumeeiras.",
    icon: Waves,
  },
  {
    id: "cantoneiras",
    name: "Cantoneiras",
    description: "Abas iguais e desiguais para reforços e estruturas.",
    icon: AlignJustify,
  },
  {
    id: "barras",
    name: "Barras",
    description: "Barras de aço para fabricação e serralheria.",
    icon: Minus,
  },
  {
    id: "bobininhas",
    name: "Bobininhas",
    description: "Rolos metálicos para arremates e aplicações diversas.",
    icon: Box,
  },
  {
    id: "solventes-acessorios",
    name: "Solventes e Acessórios",
    description: "Preparação, proteção, acabamento e montagem.",
    icon: FlaskConical,
  },
];

export function getMaterialsByIds(ids) {
  return ids
    .map((id) => materials.find((material) => material.id === id))
    .filter(Boolean);
}
