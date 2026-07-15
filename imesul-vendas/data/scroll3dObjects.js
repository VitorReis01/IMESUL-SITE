// Define os modelos GLB usados nos pontos fixos do efeito 3D durante o scroll.
// Somente estes arquivos devem entrar no deploy enquanto o efeito usa tres materiais.
export const scroll3dObjects = [
  {
    id: "telha-metalica",
    label: "Telha metálica",
    path: "/models/3d/telha.glb",
    anchors: ["project-path", "catalog-showcase"],
    targetSize: 3.4,
  },
  {
    id: "perfil-u-simples",
    label: "Perfil U simples",
    path: "/models/3d/perfil-u-simples.glb",
    anchors: ["material-path"],
    targetSize: 3,
  },
  {
    id: "tubo-quadrado",
    label: "Tubo quadrado",
    path: "/models/3d/tubo-quadrado.glb",
    anchors: ["quote-steps"],
    targetSize: 3.1,
  },
];
