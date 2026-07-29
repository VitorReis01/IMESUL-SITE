import { catalogCategories } from "./catalogCategories";
import { catalogProducts, getCatalogProductsByCategory } from "./catalogProducts";

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

export function createCatalogSlug(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getCatalogProductSlug(product) {
  return createCatalogSlug(product?.name || product?.id || "");
}

export function getCatalogProductPath(product) {
  return `${getCatalogCategoryPath(product.categoryId)}/${getCatalogProductSlug(product)}`;
}

export function getCatalogCategoryBySlug(slug) {
  const categoryId = catalogCategoryIdsBySlug[slug];
  if (!categoryId) return null;
  return catalogCategories.find((category) => category.id === categoryId) || null;
}

export function getRoutedCatalogCategories() {
  return catalogCategories.filter((category) => catalogCategorySlugs[category.id]);
}

export function getCatalogProductBySlugs(categorySlug, productSlug) {
  const category = getCatalogCategoryBySlug(categorySlug);
  if (!category) return null;

  const product = getCatalogProductsByCategory(category.id).find(
    (item) => getCatalogProductSlug(item) === productSlug
  );

  if (!product) return null;
  return { category, product };
}

export function getRoutedCatalogProducts() {
  return catalogProducts
    .filter((product) => catalogCategorySlugs[product.categoryId])
    .map((product) => ({
      categorySlug: getCatalogCategorySlug(product.categoryId),
      productSlug: getCatalogProductSlug(product),
    }));
}
