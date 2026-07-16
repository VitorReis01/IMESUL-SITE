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

  // Alterna o fundo do cabecalho depois que o Hero comeca a sair da tela.
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 48);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fecha a navegacao mobile assim que um destino e escolhido.
  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <motion.div
        className="fixed left-0 top-0 z-[200] h-[2px] bg-imesul-red origin-left"
        style={{ width: progressWidth }}
      />

      <motion.header
        initial={{ y: -90, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed inset-x-0 top-0 z-[150] transition-all duration-500 ${
          scrolled
            ? "border-b border-white/10 bg-[#050b14]/88 shadow-2xl backdrop-blur-xl"
            : "bg-transparent"
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
              <span className="relative inline-flex items-center rounded-[9px] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.9)_0%,rgba(255,255,255,0.68)_48%,rgba(255,255,255,0.2)_72%,rgba(255,255,255,0)_100%)] px-2 py-0.5 sm:px-2.5">
                <Image
                src="/logo/imesul-logo-completa.webp"
                alt="IMESUL Distribuição"
                  width={707}
                  height={353}
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
                  <span className="font-condensed text-[12px] font-bold tracking-[0.18em] text-white/80 transition-colors duration-300 group-hover:text-white">
                    {link.label}
                  </span>
                  <span className="absolute bottom-1 left-3 right-3 h-px origin-left scale-x-0 bg-imesul-red transition-transform duration-300 group-hover:scale-x-100" />
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setMenuOpen((open) => !open)}
                className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 border border-white/10 xl:hidden"
                aria-label="Menu"
                aria-expanded={menuOpen}
              >
                <span className={`block h-px w-5 bg-white transition-all ${menuOpen ? "translate-y-2 rotate-45" : ""}`} />
                <span className={`block h-px w-5 bg-imesul-red transition-all ${menuOpen ? "opacity-0" : ""}`} />
                <span className={`block h-px w-5 bg-white transition-all ${menuOpen ? "-translate-y-2 -rotate-45" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        <motion.div
          initial={false}
          animate={{ height: menuOpen ? "auto" : 0, opacity: menuOpen ? 1 : 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden border-t border-white/10 bg-[#07101f]/96 backdrop-blur-xl xl:hidden"
        >
          <div className="flex flex-col gap-2 px-6 py-6">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                onClick={closeMenu}
                className="flex items-center gap-3 border-b border-white/8 py-3"
              >
                <span className="h-px w-5 bg-imesul-red" />
                <span className="font-condensed text-[15px] font-bold tracking-[0.18em] text-white/80">
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
