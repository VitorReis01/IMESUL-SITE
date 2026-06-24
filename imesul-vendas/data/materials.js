import { catalogCategories } from "./catalogCategories";
import { getCatalogProductsByCategory } from "./catalogProducts";

export const materials = catalogCategories.map((category) => ({
  ...category,
  subcategories: getCatalogProductsByCategory(category.id).map((item) => item.name),
}));

const materialAliases = {
  chapas: "chapas",
  "chapas-planas": "chapas",
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
