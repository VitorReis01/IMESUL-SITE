"use client";

import Image from "next/image";
import { navLinks } from "../data/products";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative border-t border-white/5 bg-[#040811]">
      <div className="h-px bg-gradient-to-r from-transparent via-imesul-red/50 to-transparent" />

      <div className="mx-auto max-w-[1600px] px-6 py-14 sm:px-8 lg:px-16">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
          <div>
            <div className="mb-6 flex items-center">
              <div className="w-[130px] lg:w-[150px] xl:w-[170px]">
                <Image
                  src="/logo/imesul-logo-completa.png?v=1"
                  alt="IMESUL Distribuição"
                  width={707}
                  height={353}
                  className="block h-auto w-full object-contain"
                  style={{
                    filter:
                      "brightness(1.15) contrast(1.1) drop-shadow(0 0 6px rgba(255,255,255,.25)) drop-shadow(0 0 12px rgba(255,255,255,.12))",
                  }}
                />
              </div>
              <div className="sr-only">
                <span className="font-display text-xl tracking-[0.2em] text-white">IMESUL</span>
                <span className="font-condensed text-[10px] tracking-[0.35em] text-imesul-steel uppercase">
                  DISTRIBUIÇÃO
                </span>
              </div>
            </div>
            <p className="max-w-[380px] text-sm leading-relaxed text-imesul-steel/55">
              Distribuidora de aço com grande estoque, atendimento técnico e soluções completas para construção,
              indústria e serralheria em Mato Grosso do Sul.
            </p>
          </div>

          <div>
            <h4 className="mb-6 flex items-center gap-3 font-condensed text-xs font-semibold tracking-[0.3em] text-white uppercase">
              <span className="h-px w-3 bg-imesul-red" />
              NAVEGAÇÃO
            </h4>
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
                    <span className="font-condensed text-xs tracking-[0.15em] text-imesul-steel/55 transition-colors duration-300 group-hover:text-white">
                      {link.label}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-6 flex items-center gap-3 font-condensed text-xs font-semibold tracking-[0.3em] text-white uppercase">
              <span className="h-px w-3 bg-imesul-red" />
              UNIDADES
            </h4>
            <div className="flex flex-col gap-6">
              {[
                { city: "Campo Grande", href: "https://grupoimesul.com.br/campogrande/" },
                { city: "Dourados", href: "https://grupoimesul.com.br/dourados/" },
              ].map((unit) => (
                <a key={unit.city} href={unit.href} target="_blank" rel="noopener noreferrer" className="group">
                  <p className="font-condensed text-sm font-semibold tracking-[0.15em] text-white transition-colors group-hover:text-imesul-red">
                    {unit.city}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-imesul-steel/42">
                    Mato Grosso do Sul
                  </p>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 sm:flex-row">
          <span className="font-mono text-[10px] tracking-[0.25em] text-imesul-steel/28">
            © {year} IMESUL DISTRIBUIÇÃO. TODOS OS DIREITOS RESERVADOS.
          </span>
          <span className="font-mono text-[10px] tracking-[0.25em] text-imesul-steel/28">
            CAMPO GRANDE & DOURADOS — MS
          </span>
        </div>
      </div>
    </footer>
  );
}
