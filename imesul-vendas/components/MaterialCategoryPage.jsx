"use client";

import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";
import ProductCatalog from "./ProductCatalog";

export default function MaterialCategoryPage({ category }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#06101d] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(212,43,43,0.11),transparent_24%),radial-gradient(circle_at_88%_46%,rgba(42,92,151,0.14),transparent_30%),linear-gradient(180deg,#06101d_0%,#0a1727_48%,#06101d_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.055] [background-image:linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:72px_72px]" />

      <section className="relative z-10 bg-[#091727]/58">
        <div className="mx-auto max-w-[1480px] px-6 py-12 sm:px-8 sm:py-16 lg:px-12">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/#material-path"
              className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-white/[0.14] bg-white/[0.04] px-4 py-2.5 font-condensed text-xs font-bold uppercase tracking-[0.12em] text-white transition-all hover:-translate-y-0.5 hover:border-imesul-red/45 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imesul-red focus-visible:ring-offset-2 focus-visible:ring-offset-imesul-blue"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              Voltar para categorias
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-white/[0.12] bg-white/[0.035] px-4 py-2.5 font-condensed text-xs font-bold uppercase tracking-[0.12em] text-white/82 transition-all hover:-translate-y-0.5 hover:border-white/[0.22] hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imesul-red focus-visible:ring-offset-2 focus-visible:ring-offset-imesul-blue"
            >
              <Home size={15} aria-hidden="true" />
              Página principal
            </Link>
          </div>

          <header className="mt-12 grid gap-5 lg:grid-cols-[0.86fr_1.14fr] lg:items-end">
            <div>
              <h1 className="font-display text-[clamp(3.1rem,5vw,5.8rem)] leading-[0.9] text-white">
                {category.name}
              </h1>
            </div>
            <p className="max-w-2xl text-base leading-relaxed text-imesul-steel-light/75 sm:text-lg">
              {category.description}
            </p>
          </header>

          <ProductCatalog
            selectedCategoryId={category.id}
            backHref="/#material-path"
            compactCategoryHeader
            linkProductsToPages
          />
        </div>
      </section>
    </main>
  );
}
