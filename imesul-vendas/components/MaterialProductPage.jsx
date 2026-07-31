"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Database, Home, ImageIcon } from "lucide-react";
import { getCatalogCategoryPath } from "../data/catalogRoutes";
import { MaterialQuoteFlow } from "./QuoteBuilder";

export default function MaterialProductPage({ category, product }) {
  const variants = product.variants || [];
  const hasVariants = variants.length > 0;
  const isRoldanasSection = product.id === "roldanas";
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId);
  const displayProduct = selectedVariant
    ? {
        ...product,
        ...selectedVariant,
        categoryId: product.categoryId,
        specifications: product.specifications,
        technicalNote: product.technicalNote,
        variants: [],
        hasStructuredOptions: product.hasStructuredOptions,
        hasCompleteData: product.hasCompleteData,
      }
    : product;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#06101d] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(212,43,43,0.11),transparent_24%),radial-gradient(circle_at_88%_46%,rgba(42,92,151,0.14),transparent_30%),linear-gradient(180deg,#06101d_0%,#0a1727_48%,#06101d_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.055] [background-image:linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:72px_72px]" />

      <section className="relative z-10 bg-[#091727]/58">
        <div className="mx-auto max-w-[1480px] px-6 py-12 sm:px-8 sm:py-16 lg:px-12">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={getCatalogCategoryPath(category.id)}
              className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-white/[0.14] bg-white/[0.04] px-4 py-2.5 font-condensed text-xs font-bold uppercase tracking-[0.12em] text-white transition-all hover:-translate-y-0.5 hover:border-imesul-red/45 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imesul-red focus-visible:ring-offset-2 focus-visible:ring-offset-imesul-blue"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              Voltar para categoria
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-white/[0.12] bg-white/[0.035] px-4 py-2.5 font-condensed text-xs font-bold uppercase tracking-[0.12em] text-white/82 transition-all hover:-translate-y-0.5 hover:border-white/[0.22] hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imesul-red focus-visible:ring-offset-2 focus-visible:ring-offset-imesul-blue"
            >
              <Home size={15} aria-hidden="true" />
              Página principal
            </Link>
          </div>

          {!isRoldanasSection && (
          <div className="mt-12 grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
            <div className="relative overflow-hidden rounded-[8px] border border-white/[0.1] bg-[#f4f5f6] shadow-[0_22px_70px_rgba(0,0,0,0.24)]">
              <div className="relative aspect-[4/3]">
                <Image
                  src={displayProduct.image}
                  alt={displayProduct.name}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 46vw"
                  className="object-contain p-7"
                />
              </div>
              <span
                className={`absolute left-5 top-5 rounded-[5px] border px-3 py-1.5 font-mono text-[9px] tracking-[0.16em] ${
                  displayProduct.hasStructuredOptions
                    ? "border-[#1f7a50]/25 bg-[#e5f4ec] text-[#17583b]"
                    : "border-[#8a641f]/25 bg-[#fff2d6] text-[#6e4b0f]"
                }`}
              >
                {displayProduct.hasStructuredOptions ? "DADOS TÉCNICOS" : "SOB CONSULTA"}
              </span>
            </div>

            <header>
              <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-imesul-red">
                {category.name}
              </p>
              <h1 className="mt-4 font-display text-[clamp(3.1rem,5vw,5.8rem)] leading-[0.9] text-white">
                {product.name}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-imesul-steel-light/75 sm:text-lg">
                {product.description}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {product.usage.map((usage) => (
                  <span
                    key={usage}
                    className="rounded-[4px] border border-white/[0.1] bg-white/[0.035] px-2.5 py-1.5 text-[11px] text-imesul-steel-light/75"
                  >
                    {usage}
                  </span>
                ))}
              </div>

              <div className="mt-7 inline-flex items-center gap-2 rounded-[8px] border border-white/[0.1] bg-white/[0.035] px-4 py-3 text-sm text-imesul-steel-light/75">
                {displayProduct.hasStructuredOptions ? (
                  <Database size={16} aria-hidden="true" />
                ) : (
                  <ImageIcon size={16} aria-hidden="true" />
                )}
                {hasVariants
                  ? `${variants.length} ${variants.length === 1 ? "modelo disponível" : "modelos disponíveis"}`
                  : displayProduct.hasStructuredOptions
                    ? `${displayProduct.specifications.variacoes.length} opções disponíveis`
                    : "Item sob consulta"}
              </div>
            </header>
          </div>
          )}

          {hasVariants && (
            <section className="mt-10 rounded-[8px] border border-white/[0.1] bg-[linear-gradient(145deg,rgba(12,30,51,0.92),rgba(6,16,29,0.96))] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.22)] sm:p-7">
              <div className="flex flex-col justify-between gap-3 border-b border-white/[0.08] pb-5 sm:flex-row sm:items-end">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-imesul-red">
                    Selecione o modelo
                  </p>
                  <h2 className="mt-3 font-display text-4xl leading-none text-white">
                    Roldanas disponíveis
                  </h2>
                </div>
                <p className="max-w-md text-sm leading-6 text-imesul-steel-light/68">
                  Escolha uma roldana para continuar com o orçamento.
                </p>
              </div>

              <div className="mt-7 grid auto-rows-fr grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {variants.map((variant) => {
                  const isSelected = variant.id === selectedVariantId;

                  return (
                    <button
                      key={variant.id}
                      type="button"
                      data-testid={`variant-${variant.id}`}
                      aria-pressed={isSelected}
                      aria-label={`Selecionar ${variant.name}`}
                      onClick={() => setSelectedVariantId(variant.id)}
                      className={`group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[8px] border bg-[#0a1829] text-left shadow-[0_18px_50px_rgba(0,0,0,0.16)] transition-all duration-300 will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imesul-red focus-visible:ring-offset-2 focus-visible:ring-offset-imesul-blue ${
                        isSelected
                          ? "border-[#f0c776]/80 shadow-[0_22px_62px_rgba(240,199,118,0.12)]"
                          : "border-white/[0.1] hover:-translate-y-0.5 hover:border-imesul-red/38 hover:shadow-[0_22px_64px_rgba(212,43,43,0.08),inset_0_1px_0_rgba(255,255,255,0.045)]"
                      }`}
                    >
                      <span className="relative block h-60 overflow-hidden border-b border-white/[0.08] bg-[#f4f5f6]">
                        <Image
                          src={variant.image}
                          alt={variant.name}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                          className="object-contain p-5 transition-transform duration-700 group-hover:scale-[1.045]"
                        />
                        {isSelected && (
                          <span className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#f0c776] text-[#071321]">
                            <Check size={15} strokeWidth={2.5} aria-hidden="true" />
                          </span>
                        )}
                      </span>

                      <span className="flex flex-1 flex-col p-6">
                        <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-imesul-red">
                          {variant.group}
                        </span>
                        <strong className="mt-3 font-condensed text-2xl font-semibold leading-tight text-white">
                          {variant.name}
                        </strong>
                        <span className="mt-2 text-sm leading-6 text-imesul-steel-light/68">
                          Acabamento: {variant.finish}
                        </span>
                        <span className="mt-auto flex items-center gap-2 pt-6 font-condensed text-[11px] font-bold uppercase tracking-[0.14em] text-white">
                          {isSelected ? "Modelo selecionado" : "Selecionar modelo"}
                          {isSelected ? <Check size={15} /> : <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" />}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {(!hasVariants || selectedVariant) && (
            <div className="mt-10 rounded-[10px]">
              <MaterialQuoteFlow
                key={displayProduct.id}
                product={displayProduct}
              />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
