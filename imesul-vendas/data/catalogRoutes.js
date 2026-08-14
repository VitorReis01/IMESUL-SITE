import { catalogCategories } from "./catalogCategories";
import { catalogProducts, getCatalogProductsByCategory } from "./catalogProducts";

export const catalogCategorySlugs = {
  "tubos-metalicos": "tubos-e-metalons",
  "perfis-estruturais": "perfis-estruturais",
  chapas: "chapas",
  "telas-e-bobininhas": "telas-e-bobininhas",
  "telhas-metalicas": "telhas-metalicas",
  laminados: "barras",
  "acessorios-serralheria": "acessorios",
  "thinner-fixadores": "thinner-e-solventes",
  "perfis-serralheria": "serralheria-e-acabamentos",
};

export const legacyCatalogCategoryRedirects = {
  "chapas-frisadas-lambris": "chapas",
};

// Produtos que migraram de categoria mantem a rota antiga funcionando via redirect.
export const legacyCatalogProductRedirects = {
  "serralheria-e-acabamentos/batentes-de-porta": "perfis-estruturais/batentes-de-porta",
  "serralheria-e-acabamentos/colunas": "perfis-estruturais/colunas",
  "serralheria-e-acabamentos/tampas": "perfis-estruturais/tampas",
  "serralheria-e-acabamentos/cartolas": "perfis-estruturais/cartolas",
  "serralheria-e-acabamentos/viga-g": "perfis-estruturais/viga-g",
  "serralheria-e-acabamentos/caixa-de-peso": "perfis-estruturais/caixa-de-peso",
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

export function getLegacyCategoryRedirectPath(categorySlug, productSlug = "") {
  if (productSlug) {
    const productRedirect = legacyCatalogProductRedirects[`${categorySlug}/${productSlug}`];
    if (productRedirect) return `/materiais/${productRedirect}`;
  }

  const targetSlug = legacyCatalogCategoryRedirects[categorySlug];
  if (!targetSlug) return null;
  return `/materiais/${targetSlug}${productSlug ? `/${productSlug}` : ""}`;
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
  return product?.slug || createCatalogSlug(product?.name || product?.id || "");
}

export function getCatalogProductPath(product) {
  if (product?.variants?.length === 1 && product?.id !== "fechaduras") {
    return getCatalogVariantPath(product, product.variants[0]);
  }

  return `${getCatalogCategoryPath(product.categoryId)}/${getCatalogProductSlug(product)}`;
}

export function getCatalogVariantPath(product, variant) {
  return `${getCatalogCategoryPath(product.categoryId)}/${getCatalogProductSlug(product)}/${variant.slug}`;
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

export function getCatalogVariantBySlugs(categorySlug, productSlug, variantSlug) {
  const match = getCatalogProductBySlugs(categorySlug, productSlug);
  if (!match) return null;

  const variant = (match.product.variants || []).find((item) => item.slug === variantSlug);
  if (!variant) return null;

  return { ...match, variant };
}

export function getRoutedCatalogProducts() {
  return catalogProducts
    .filter((product) => catalogCategorySlugs[product.categoryId])
    .map((product) => ({
      categorySlug: getCatalogCategorySlug(product.categoryId),
      productSlug: getCatalogProductSlug(product),
    }));
}

export function getRoutedCatalogVariants() {
  return catalogProducts
    .filter((product) => catalogCategorySlugs[product.categoryId])
    .flatMap((product) =>
      (product.variants || []).map((variant) => ({
        categorySlug: getCatalogCategorySlug(product.categoryId),
        productSlug: getCatalogProductSlug(product),
        variantSlug: variant.slug,
      }))
    );
}
