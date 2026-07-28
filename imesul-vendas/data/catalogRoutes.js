import { catalogCategories } from "./catalogCategories";

export const catalogCategorySlugs = {
  "tubos-metalicos": "tubos-e-metalons",
  "perfis-estruturais": "perfis-estruturais",
  chapas: "chapas",
  "telhas-metalicas": "telhas-metalicas",
  laminados: "barras",
  "acessorios-serralheria": "acessorios",
  "thinner-fixadores": "thinner-e-solventes",
  "perfis-serralheria": "serralheria-e-acabamentos",
};

export const catalogCategoryIdsBySlug = Object.fromEntries(
  Object.entries(catalogCategorySlugs).map(([categoryId, slug]) => [slug, categoryId])
);

export function getCatalogCategorySlug(categoryId) {
  return catalogCategorySlugs[categoryId] || categoryId;
}

export function getCatalogCategoryPath(categoryId) {
  return `/materiais/${getCatalogCategorySlug(categoryId)}`;
}

export function getCatalogCategoryBySlug(slug) {
  const categoryId = catalogCategoryIdsBySlug[slug];
  if (!categoryId) return null;
  return catalogCategories.find((category) => category.id === categoryId) || null;
}

export function getRoutedCatalogCategories() {
  return catalogCategories.filter((category) => catalogCategorySlugs[category.id]);
}
