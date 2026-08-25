"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { navLinks, officialUnits } from "../data/products";
import { setStoredUnit } from "../lib/unitPreference";
import { navigateWithConsent, requestOpenPrivacyPreferences } from "../lib/consent";

const socialLinks = [
  {
    label: "Instagram Dourados",
    href: "https://www.instagram.com/imesul_dourados",
  },
  {
    label: "Instagram Campo Grande",
    href: "https://www.instagram.com/imesul_campogrande",
  },
  {
    label: "Facebook Dourados",
    href: "https://web.facebook.com/imesuldouradosms?_rdc=1&_rdr#",
  },
  {
    label: "Facebook Campo Grande",
    href: "https://web.facebook.com/imesulcampograndems?_rdc=1&_rdr#",
  },
];

// Rodape institucional com o mesmo padrao visual usado na area de vendas.
export default function Footer() {
  const year = new Date().getFullYear();
  const footerRef = useRef(null);
  const footerVisibleRef = useRef(false);
  const [footerVisible, setFooterVisible] = useState(false);

  // Revela o rodape com IntersectionObserver sem alterar altura ou espacamento da pagina.
  useEffect(() => {
    const footerNode = footerRef.current;
    if (!footerNode || !("IntersectionObserver" in window)) {
      footerVisibleRef.current = true;
      setFooterVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || footerVisibleRef.current) return;
        footerVisibleRef.current = true;
        setFooterVisible(true);
        observer.disconnect();
      },
      { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );

    observer.observe(footerNode);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <footer
      ref={footerRef}
      className={`relative border-t border-slate-200 bg-white transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
        footerVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      }`}
    >
      <div className="h-px bg-gradient-to-r from-transparent via-imesul-red/35 to-transparent" />

      <div className="mx-auto max-w-[1480px] px-6 py-14 sm:px-8 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_0.7fr_1.35fr_0.72fr]">
          <div className="flex max-w-[430px] flex-col items-center text-center">
            <div className="inline-flex">
              <Image
                src="/images/logo-imesul-oficial.png"
                alt="IMESUL Distribuição"
                width={1600}
                height={477}
                className="h-auto w-[194px] object-contain sm:w-[214px]"
              />
            </div>
            <p className="mt-6 max-w-[390px] text-sm font-bold leading-7 text-slate-800">
              Distribuidora de materiais em aço para construção, serralheria,
              indústria e campo em Mato Grosso do Sul.
            </p>
          </div>

          <div>
            <h2 className="mb-6 flex items-center gap-3 font-condensed text-xs font-semibold uppercase tracking-[0.28em] text-slate-900">
              <span className="h-px w-4 bg-imesul-red" />
              Navegação
            </h2>
            <ul className="flex flex-col gap-3">
              {navLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    onClick={link.unit ? (event) => navigateWithConsent(event, link.href, () => setStoredUnit(link.unit)) : undefined}
                    className="group inline-flex items-center gap-2 font-condensed text-sm font-semibold uppercase tracking-[0.13em] text-slate-700 transition-colors hover:text-imesul-red"
                  >
                    {link.label}
                    {link.external && (
                      <span className="text-imesul-red transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true">
                        ↗
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-6 flex items-center gap-3 font-condensed text-xs font-semibold uppercase tracking-[0.28em] text-slate-900">
              <span className="h-px w-4 bg-imesul-red" />
              Unidades
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
              {officialUnits.map((unit) => (
                <div key={unit.id || unit.name}>
                  <p className="font-condensed text-base font-semibold uppercase tracking-[0.12em] text-slate-900">
                    {unit.name}
                  </p>
                  <a
                    href={unit.mapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 block max-w-[420px] text-sm leading-6 text-slate-700 underline decoration-transparent underline-offset-4 transition-[color,text-decoration-color] hover:text-imesul-red hover:decoration-imesul-red/60"
                  >
                    {unit.address}
                  </a>
                  <a
                    href={unit.phoneHref}
                    className="mt-1.5 inline-block font-mono text-[11px] tracking-[0.12em] text-slate-600 transition-colors hover:text-imesul-red"
                  >
                    Telefone: {unit.phone}
                  </a>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-6 flex items-center gap-3 font-condensed text-xs font-semibold uppercase tracking-[0.28em] text-slate-900">
              <span className="h-px w-4 bg-imesul-red" />
              Links úteis
            </h2>
            <ul className="flex flex-col gap-3">
              {socialLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-2 text-sm text-slate-700 transition-colors hover:text-imesul-red"
                  >
                    {link.label}
                    <span className="text-imesul-red transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true">
                      ↗
                    </span>
                  </a>
                </li>
              ))}
              <li>
                <a href="/politica-de-privacidade" className="text-sm text-slate-700 transition-colors hover:text-imesul-red">
                  Política de Privacidade
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => requestOpenPrivacyPreferences()}
                  className="text-left text-sm text-slate-700 transition-colors hover:text-imesul-red"
                >
                  Preferências de privacidade
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-7 sm:flex-row">
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-600">
            © {year} IMESUL Distribuição. Todos os direitos reservados.
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-600">
            Dourados Centro, Dourados Fábrica e Campo Grande
          </span>
        </div>

        <p className="mt-4 text-center font-mono text-[10px] tracking-[0.04em] text-slate-400">
          Desenvolvido por{" "}
          <a
            href="https://www.instagram.com/vitor.systems?igsi=dWhjZWc2aGl1bG1l"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 underline decoration-transparent underline-offset-2 transition-colors hover:text-imesul-red hover:decoration-imesul-red/50"
          >
            @vitor.systems
          </a>{" "}
          •{" "}
          <a
            href="https://wa.me/5567992490880"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 underline decoration-transparent underline-offset-2 transition-colors hover:text-imesul-red hover:decoration-imesul-red/50"
          >
            (67) 99249-0880
          </a>
        </p>
      </div>
    </footer>
  );
}
