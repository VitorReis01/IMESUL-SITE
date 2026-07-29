"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Database, Home, ImageIcon } from "lucide-react";
import { getCatalogCategoryPath } from "../data/catalogRoutes";
import { MaterialQuoteFlow } from "./QuoteBuilder";

export default function MaterialProductPage({ category, product }) {
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

          <div className="mt-12 grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
            <div className="relative overflow-hidden rounded-[8px] border border-white/[0.1] bg-[#f4f5f6] shadow-[0_22px_70px_rgba(0,0,0,0.24)]">
              <div className="relative aspect-[4/3]">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 46vw"
                  className="object-contain p-7"
                />
              </div>
              <span
                className={`absolute left-5 top-5 rounded-[5px] border px-3 py-1.5 font-mono text-[9px] tracking-[0.16em] ${
                  product.hasStructuredOptions
                    ? "border-[#1f7a50]/25 bg-[#e5f4ec] text-[#17583b]"
                    : "border-[#8a641f]/25 bg-[#fff2d6] text-[#6e4b0f]"
                }`}
              >
                {product.hasStructuredOptions ? "DADOS TÉCNICOS" : "SOB CONSULTA"}
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
                {product.hasStructuredOptions ? (
                  <Database size={16} aria-hidden="true" />
                ) : (
                  <ImageIcon size={16} aria-hidden="true" />
                )}
                {product.hasStructuredOptions
                  ? `${product.specifications.variacoes.length} opções disponíveis`
                  : "Item sob consulta"}
              </div>
            </header>
          </div>

          <div className="mt-10 rounded-[10px]">
            <MaterialQuoteFlow
              key={product.id}
              product={product}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
