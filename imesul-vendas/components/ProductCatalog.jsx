"use client";

// Catalogo de materiais da area de vendas.
// Recebe selecoes vindas da busca, projetos e carrossel para abrir o produto correto.
import Image from "next/image";
import { ArrowRight, Check, Database, ImageIcon } from "lucide-react";
import { catalogCategories } from "../data/catalogCategories";
import { getCatalogProductsByCategory } from "../data/catalogProducts";

const materialShowcaseCards = [
  {
    categoryId: "tubos-metalicos",
    title: "Tubos e Metalons",
    image: "/images/vendas/materiais/tubos-e-metalons.webp",
  },
  {
    categoryId: "perfis-estruturais",
    title: "Perfis Estruturais",
    image: "/images/vendas/materiais/perfis-estruturais.webp",
  },
  {
    categoryId: "chapas",
    title: "Chapas",
    image: "/images/vendas/materiais/chapas.webp",
  },
  {
    categoryId: "telhas-metalicas",
    title: "Telhas Metálicas",
    image: "/images/vendas/materiais/telhas-e-tercas.webp",
  },
  {
    categoryId: "laminados",
    title: "Barras",
    image: "/images/vendas/materiais/barras-e-vergalhoes.webp",
  },
  {
    categoryId: "acessorios-serralheria",
    title: "Acessórios",
    image: "/images/vendas/materiais/acessorios-e-fixadores.webp",
  },
  {
    categoryId: "thinner-fixadores",
    title: "Thinner e Solventes",
    image: "/images/vendas/materiais/acessorios-e-fixadores.webp",
  },
  {
    categoryId: "perfis-serralheria",
    title: "Serralheria e Acabamentos",
    image: "/images/vendas/materiais/serralheria-e-acabamentos.webp",
  },
];

// Mostra categorias e, depois da escolha, somente os produtos ligados a ela.
// Os callbacks pertencem ao ProjectSelector, que controla o fluxo completo.
export default function ProductCatalog({
  selectedCategoryId,
  selectedProductId,
  highlightedCategoryId,
  highlightedProductId,
  recommendedProjectTitle,
  recommendedCategoryIds = [],
  onSelectCategory,
  onSelectProduct,
}) {
  const products = selectedCategoryId
    ? getCatalogProductsByCategory(selectedCategoryId)
    : [];
  const selectedCategory = catalogCategories.find(
    (category) => category.id === selectedCategoryId
  );
  const hasRecommendations = recommendedCategoryIds.length > 0;

  return (
    <div className="mt-12 lg:mt-14">
      {hasRecommendations && (
        <div className="mb-7 flex flex-col gap-4 rounded-[8px] border border-imesul-red/55 bg-[linear-gradient(135deg,rgba(212,43,43,0.16),rgba(7,19,33,0.92)_58%)] px-5 py-5 shadow-[0_22px_70px_rgba(212,43,43,0.14)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="font-condensed text-2xl font-semibold uppercase leading-tight tracking-[0.065em] text-white sm:text-[1.7rem]">
            Materiais indicados para:{" "}
            <span className="text-[#ff3b3b] drop-shadow-[0_0_16px_rgba(212,43,43,0.34)]">
              {recommendedProjectTitle}
            </span>
          </p>
          <span className="rounded-full border border-white/[0.12] bg-white/[0.07] px-4 py-2.5 font-mono text-[10px] uppercase leading-5 tracking-[0.18em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:text-[11px]">
            Clique em uma categoria abaixo para ver os produtos.
          </span>
        </div>
      )}

      <div className="grid auto-rows-fr grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {materialShowcaseCards.map((card, index) => {
          const category = catalogCategories.find((item) => item.id === card.categoryId);
          if (!category) return null;

          const Icon = category.icon;
          const isSelected = category.id === selectedCategoryId;
          const isHighlighted = category.id === highlightedCategoryId;
          const isRecommended = recommendedCategoryIds.includes(category.id);
          const productCount = getCatalogProductsByCategory(category.id).length;

          return (
            <button
              key={category.id}
              type="button"
              data-scroll-reveal
              data-testid={`category-${category.id}`}
              style={{ "--reveal-delay": `${index * 45}ms` }}
              aria-pressed={isSelected}
              aria-label={`Ver materiais da categoria ${card.title}`}
              onClick={() => onSelectCategory(category.id)}
              className={`group relative flex min-h-[285px] cursor-pointer flex-col overflow-hidden rounded-[8px] border bg-[#071321] text-left shadow-[0_20px_62px_rgba(0,0,0,0.18)] transition-all duration-300 will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imesul-red focus-visible:ring-offset-2 focus-visible:ring-offset-imesul-blue ${
                isSelected
                  ? "border-[#f0c776]/80 shadow-[0_22px_66px_rgba(240,199,118,0.12)]"
                  : isRecommended
                    ? "border-imesul-red/55 shadow-[0_22px_62px_rgba(212,43,43,0.1)] hover:-translate-y-0.5 hover:border-imesul-red/75 hover:shadow-[0_24px_68px_rgba(212,43,43,0.12)]"
                    : hasRecommendations
                      ? "border-white/[0.08] opacity-55 hover:-translate-y-0.5 hover:border-white/[0.16] hover:opacity-100 hover:shadow-[0_22px_64px_rgba(255,255,255,0.045)]"
                      : "border-white/[0.1] hover:-translate-y-0.5 hover:border-imesul-red/38 hover:shadow-[0_22px_66px_rgba(212,43,43,0.08)]"
              } ${isHighlighted ? "selection-feedback-pulse ring-2 ring-[#f0c776]/70 ring-offset-2 ring-offset-[#091727]" : ""}`}
            >
              <span className="relative block h-44 overflow-hidden bg-[#0b192b]">
                <Image
                  src={card.image}
                  alt={card.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-[#071321] via-transparent to-transparent" />
                {isSelected && (
                  <span className="absolute right-4 top-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f0c776] text-[#071321]">
                    <Check size={15} strokeWidth={2.5} aria-hidden="true" />
                  </span>
                )}
                {isRecommended && !isSelected && (
                  <span className="absolute right-4 top-4 rounded-full border border-imesul-red/45 bg-[#071321]/88 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-imesul-red shadow-[0_10px_30px_rgba(0,0,0,0.24)]">
                    Indicado
                  </span>
                )}
              </span>

              <span className="flex min-w-0 flex-1 flex-col p-5">
                <span className="flex items-start justify-between gap-2">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] border border-white/10 bg-white/[0.05] text-imesul-steel-light">
                    <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
                  </span>
                </span>
                <strong className="mt-5 font-condensed text-xl font-semibold leading-tight text-white">
                  {card.title}
                </strong>
                <span className="mt-2 text-xs leading-5 text-imesul-steel-light/62">
                  {productCount} {productCount === 1 ? "produto" : "produtos"}
                </span>
                <span className="mt-auto flex items-center gap-2 pt-5 font-condensed text-[11px] font-bold uppercase tracking-[0.13em] text-white">
                  Ver materiais
                  <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {selectedCategory && (
        <section className="mt-12 scroll-mt-24" id="catalog-products">
          <div className="flex flex-col justify-between gap-4 border-b border-white/[0.1] pb-6 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-[10px] tracking-[0.32em] text-imesul-red">
                PRODUTOS DA CATEGORIA
              </p>
              <h3 className="mt-3 font-display text-5xl leading-none text-white sm:text-6xl">
                {selectedCategory.name}
              </h3>
            </div>
            <p className="max-w-md text-sm leading-6 text-imesul-steel-light/68">
              Selecione um produto para consultar as opções técnicas publicadas no catálogo IMESUL.
            </p>
          </div>
          <p className="mt-4 inline-flex rounded-full border border-[#f0c776]/28 bg-[#f0c776]/8 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#f0c776]">
            {selectedProductId
              ? "Produto selecionado. Confira as opções abaixo."
              : "Categoria selecionada. Escolha um produto para continuar."}
          </p>

          <div className="mt-7 grid auto-rows-fr grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {products.map((item, index) => {
              const isSelected = item.id === selectedProductId;
              const isHighlighted = item.id === highlightedProductId;

              return (
                <button
                  key={item.id}
                  id={`catalog-product-${item.id}`}
                  type="button"
                  data-scroll-reveal
                  data-testid={`product-${item.id}`}
                  style={{ "--reveal-delay": `${index * 45}ms` }}
                  aria-pressed={isSelected}
                  aria-label={`${isSelected ? "Material escolhido" : "Escolher"} ${item.name}`}
                  onClick={() => onSelectProduct(item.id)}
                  className={`group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[8px] border bg-[#0a1829] text-left shadow-[0_18px_50px_rgba(0,0,0,0.16)] transition-all duration-300 will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imesul-red focus-visible:ring-offset-2 focus-visible:ring-offset-imesul-blue ${
                    isSelected
                      ? "border-[#f0c776]/80 shadow-[0_22px_62px_rgba(240,199,118,0.12)]"
                      : "border-white/[0.1] hover:-translate-y-0.5 hover:border-imesul-red/38 hover:shadow-[0_22px_64px_rgba(212,43,43,0.08),inset_0_1px_0_rgba(255,255,255,0.045)]"
                  } ${isHighlighted ? "selection-feedback-pulse ring-2 ring-[#f0c776]/70 ring-offset-2 ring-offset-[#091727]" : ""}`}
                >
                  <div className="relative h-60 overflow-hidden border-b border-white/[0.08] bg-[#f4f5f6]">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                      className="object-contain p-5 transition-transform duration-700 group-hover:scale-[1.045]"
                    />
                    <span
                      className={`absolute left-4 top-4 rounded-[5px] border px-3 py-1.5 font-mono text-[9px] tracking-[0.16em] ${
                        item.hasStructuredOptions
                          ? "border-[#1f7a50]/25 bg-[#e5f4ec] text-[#17583b]"
                          : "border-[#8a641f]/25 bg-[#fff2d6] text-[#6e4b0f]"
                      }`}
                    >
                      {item.hasStructuredOptions ? "DADOS TÉCNICOS" : "SOB CONSULTA"}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col p-6">
                    <p className="font-mono text-[9px] tracking-[0.22em] text-imesul-red">
                      {selectedCategory.name.toUpperCase()}
                    </p>
                    <h4 className="mt-3 font-condensed text-2xl font-semibold leading-tight text-white">
                      {item.name}
                    </h4>
                    <p className="mt-3 text-sm leading-6 text-imesul-steel-light/68">
                      {item.description}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {item.usage.map((usage) => (
                        <span
                          key={usage}
                          className="rounded-[4px] border border-white/[0.1] bg-white/[0.035] px-2.5 py-1.5 text-[11px] text-imesul-steel-light/75"
                        >
                          {usage}
                        </span>
                      ))}
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-3 pt-7">
                      <span className="flex items-center gap-2 text-xs text-imesul-steel/60">
                        {item.hasStructuredOptions ? (
                          <Database size={14} aria-hidden="true" />
                        ) : (
                          <ImageIcon size={14} aria-hidden="true" />
                        )}
                        {item.hasStructuredOptions
                          ? `${item.specifications.variacoes.length} opções`
                          : "Detalhes livres"}
                      </span>
                      <span
                        className={`inline-flex min-h-11 items-center gap-2 rounded-[8px] px-4 py-2.5 font-condensed text-xs font-bold uppercase tracking-[0.12em] text-white transition-all ${
                          isSelected
                            ? "bg-[#a91f1f]"
                            : "bg-imesul-red hover:-translate-y-0.5 hover:bg-[#ef3434]"
                        }`}
                      >
                        {isSelected ? "Material escolhido" : "Escolher este material"}
                        {isSelected ? <Check size={15} /> : <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" />}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
