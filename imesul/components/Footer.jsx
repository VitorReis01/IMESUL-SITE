"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { navLinks, officialUnits } from "../data/products";

// Reune marca, navegacao, enderecos, telefones e links verificados do Google Maps.
export default function Footer() {
  const year = new Date().getFullYear();
  const footerRef = useRef(null);
  const footerVisibleRef = useRef(false);
  const [footerVisible, setFooterVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Revela o rodape com IntersectionObserver sem alterar altura ou espacamento da pagina.
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncReducedMotion = () => {
      setReducedMotion(media.matches);
      if (media.matches && !footerVisibleRef.current) {
        footerVisibleRef.current = true;
        setFooterVisible(true);
      }
    };

    syncReducedMotion();

    const addMediaListener = media.addEventListener
      ? () => media.addEventListener("change", syncReducedMotion)
      : () => media.addListener(syncReducedMotion);
    const removeMediaListener = media.removeEventListener
      ? () => media.removeEventListener("change", syncReducedMotion)
      : () => media.removeListener(syncReducedMotion);

    addMediaListener();

    const footerNode = footerRef.current;
    if (media.matches || !footerNode || !("IntersectionObserver" in window)) {
      footerVisibleRef.current = true;
      setFooterVisible(true);
      return removeMediaListener;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const nextVisible = entry.isIntersecting;
        if (footerVisibleRef.current !== nextVisible) {
          footerVisibleRef.current = nextVisible;
          setFooterVisible(nextVisible);
        }
      },
      { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );

    observer.observe(footerNode);

    return () => {
      observer.disconnect();
      removeMediaListener();
    };
  }, []);

  return (
    <footer
      ref={footerRef}
      className={`relative border-t border-slate-200 bg-white transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none ${
        reducedMotion || footerVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      }`}
    >
      <div className="h-px bg-gradient-to-r from-transparent via-imesul-red/35 to-transparent" />

      <div className="mx-auto max-w-[1600px] px-6 py-14 sm:px-8 lg:px-16">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-[1.15fr_0.65fr_1.45fr]">
          <div>
            <div className="mb-6 flex items-center">
              {/* Base branca em degradê mantém a marca legível no rodapé escuro sem alterar o restante da seção. */}
              <div className="inline-flex">
                <div className="w-[162px] sm:w-[182px] lg:w-[202px]">
                  <Image
                    src="/images/logo-imesul-oficial.png"
                  alt="IMESUL Distribuição"
                    width={1600}
                    height={477}
                    className="block h-auto w-full object-contain"
                  />
                </div>
              </div>
              <div className="sr-only">
                <span className="font-display text-xl tracking-[0.2em] text-white">IMESUL</span>
                <span className="font-condensed text-[10px] tracking-[0.35em] text-slate-700 uppercase">
                  DISTRIBUIÇÃO
                </span>
              </div>
            </div>
            <p className="max-w-[410px] text-sm font-bold leading-relaxed text-slate-800">
              Distribuidora de aço com grande estoque, atendimento técnico e soluções completas para construção,
              indústria e serralheria em Mato Grosso do Sul.
            </p>
          </div>

          <div>
            <h2 className="mb-6 flex items-center gap-3 font-condensed text-xs font-semibold tracking-[0.3em] text-slate-900 uppercase">
              <span className="h-px w-3 bg-imesul-red" />
              NAVEGAÇÃO
            </h2>
            <ul className="flex flex-col gap-3">
              {navLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className="group flex items-center gap-2"
                  >
                    <span className="h-px w-0 bg-imesul-red transition-all duration-300 group-hover:w-3" />
                    <span className="font-condensed text-xs tracking-[0.15em] text-slate-700 transition-colors duration-300 group-hover:text-imesul-red">
                      {link.label}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-6 flex items-center gap-3 font-condensed text-xs font-semibold tracking-[0.3em] text-slate-900 uppercase">
              <span className="h-px w-3 bg-imesul-red" />
              UNIDADES
            </h2>
            <div className="flex flex-col gap-7">
              {officialUnits.map((unit) => (
                <div key={unit.name}>
                  <p className="font-condensed text-sm font-semibold tracking-[0.15em] text-slate-900">
                    {unit.name}
                  </p>
                  <a
                    href={unit.mapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block max-w-[390px] text-xs leading-relaxed text-slate-700 underline decoration-transparent underline-offset-4 transition-[color,text-decoration-color] duration-200 hover:text-imesul-red hover:decoration-imesul-red/60"
                  >
                    {unit.address}
                  </a>
                  <a
                    href={unit.phoneHref}
                    className="mt-1.5 inline-block font-mono text-[10px] tracking-[0.12em] text-slate-600 transition-colors duration-300 hover:text-imesul-red"
                  >
                    Telefone: {unit.phone}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-8 sm:flex-row">
          <span className="font-mono text-[10px] tracking-[0.25em] text-slate-600">
            © {year} IMESUL DISTRIBUIÇÃO. TODOS OS DIREITOS RESERVADOS.
          </span>
          <span className="font-mono text-[10px] tracking-[0.25em] text-slate-600">
            CAMPO GRANDE & DOURADOS — MS
          </span>
        </div>
      </div>
    </footer>
  );
}
