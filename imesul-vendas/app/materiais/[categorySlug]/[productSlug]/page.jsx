import { notFound } from "next/navigation";
import MaterialProductPage from "../../../../components/MaterialProductPage";
import SalesFooter from "../../../../components/SalesFooter";
import {
  getCatalogCategoryPath,
  getCatalogProductBySlugs,
  getRoutedCatalogProducts,
} from "../../../../data/catalogRoutes";

export function generateStaticParams() {
  return getRoutedCatalogProducts();
}

export async function generateMetadata({ params }) {
  const { categorySlug, productSlug } = await params;
  const match = getCatalogProductBySlugs(categorySlug, productSlug);

  if (!match) {
    return {
      title: "Produto não encontrado | IMESUL Vendas",
    };
  }

  return {
    title: `${match.product.name} | IMESUL Vendas`,
    description: `${match.product.description} Categoria: ${match.category.name}.`,
  };
}

export default async function MaterialProductRoutePage({ params }) {
  const { categorySlug, productSlug } = await params;
  const match = getCatalogProductBySlugs(categorySlug, productSlug);

  if (!match) notFound();

  const backLink = ["fixador-de-porta-de-piso", "kit-n-2-rold-4", "kit-n-3-rold-5"].includes(match.product.id)
    ? { href: getCatalogCategoryPath(match.category.id), label: `Voltar para ${match.category.name}` }
    : null;

  return (
    <>
      <MaterialProductPage
        category={{
          id: match.category.id,
          name: match.category.name,
          description: match.category.description,
        }}
        product={match.product}
        backLink={backLink}
      />
      <SalesFooter />
    </>
  );
}
