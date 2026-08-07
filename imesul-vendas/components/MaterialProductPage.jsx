"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Database, Home, ImageIcon } from "lucide-react";
import { getCatalogCategoryPath, getCatalogVariantPath } from "../data/catalogRoutes";
import { MaterialQuoteFlow } from "./QuoteBuilder";

export default function MaterialProductPage({ category, product, backLink = null }) {
  const variants = product.variants || [];
  const hasVariants = variants.length > 0;
  const isRoldanasSection = product.id === "roldanas";
  const isFechosSection = product.id === "fechos";
  const isDobradicasSection = product.id === "dobradicas";
  const isFechadurasSection = product.id === "fechaduras";
  const isParafusosSection = product.id === "parafusos";
  const isDiscosCorteSection = product.id === "discos-corte";
  const isTrincosSection = product.id === "trincos";
  const isPuxadoresSection = product.id === "puxadores";
  const isEletrodoSection = product.id === "eletrodo";
  const isModelSelectionSection = hasVariants && (isRoldanasSection || isFechosSection || isDobradicasSection || isFechadurasSection || isParafusosSection || isDiscosCorteSection || isTrincosSection || isPuxadoresSection || isEletrodoSection);
  const returnLink = backLink || {
    href: getCatalogCategoryPath(category.id),
    label: "Voltar para categoria",
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#06101d] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(212,43,43,0.11),transparent_24%),radial-gradient(circle_at_88%_46%,rgba(42,92,151,0.14),transparent_30%),linear-gradient(180deg,#06101d_0%,#0a1727_48%,#06101d_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.055] [background-image:linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:72px_72px]" />

      <section className="relative z-10 bg-[#091727]/58">
        <div className="mx-auto max-w-[1480px] px-5 py-10 sm:px-8 sm:py-16 lg:px-12">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={returnLink.href}
              className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-white/[0.14] bg-white/[0.04] px-4 py-2.5 font-condensed text-xs font-bold uppercase tracking-[0.12em] text-white transition-all hover:-translate-y-0.5 hover:border-imesul-red/45 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imesul-red focus-visible:ring-offset-2 focus-visible:ring-offset-imesul-blue"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              {returnLink.label}
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-white/[0.12] bg-white/[0.035] px-4 py-2.5 font-condensed text-xs font-bold uppercase tracking-[0.12em] text-white/82 transition-all hover:-translate-y-0.5 hover:border-white/[0.22] hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imesul-red focus-visible:ring-offset-2 focus-visible:ring-offset-imesul-blue"
            >
              <Home size={15} aria-hidden="true" />
              Página principal
            </Link>
          </div>

          {!isModelSelectionSection && (
          <div className="mt-8 grid gap-6 sm:mt-12 sm:gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
            <div className="relative overflow-hidden rounded-[8px] border border-white/[0.1] bg-[#f4f5f6] shadow-[0_22px_70px_rgba(0,0,0,0.24)]">
              <div className="relative aspect-[4/3]">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 46vw"
                  className="object-contain p-5 sm:p-7"
                />
              </div>
              <span
                className={`absolute left-5 top-5 rounded-[5px] border px-3 py-1.5 font-mono text-[11px] tracking-[0.1em] ${
                  product.hasStructuredOptions
                    ? "border-[#1f7a50]/25 bg-[#e5f4ec] text-[#17583b]"
                    : "border-[#8a641f]/25 bg-[#fff2d6] text-[#6e4b0f]"
                }`}
              >
                {product.hasStructuredOptions ? "DADOS TÉCNICOS" : "SOB CONSULTA"}
              </span>
            </div>

            <header>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-imesul-red">
                {category.name}
              </p>
              <h1 className="mt-4 font-display text-[clamp(2.3rem,10vw,3.1rem)] leading-[0.92] text-white sm:text-[clamp(3.1rem,5vw,5.8rem)] sm:leading-[0.9]">
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
                {product.hasStructuredOptions ? (
                  <Database size={16} aria-hidden="true" />
                ) : (
                  <ImageIcon size={16} aria-hidden="true" />
                )}
                {hasVariants
                  ? `${variants.length} ${variants.length === 1 ? "modelo disponível" : "modelos disponíveis"}`
                  : product.hasStructuredOptions
                    ? `${product.specifications.variacoes.length} opções disponíveis`
                    : "Item sob consulta"}
              </div>
            </header>
          </div>
          )}

          {hasVariants && (
            <section className="mt-8 rounded-[8px] border border-white/[0.1] bg-[linear-gradient(145deg,rgba(12,30,51,0.92),rgba(6,16,29,0.96))] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.22)] sm:mt-10 sm:p-7">
              <div className="flex flex-col justify-between gap-3 border-b border-white/[0.08] pb-5 sm:flex-row sm:items-end">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-imesul-red">
                    Selecione o modelo
                  </p>
                  <h2 className="mt-3 font-display text-[clamp(1.9rem,8vw,2.25rem)] leading-none text-white sm:text-4xl">
                    {isFechosSection
                      ? "FECHOS DISPONÍVEIS"
                      : isDobradicasSection
                        ? "DOBRADIÇAS DISPONÍVEIS"
                        : isFechadurasSection
                          ? "FECHADURAS DISPONÍVEIS"
                          : isParafusosSection
                            ? "PARAFUSOS DISPONÍVEIS"
                            : isDiscosCorteSection
                              ? "DISCOS DE CORTE DISPONÍVEIS"
                              : isTrincosSection
                                ? "TRINCOS DISPONÍVEIS"
                                : isPuxadoresSection
                                  ? "PUXADORES DISPONÍVEIS"
                                  : isEletrodoSection
                                    ? "ELETRODOS E ARAMES DISPONÍVEIS"
                                    : "Roldanas disponíveis"}
                  </h2>
                </div>
                <p className="max-w-md text-sm leading-6 text-imesul-steel-light/68">
                  {isDobradicasSection
                    ? "Escolha uma dobradiça para continuar com o orçamento."
                    : isFechadurasSection
                      ? "Escolha uma fechadura para continuar com o orçamento."
                      : isParafusosSection
                        ? "Escolha uma medida para continuar com o orçamento."
                        : isDiscosCorteSection
                          ? "Escolha um disco para continuar com o orçamento."
                          : isTrincosSection
                            ? "Escolha um trinco para continuar com o orçamento."
                            : isPuxadoresSection
                              ? "Escolha um puxador para continuar com o orçamento."
                              : isEletrodoSection
                                ? "Escolha um eletrodo ou arame para continuar com o orçamento."
                                : "Escolha um modelo para continuar com o orçamento."}
                </p>
              </div>

              <div className="mt-6 grid auto-rows-fr grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-3">
                {variants.map((variant) => {
                  const variantPath = getCatalogVariantPath(product, variant);

                  return (
                    <Link
                      key={variant.id}
                      href={variantPath}
                      data-testid={`variant-${variant.id}`}
                      aria-label={`Selecionar ${variant.name}`}
                      className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[8px] border border-white/[0.1] bg-[#0a1829] text-left shadow-[0_18px_50px_rgba(0,0,0,0.16)] transition-all duration-300 will-change-transform hover:-translate-y-0.5 hover:border-imesul-red/38 hover:shadow-[0_22px_64px_rgba(212,43,43,0.08),inset_0_1px_0_rgba(255,255,255,0.045)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imesul-red focus-visible:ring-offset-2 focus-visible:ring-offset-imesul-blue"
                    >
                      <span className="relative block h-48 overflow-hidden border-b border-white/[0.08] bg-[#f4f5f6] sm:h-60">
                        <Image
                          src={variant.image}
                          alt={variant.name}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                          className="object-contain p-5 transition-transform duration-700 group-hover:scale-[1.045]"
                        />
                      </span>

                      <span className="flex flex-1 flex-col p-5 sm:p-6">
                        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-imesul-red">
                          {variant.group}
                        </span>
                        <strong className="mt-3 font-condensed text-2xl font-semibold leading-tight text-white">
                          {variant.name}
                        </strong>
                        <span className="mt-2 text-sm leading-6 text-imesul-steel-light/68">
                          {[
                            variant.kind ? `Tipo: ${variant.kind}` : "",
                            variant.model ? `Modelo: ${variant.model}` : "",
                            variant.measure ? `Medida: ${variant.measure}` : "",
                            variant.cylinderType ? `Cilindro ${String(variant.cylinderType).toLowerCase()}` : "",
                            variant.finish && (variant.boreDistance || !variant.model) ? variant.finish : "",
                            variant.boreDistance ? `Distância de broca: ${variant.boreDistance}` : "",
                            !variant.model && !variant.cylinderType && !variant.finish && variant.type ? variant.type : "",
                          ].filter(Boolean).join(" · ") || "Sob consulta"}
                        </span>
                        <span className="mt-auto flex items-center gap-2 pt-6 font-condensed text-[11px] font-bold uppercase tracking-[0.14em] text-white">
                          Selecionar modelo
                          <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" />
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {!hasVariants && (
            <div className="mt-8 rounded-[10px] sm:mt-10">
              <MaterialQuoteFlow
                key={product.id}
                product={product}
              />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
