"use client";

import Image from "next/image";
import { ArrowRight, Check, Database, ImageIcon } from "lucide-react";
import { catalogCategories } from "../data/catalogCategories";
import { getCatalogProductsByCategory } from "../data/catalogProducts";

export default function ProductCatalog({
  selectedCategoryId,
  selectedProductId,
  onSelectCategory,
  onSelectProduct,
}) {
  const products = selectedCategoryId
    ? getCatalogProductsByCategory(selectedCategoryId)
    : [];
  const selectedCategory = catalogCategories.find(
    (category) => category.id === selectedCategoryId
  );

  return (
    <div className="mt-12 lg:mt-14">
      <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {catalogCategories.map((category) => {
          const Icon = category.icon;
          const isSelected = category.id === selectedCategoryId;
          const productCount = getCatalogProductsByCategory(category.id).length;

          return (
            <button
              key={category.id}
              type="button"
              data-testid={`category-${category.id}`}
              aria-pressed={isSelected}
              onClick={() => onSelectCategory(category.id)}
              className={`group relative grid min-h-[210px] grid-cols-[0.95fr_1.05fr] overflow-hidden rounded-[8px] border text-left shadow-[0_18px_52px_rgba(0,0,0,0.16)] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imesul-red focus-visible:ring-offset-2 focus-visible:ring-offset-imesul-blue ${
                isSelected
                  ? "border-imesul-red bg-[#101d2d] shadow-[0_24px_64px_rgba(212,43,43,0.15)]"
                  : "border-white/[0.1] bg-[#0b192b]/88 hover:-translate-y-1 hover:border-imesul-red/45"
              }`}
            >
              <span className="relative min-h-[210px] overflow-hidden bg-[#f3f5f7]">
                <Image
                  src={category.image}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 18vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
                <span className="absolute inset-y-0 right-0 w-12 bg-gradient-to-r from-transparent to-[#101d2d]" />
              </span>

              <span className="flex min-w-0 flex-col p-5">
                <span className="flex items-start justify-between gap-2">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] border border-white/10 bg-white/[0.05] text-imesul-steel-light">
                    <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
                  </span>
                  {isSelected && (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-imesul-red text-white">
                      <Check size={15} strokeWidth={2.5} aria-hidden="true" />
                    </span>
                  )}
                </span>
                <strong className="mt-5 font-condensed text-xl font-semibold leading-tight text-white">
                  {category.name}
                </strong>
                <span className="mt-2 text-xs leading-5 text-imesul-steel-light/62">
                  {productCount} {productCount === 1 ? "produto" : "produtos"}
                </span>
                <span className="mt-auto flex items-center gap-2 pt-5 font-condensed text-[11px] font-bold uppercase tracking-[0.13em] text-imesul-steel-light/72">
                  Ver produtos
                  <ArrowRight size={14} aria-hidden="true" />
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

          <div className="mt-7 grid auto-rows-fr grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {products.map((item) => {
              const isSelected = item.id === selectedProductId;

              return (
                <article
                  key={item.id}
                  className={`group flex h-full flex-col overflow-hidden rounded-[8px] border bg-[#0a1829] shadow-[0_20px_55px_rgba(0,0,0,0.18)] transition-all duration-300 ${
                    isSelected
                      ? "border-imesul-red shadow-[0_24px_70px_rgba(212,43,43,0.16)]"
                      : "border-white/[0.1] hover:-translate-y-1 hover:border-imesul-red/45"
                  }`}
                >
                  <div className="relative h-60 overflow-hidden border-b border-white/[0.08] bg-[#f4f5f6]">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                      className="object-contain p-5 transition-transform duration-500 group-hover:scale-[1.04]"
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
                      <button
                        type="button"
                        data-testid={`product-${item.id}`}
                        aria-pressed={isSelected}
                        onClick={() => onSelectProduct(item.id)}
                        className={`inline-flex min-h-11 items-center gap-2 rounded-[8px] px-4 py-2.5 font-condensed text-xs font-bold uppercase tracking-[0.12em] text-white transition-all ${
                          isSelected
                            ? "bg-[#a91f1f]"
                            : "bg-imesul-red hover:-translate-y-0.5 hover:bg-[#ef3434]"
                        }`}
                      >
                        {isSelected ? "Selecionado" : "Selecionar"}
                        {isSelected ? <Check size={15} /> : <ArrowRight size={15} />}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
