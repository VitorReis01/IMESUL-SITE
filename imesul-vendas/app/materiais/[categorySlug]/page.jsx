import { notFound, permanentRedirect } from "next/navigation";
import MaterialCategoryPage from "../../../components/MaterialCategoryPage";
import SalesFooter from "../../../components/SalesFooter";
import {
  getCatalogCategoryBySlug,
  getRoutedCatalogCategories,
  getCatalogCategorySlug,
  getLegacyCategoryRedirectPath,
} from "../../../data/catalogRoutes";

export function generateStaticParams() {
  return getRoutedCatalogCategories().map((category) => ({
    categorySlug: getCatalogCategorySlug(category.id),
  }));
}

export async function generateMetadata({ params }) {
  const { categorySlug } = await params;
  const category = getCatalogCategoryBySlug(categorySlug);

  if (!category) {
    return {
      title: "Material não encontrado | IMESUL Vendas",
    };
  }

  return {
    title: `${category.name} | IMESUL Vendas`,
    description: category.description,
  };
}

export default async function MaterialRoutePage({ params }) {
  const { categorySlug } = await params;
  const legacyRedirectPath = getLegacyCategoryRedirectPath(categorySlug);
  // Rota antiga de categoria renomeada nunca deve virar 404 - permanentRedirect (308) em vez de
  // redirect (307), porque a URL antiga nunca vai voltar a existir (ver
  // data/catalogRoutes.js#legacyCatalogCategoryRedirects).
  if (legacyRedirectPath) permanentRedirect(legacyRedirectPath);

  const category = getCatalogCategoryBySlug(categorySlug);

  if (!category) notFound();

  return (
    <>
      <MaterialCategoryPage
        category={{
          id: category.id,
          name: category.name,
          description: category.description,
        }}
      />
      <SalesFooter />
    </>
  );
}
