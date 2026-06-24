"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ArrowDownRight,
  ArrowRight,
  Building2,
  Check,
  PackageSearch,
} from "lucide-react";
import { projects } from "../data/projects";
import { getCatalogProduct } from "../data/catalogProducts";
import { MaterialQuoteFlow, ProjectQuoteFlow } from "./QuoteBuilder";
import ProductCatalog from "./ProductCatalog";

export default function ProjectSelector() {
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const selectedProduct = getCatalogProduct(selectedProductId);

  const scrollToFlow = (id) => {
    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  };

  const selectProject = (projectId) => {
    setSelectedProjectId(projectId);
    setSelectedCategoryId(null);
    setSelectedProductId(null);
    scrollToFlow("project-quote-flow");
  };

  const selectCategory = (categoryId) => {
    setSelectedCategoryId(categoryId);
    setSelectedProductId(null);
    setSelectedProjectId(null);
    scrollToFlow("catalog-products");
  };

  const selectProduct = (productId) => {
    setSelectedProductId(productId);
    setSelectedProjectId(null);
    scrollToFlow("material-quote-flow");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#06101d]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(212,43,43,0.11),transparent_24%),radial-gradient(circle_at_88%_46%,rgba(42,92,151,0.14),transparent_30%),linear-gradient(180deg,#06101d_0%,#0a1727_48%,#06101d_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.055] [background-image:linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:72px_72px]" />

      <header className="relative z-30 border-b border-white/[0.08] bg-[#050b14]/82 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1480px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Image
            src="/logo/imesul-logo-completa.png"
            alt="IMESUL Distribuição"
            width={707}
            height={353}
            priority
            className="h-auto w-[145px] object-contain sm:w-[170px]"
          />
          <a
            href={process.env.NEXT_PUBLIC_INSTITUTIONAL_SITE_URL || "http://localhost:3000"}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 font-condensed text-xs font-semibold uppercase tracking-[0.15em] text-imesul-steel transition-colors hover:text-white"
          >
            <span className="hidden sm:inline">Site institucional</span>
            <ArrowRight
              size={16}
              className="transition-transform duration-300 group-hover:translate-x-1"
              aria-hidden="true"
            />
          </a>
        </div>
      </header>

      <section className="relative z-10 border-b border-white/[0.08]">
        <div className="mx-auto grid min-h-[calc(100vh-76px)] max-w-[1480px] items-center gap-12 px-6 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.88fr_1.12fr] lg:px-12 lg:py-24">
          <div className="max-w-2xl">
            <div className="flex items-center gap-4">
              <span className="font-mono text-[10px] tracking-[0.4em] text-imesul-red">
                ÁREA DE VENDAS
              </span>
              <span className="h-px w-14 bg-imesul-red" />
            </div>

            <h1 className="mt-6 font-display text-[clamp(3.5rem,6.7vw,7.2rem)] leading-[0.9] tracking-[0.02em] text-white">
              Encontre o aço certo para o seu{" "}
              <span className="text-imesul-red">próximo projeto.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-imesul-steel-light/75 sm:text-lg">
              Escolha como prefere começar. A IMESUL organiza sua necessidade e
              prepara uma solicitação clara para a equipe comercial.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:gap-5">
            <a
              href="#project-path"
              className="group relative flex min-h-[252px] flex-col overflow-hidden rounded-[8px] border border-imesul-red/35 bg-[linear-gradient(145deg,rgba(212,43,43,0.13),rgba(11,25,43,0.82)_58%)] p-7 shadow-[0_24px_70px_rgba(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1 hover:border-imesul-red/70 hover:shadow-[0_28px_80px_rgba(212,43,43,0.14)] sm:p-8"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-[6px] border border-imesul-red/40 bg-imesul-red text-white shadow-[0_8px_28px_rgba(212,43,43,0.26)]">
                <Building2 size={23} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="mt-8 font-mono text-[10px] tracking-[0.3em] text-imesul-red">
                CAMINHO 01
              </span>
              <strong className="mt-2 font-display text-4xl font-normal leading-none text-white">
                Tenho um Projeto
              </strong>
              <span className="mt-3 max-w-xs text-sm leading-relaxed text-imesul-steel-light/68">
                Conte o que está construindo e veja os materiais recomendados.
              </span>
              <span className="mt-auto flex items-center gap-2 pt-7 font-condensed text-xs font-bold uppercase tracking-[0.15em] text-white">
                Começar pelo projeto
                <ArrowDownRight
                  size={16}
                  className="transition-transform duration-300 group-hover:translate-x-1 group-hover:translate-y-1"
                  aria-hidden="true"
                />
              </span>
            </a>

            <a
              href="#material-path"
              className="group relative flex min-h-[252px] flex-col overflow-hidden rounded-[8px] border border-white/[0.12] bg-[linear-gradient(145deg,rgba(31,66,108,0.24),rgba(11,25,43,0.82)_62%)] p-7 shadow-[0_24px_70px_rgba(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1 hover:border-imesul-steel/45 hover:shadow-[0_28px_80px_rgba(30,76,128,0.18)] sm:p-8"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-[6px] border border-white/[0.14] bg-white/[0.06] text-imesul-steel-light">
                <PackageSearch size={23} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="mt-8 font-mono text-[10px] tracking-[0.3em] text-imesul-steel">
                CAMINHO 02
              </span>
              <strong className="mt-2 font-display text-4xl font-normal leading-none text-white">
                Já Sei o Material
              </strong>
              <span className="mt-3 max-w-xs text-sm leading-relaxed text-imesul-steel-light/68">
                Selecione diretamente o produto que deseja comprar ou orçar.
              </span>
              <span className="mt-auto flex items-center gap-2 pt-7 font-condensed text-xs font-bold uppercase tracking-[0.15em] text-white">
                Ir para materiais
                <ArrowDownRight
                  size={16}
                  className="transition-transform duration-300 group-hover:translate-x-1 group-hover:translate-y-1"
                  aria-hidden="true"
                />
              </span>
            </a>
          </div>
        </div>
      </section>

      <section
        id="project-path"
        className="relative z-10 scroll-mt-0 border-b border-white/[0.08] bg-[#071321]/70"
      >
        <div className="mx-auto max-w-[1480px] px-6 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28">
          <header className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
            <div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-[10px] tracking-[0.38em] text-imesul-red">
                  CAMINHO 01
                </span>
                <span className="h-px w-14 bg-imesul-red" />
              </div>
              <p className="mt-4 font-condensed text-sm font-semibold uppercase tracking-[0.16em] text-imesul-steel">
                Para quem precisa de orientação
              </p>
            </div>
            <div>
              <h2 className="font-display text-[clamp(3.4rem,6vw,6.4rem)] leading-[0.9] text-white">
                O que você está <span className="text-imesul-red">construindo?</span>
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-imesul-steel-light/75 sm:text-lg">
                Selecione seu projeto e descubra os materiais recomendados.
              </p>
            </div>
          </header>

          <div className="mt-12 grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-14 lg:grid-cols-4">
            {projects.map((project) => {
              const Icon = project.icon;
              const isSelected = project.id === selectedProjectId;

              return (
                <button
                  key={project.id}
                  type="button"
                  data-testid={`project-${project.id}`}
                  aria-pressed={isSelected}
                  onClick={() => selectProject(project.id)}
                  className={`group relative flex min-h-[220px] h-full flex-col overflow-hidden rounded-[8px] border p-6 text-left shadow-[0_16px_45px_rgba(0,0,0,0.12)] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imesul-red focus-visible:ring-offset-2 focus-visible:ring-offset-imesul-blue ${
                    isSelected
                      ? "border-imesul-red bg-[linear-gradient(145deg,rgba(212,43,43,0.17),rgba(11,25,43,0.94))] shadow-[0_22px_58px_rgba(212,43,43,0.15)]"
                      : "border-white/[0.1] bg-[#0b192b]/78 hover:-translate-y-1 hover:border-imesul-red/45 hover:bg-[#102039]"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-[6px] border transition-all duration-300 ${
                        isSelected
                          ? "border-imesul-red bg-imesul-red text-white shadow-[0_8px_28px_rgba(212,43,43,0.25)]"
                          : "border-white/10 bg-white/[0.045] text-imesul-steel-light group-hover:border-imesul-red/40 group-hover:text-white"
                      }`}
                    >
                      <Icon size={23} strokeWidth={1.7} aria-hidden="true" />
                    </span>
                    {isSelected && (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-imesul-red text-white">
                        <Check size={15} strokeWidth={2.5} aria-hidden="true" />
                      </span>
                    )}
                  </div>
                  <span className="mt-7 block font-condensed text-[1.35rem] font-semibold leading-tight text-white">
                    {project.name}
                  </span>
                  <span className="mt-3 block text-sm leading-6 text-imesul-steel-light/68">
                    {project.description}
                  </span>
                  <span className="mt-auto flex items-center gap-2 pt-6 font-condensed text-[11px] font-bold uppercase tracking-[0.15em] text-imesul-steel-light/70 transition-colors group-hover:text-white">
                    {isSelected ? "Projeto selecionado" : "Selecionar projeto"}
                    <ArrowRight size={14} aria-hidden="true" />
                  </span>
                  <span
                    className={`absolute bottom-0 left-0 h-0.5 bg-imesul-red transition-all duration-300 ${
                      isSelected ? "w-full" : "w-0 group-hover:w-full"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {selectedProject && (
            <div className="mt-10">
              <ProjectQuoteFlow key={selectedProject.id} project={selectedProject} />
            </div>
          )}
        </div>
      </section>

      <section
        id="material-path"
        className="relative z-10 scroll-mt-0 bg-[#091727]/58"
      >
        <div className="mx-auto max-w-[1480px] px-6 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28">
          <header className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
            <div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-[10px] tracking-[0.38em] text-imesul-steel">
                  CAMINHO 02
                </span>
                <span className="h-px w-14 bg-imesul-steel/60" />
              </div>
              <p className="mt-4 font-condensed text-sm font-semibold uppercase tracking-[0.16em] text-imesul-steel">
                Para quem já sabe o que procura
              </p>
            </div>
            <div>
              <h2 className="font-display text-[clamp(3.2rem,5.6vw,6rem)] leading-[0.92] text-white">
                Você já sabe qual{" "}
                <span className="text-imesul-red">material procura?</span>
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-imesul-steel-light/75 sm:text-lg">
                Navegue pelas categorias e selecione um produto real do catálogo IMESUL.
              </p>
            </div>
          </header>

          <ProductCatalog
            selectedCategoryId={selectedCategoryId}
            selectedProductId={selectedProductId}
            onSelectCategory={selectCategory}
            onSelectProduct={selectProduct}
          />

          {selectedProduct && (
            <div className="mt-10">
              <MaterialQuoteFlow
                key={selectedProduct.id}
                product={selectedProduct}
              />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
