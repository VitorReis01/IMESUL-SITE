"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { navLinks } from "../data/products";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { scrollYProgress } = useScroll();
  const progressWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 48);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
            <a
              href="#inicio"
              className="group flex shrink-0 items-center"
              onClick={closeMenu}
              aria-label="IMESUL Distribuicao"
            >
              <Image
                src="/logo/imesul-logo-completa.png?v=1"
                alt="IMESUL Distribuição"
                width={707}
                height={353}
                priority
                className="block h-auto w-[150px] object-contain transition-transform duration-300 ease-out group-hover:-translate-y-px sm:w-[185px] lg:w-[195px] xl:w-[190px]"
                style={{
                  filter:
                    "brightness(1.15) contrast(1.1) drop-shadow(0 0 6px rgba(255,255,255,.25)) drop-shadow(0 0 12px rgba(255,255,255,.12))",
                }}
              />
            </a>

            <nav className="hidden items-center gap-1 xl:flex">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  className="group relative px-3 py-2"
                >
                  <span className="font-condensed text-[11px] font-semibold tracking-[0.2em] text-imesul-steel transition-colors duration-300 group-hover:text-white">
                    {link.label}
                  </span>
                  <span className="absolute bottom-1 left-3 right-3 h-px origin-left scale-x-0 bg-imesul-red transition-transform duration-300 group-hover:scale-x-100" />
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <a
                href="#cta-final"
                className="hidden items-center gap-3 rounded-[10px] bg-[#25D366] px-5 py-2.5 shadow-[0_0_30px_rgba(37,211,102,0.2)] transition-all duration-300 hover:bg-[#1ebe5d] hover:shadow-[0_0_44px_rgba(37,211,102,0.36)] lg:flex"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                <span className="font-condensed text-[11px] font-bold tracking-[0.18em] text-white">
                  FALE NO WHATSAPP
                </span>
              </a>

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
                <span className="font-condensed text-sm font-semibold tracking-[0.2em] text-imesul-steel">
                  {link.label}
                </span>
              </a>
            ))}
            <a
              href="#cta-final"
              onClick={closeMenu}
              className="mt-3 flex items-center justify-center rounded-[10px] bg-[#25D366] px-5 py-3 transition-colors duration-300 hover:bg-[#1ebe5d]"
            >
              <span className="font-condensed text-xs font-bold tracking-[0.2em] text-white">
                FALE NO WHATSAPP
              </span>
            </a>
          </div>
        </motion.div>
      </motion.header>
    </>
  );
}
