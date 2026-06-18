"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowRight, Check } from "lucide-react";
import { projects } from "../data/projects";
import { getMaterialsByIds, materials } from "../data/materials";

export default function ProjectSelector() {
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedMaterialId, setSelectedMaterialId] = useState(null);
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const recommendedMaterials = selectedProject
    ? getMaterialsByIds(selectedProject.materialIds)
    : [];
  const recommendationNames = [
    ...recommendedMaterials.map((material) => material.name),
    ...(selectedProject?.complementaryMaterials || []),
  ];

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
                onClick={() => setSelectedProjectId(project.id)}
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
                  onClick={() => setSelectedMaterialId(material.id)}
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
        </section>

        <div
          aria-live="polite"
          className={`grid overflow-hidden transition-[grid-template-rows,opacity,margin] duration-500 ${
            selectedProject ? "mt-16 grid-rows-[1fr] opacity-100 sm:mt-20" : "mt-0 grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="min-h-0">
            {selectedProject && (
              <div className="relative overflow-hidden rounded-[6px] border border-imesul-red/30 bg-[#0B192B]/95 px-6 py-8 sm:px-8 lg:flex lg:items-center lg:justify-between lg:gap-12 lg:px-10">
                <div className="absolute inset-y-0 left-0 w-1 bg-imesul-red" />
                <div className="max-w-md">
                  <p className="font-mono text-[10px] tracking-[0.3em] text-imesul-red">
                    MATERIAIS RECOMENDADOS
                  </p>
                  <h2 className="mt-3 font-display text-5xl leading-none text-white">
                    {selectedProject.name}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-imesul-steel/75">
                    Uma seleção inicial para orientar seu projeto. Você poderá revisar essas escolhas nas próximas etapas.
                  </p>
                </div>

                <ul className="mt-7 grid flex-1 gap-2 sm:grid-cols-2 lg:mt-0 lg:max-w-2xl">
                  {recommendationNames.map((material) => (
                    <li
                      key={material}
                      className="flex min-h-12 items-center gap-3 border-b border-white/[0.08] py-3 text-sm font-medium text-imesul-steel-light"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-imesul-red/15 text-imesul-red">
                        <Check size={13} strokeWidth={2.4} aria-hidden="true" />
                      </span>
                      {material}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
