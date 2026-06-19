"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowRight, Check } from "lucide-react";
import { projects } from "../data/projects";
import { materials } from "../data/materials";
import { MaterialQuoteFlow, ProjectQuoteFlow } from "./QuoteBuilder";

export default function ProjectSelector() {
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedMaterialId, setSelectedMaterialId] = useState(null);
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const selectedMaterial = materials.find(
    (material) => material.id === selectedMaterialId
  );

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
    setSelectedMaterialId(null);
    scrollToFlow("project-quote-flow");
  };

  const selectMaterial = (materialId) => {
    setSelectedMaterialId(materialId);
    setSelectedProjectId(null);
    scrollToFlow("material-quote-flow");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-imesul-blue">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(212,43,43,0.13),transparent_25%),radial-gradient(circle_at_88%_72%,rgba(52,105,170,0.14),transparent_32%),linear-gradient(180deg,#07101D_0%,#0B192B_55%,#07101D_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:72px_72px]" />

      <header className="relative z-20 border-b border-white/[0.08] bg-[#050b14]/70 backdrop-blur-xl">
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

      <section className="relative z-10 mx-auto max-w-[1480px] px-6 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
        <div className="max-w-4xl">
          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] tracking-[0.4em] text-imesul-red">
              ÁREA DE VENDAS
            </span>
            <span className="h-px w-14 bg-imesul-red" />
          </div>

          <h1 className="mt-6 font-display text-[clamp(3.6rem,7vw,7.4rem)] leading-[0.9] tracking-[0.02em] text-white">
            O que você está <span className="block text-imesul-red">construindo?</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-imesul-steel-light/70 sm:text-lg">
            Selecione seu projeto e descubra os materiais recomendados.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
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
                className={`group relative min-h-[196px] overflow-hidden rounded-[6px] border p-6 text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imesul-red focus-visible:ring-offset-2 focus-visible:ring-offset-imesul-blue ${
                  isSelected
                    ? "border-imesul-red bg-imesul-red/[0.09] shadow-[0_20px_60px_rgba(212,43,43,0.15)]"
                    : "border-white/[0.1] bg-white/[0.025] hover:-translate-y-1 hover:border-imesul-red/50 hover:bg-white/[0.045]"
                }`}
              >
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-[5px] border transition-colors duration-300 ${
                    isSelected
                      ? "border-imesul-red bg-imesul-red text-white"
                      : "border-white/10 bg-white/[0.04] text-imesul-steel-light group-hover:border-imesul-red/40 group-hover:text-white"
                  }`}
                >
                  <Icon size={22} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <span className="mt-6 block font-condensed text-xl font-semibold text-white">
                  {project.name}
                </span>
                <span className="mt-2 block text-sm leading-relaxed text-imesul-steel/75">
                  {project.description}
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

        <section className="mt-24 border-t border-white/[0.08] pt-20 sm:mt-28 sm:pt-24">
          <div className="max-w-4xl">
            <div className="flex items-center gap-4">
              <span className="font-mono text-[10px] tracking-[0.4em] text-imesul-red">
                CATÁLOGO DIRETO
              </span>
              <span className="h-px w-14 bg-imesul-red" />
            </div>

            <h2 className="mt-6 max-w-4xl font-display text-[clamp(3rem,5.5vw,5.8rem)] leading-[0.94] tracking-[0.02em] text-white">
              Você já sabe qual <span className="text-imesul-red">material procura?</span>
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-imesul-steel-light/70 sm:text-lg">
              Veja os principais materiais disponíveis na IMESUL.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {materials.map((material) => {
              const Icon = material.icon;
              const isSelected = material.id === selectedMaterialId;

              return (
                <button
                  key={material.id}
                  type="button"
                  data-testid={`material-${material.id}`}
                  aria-pressed={isSelected}
                  onClick={() => selectMaterial(material.id)}
                  className={`group relative flex min-h-[218px] flex-col overflow-hidden rounded-[6px] border p-6 text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imesul-red focus-visible:ring-offset-2 focus-visible:ring-offset-imesul-blue ${
                    isSelected
                      ? "border-imesul-red/80 bg-imesul-red/[0.08] shadow-[0_18px_50px_rgba(212,43,43,0.12)]"
                      : "border-white/[0.1] bg-[#0B192B]/70 hover:-translate-y-1 hover:border-imesul-red/45 hover:bg-[#102039]"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-[5px] border transition-colors duration-300 ${
                      isSelected
                        ? "border-imesul-red bg-imesul-red text-white"
                        : "border-white/10 bg-white/[0.035] text-imesul-steel-light group-hover:border-imesul-red/35 group-hover:text-white"
                    }`}
                  >
                    <Icon size={21} strokeWidth={1.7} aria-hidden="true" />
                  </span>

                  <span className="mt-5 block font-condensed text-xl font-semibold text-white">
                    {material.name}
                  </span>
                  <span className="mt-2 block text-sm leading-relaxed text-imesul-steel/75">
                    {material.description}
                  </span>

                  <span
                    className={`mt-auto flex items-center gap-2 pt-5 font-condensed text-xs font-semibold uppercase tracking-[0.15em] transition-colors ${
                      isSelected ? "text-imesul-red" : "text-imesul-steel-light/70 group-hover:text-white"
                    }`}
                  >
                    {isSelected ? "Material selecionado" : "Selecionar material"}
                    {isSelected ? (
                      <Check size={14} strokeWidth={2.2} aria-hidden="true" />
                    ) : (
                      <ArrowRight
                        size={14}
                        className="transition-transform duration-300 group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    )}
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

          {selectedMaterial && (
            <div className="mt-10">
              <MaterialQuoteFlow
                key={selectedMaterial.id}
                material={selectedMaterial}
              />
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
