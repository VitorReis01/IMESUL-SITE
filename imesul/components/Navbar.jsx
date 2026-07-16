"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { m as motion, useScroll, useTransform } from "framer-motion";
import { navLinks } from "../data/products";

// Exibe a marca, os links institucionais, o menu mobile e o progresso da pagina.
export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { scrollYProgress } = useScroll();
  const progressWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  // Controla a visibilidade do cabecalho conforme o scroll sem executar trabalho em excesso.
  useEffect(() => {
    let frameId = 0;

    const handleScroll = () => {
      if (frameId) return;

      frameId = window.requestAnimationFrame(() => {
        setScrolled(window.scrollY > 56);
        frameId = 0;
      });
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, []);

  // Fecha a navegacao mobile assim que um destino e escolhido.
  const closeMenu = () => setMenuOpen(false);
  const shouldHideNavbar = scrolled && !menuOpen;

  return (
    <>
      <motion.div
        className="fixed left-0 top-0 z-[200] h-[2px] bg-imesul-red origin-left"
        style={{ width: progressWidth }}
      />

      <motion.header
        initial={{ y: -90, opacity: 0 }}
        animate={{ y: shouldHideNavbar ? -86 : 0, opacity: shouldHideNavbar ? 0 : 1 }}
        transition={{ duration: shouldHideNavbar ? 0.32 : 0.42, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed inset-x-0 top-0 z-[150] border-b border-slate-200/80 bg-white/95 backdrop-blur-xl transition-all duration-500 ${
          scrolled ? "shadow-[0_10px_30px_rgba(15,23,42,0.08)]" : "shadow-none"
        }`}
      >
        <div className="mx-auto max-w-[1600px] px-5 sm:px-8 lg:px-12">
          <div className="flex h-[72px] items-center justify-between gap-4">
            <Link
              href="/"
              className="group flex shrink-0 items-center"
              onClick={closeMenu}
              aria-label="IMESUL Distribuicao"
            >
              {/* Base branca em degradê destaca a logo no header escuro sem clarear o restante do site. */}
              <span className="relative inline-flex items-center">
                <Image
                  src="/images/logo-imesul-oficial.png"
                alt="IMESUL Distribuição"
                  width={1600}
                  height={477}
                  priority
                  className="block h-auto w-[150px] object-contain transition-transform duration-300 ease-out group-hover:-translate-y-px sm:w-[185px] lg:w-[195px] xl:w-[190px]"
                />
              </span>
            </Link>

            <nav className="hidden items-center gap-1 xl:flex">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  className="group relative px-3 py-2"
                >
                  <span className="font-condensed text-[12px] font-bold tracking-[0.18em] text-slate-800 transition-colors duration-300 group-hover:text-imesul-red">
                    {link.label}
                  </span>
                  <span className="absolute bottom-1 left-3 right-3 h-px origin-left scale-x-0 bg-imesul-red transition-transform duration-300 group-hover:scale-x-100" />
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setMenuOpen((open) => !open)}
                className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 border border-slate-200 text-slate-900 xl:hidden"
                aria-label="Menu"
                aria-expanded={menuOpen}
              >
                <span className={`block h-px w-5 bg-slate-900 transition-all ${menuOpen ? "translate-y-2 rotate-45" : ""}`} />
                <span className={`block h-px w-5 bg-imesul-red transition-all ${menuOpen ? "opacity-0" : ""}`} />
                <span className={`block h-px w-5 bg-slate-900 transition-all ${menuOpen ? "-translate-y-2 -rotate-45" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        <motion.div
          initial={false}
          animate={{ height: menuOpen ? "auto" : 0, opacity: menuOpen ? 1 : 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden border-t border-slate-200 bg-white/98 backdrop-blur-xl xl:hidden"
        >
          <div className="flex flex-col gap-2 px-6 py-6">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                onClick={closeMenu}
                className="flex items-center gap-3 border-b border-slate-200 py-3"
              >
                <span className="h-px w-5 bg-imesul-red" />
                <span className="font-condensed text-[15px] font-bold tracking-[0.18em] text-slate-800">
                  {link.label}
                </span>
              </a>
            ))}
          </div>
        </motion.div>
      </motion.header>
    </>
  );
}
