import { catalogCategories } from "./catalogCategories";
import { getCatalogProductsByCategory } from "./catalogProducts";

// Resume categorias para o caminho por projeto e lista seus produtos como subcategorias.
export const materials = catalogCategories.map((category) => ({
  ...category,
  subcategories: getCatalogProductsByCategory(category.id).map((item) => item.name),
}));

// Compatibiliza IDs antigos dos projetos com as categorias atuais do catalogo.
const materialAliases = {
  chapas: "chapas",
  "chapas-planas": "chapas",
  cantoneiras: "laminados",
  barras: "laminados",
  "solventes-acessorios": "tintas-solventes-consumiveis",
};

// Resolve recomendacoes, remove aliases duplicados e ignora IDs sem cadastro.
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
