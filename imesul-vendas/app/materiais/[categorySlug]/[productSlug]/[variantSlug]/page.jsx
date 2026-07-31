import { notFound } from "next/navigation";
import MaterialProductPage from "../../../../../components/MaterialProductPage";
import SalesFooter from "../../../../../components/SalesFooter";
import {
  getCatalogProductPath,
  getCatalogVariantBySlugs,
  getRoutedCatalogVariants,
} from "../../../../../data/catalogRoutes";

export function generateStaticParams() {
  return getRoutedCatalogVariants();
}

export async function generateMetadata({ params }) {
  const { categorySlug, productSlug, variantSlug } = await params;
  const match = getCatalogVariantBySlugs(categorySlug, productSlug, variantSlug);

  if (!match) {
    return {
      title: "Produto não encontrado | IMESUL Vendas",
    };
  }

  return {
    title: `${match.variant.name} | IMESUL Vendas`,
    description: `${match.variant.description || match.product.description} Categoria: ${match.category.name}.`,
  };
}

export default async function MaterialVariantRoutePage({ params }) {
  const { categorySlug, productSlug, variantSlug } = await params;
  const match = getCatalogVariantBySlugs(categorySlug, productSlug, variantSlug);

  if (!match) notFound();

  const variantProduct = {
    ...match.product,
    ...match.variant,
    categoryId: match.product.categoryId,
    specifications: match.product.specifications,
    technicalNote: match.product.technicalNote,
    variants: [],
    hasStructuredOptions: match.product.hasStructuredOptions,
    hasCompleteData: match.product.hasCompleteData,
  };

  return (
    <>
      <MaterialProductPage
        category={{
          id: match.category.id,
          name: match.category.name,
          description: match.category.description,
        }}
        product={variantProduct}
        backLink={{
          href: getCatalogProductPath(match.product),
          label: "Voltar para Roldanas",
        }}
      />
      <SalesFooter />
    </>
  );
}
