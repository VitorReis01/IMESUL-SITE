"use client";

import { useEffect, useRef } from "react";
import { m as motion } from "framer-motion";
import { salesSiteUrl, whatsapp } from "../data/products";

// Encerra a apresentacao com acesso ao WhatsApp e a Area de Vendas.
export default function FinalCTA() {
  const sectionRef = useRef(null);
  const ringRef = useRef(null);
  const waUrl = `https://wa.me/${whatsapp.number}?text=${encodeURIComponent(whatsapp.message)}`;

  // Usa a rolagem para dar profundidade ao anel e remove o contexto ao desmontar.
  useEffect(() => {
    let ctx;
    let cancelled = false;

    const setup = async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      ctx = gsap.context(() => {
        gsap.fromTo(
          ringRef.current,
          { scale: 0.82, rotate: -8, opacity: 0.45 },
          {
            scale: 1.08,
            rotate: 8,
            opacity: 1,
            ease: "none",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          }
        );
      }, sectionRef);
    };

    setup();

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, []);

  return (
    <section id="cta-final" ref={sectionRef} className="relative min-h-[82vh] overflow-hidden bg-[#050b14]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(212,43,43,0.22),transparent_30%),radial-gradient(circle_at_70%_70%,rgba(66,132,202,0.2),transparent_34%),linear-gradient(180deg,#050b14_0%,#0A1628_100%)]" />
      <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(120deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:38px_38px]" />
      {/* Marca d'agua decorativa do CTA fica atras da chamada para preservar os cliques. */}
      <div className="imesul-logo-watermark" aria-hidden="true" />

      <div ref={ringRef} className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-imesul-red/20 shadow-[0_0_100px_rgba(212,43,43,0.16)]" />
      <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />

      <div className="relative z-10 mx-auto flex min-h-[82vh] max-w-[1200px] flex-col items-center justify-center px-6 py-24 text-center">
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="font-mono text-[10px] tracking-[0.46em] text-imesul-red"
        >
          APRESENTAÇÃO FINALIZADA.
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 34 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.85, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="mt-7 font-display leading-[0.92] text-white"
          style={{ fontSize: "clamp(3.7rem, 9vw, 9rem)" }}
        >
          AGORA FALE COM
          <br />
          A <span className="text-imesul-red text-glow-red">IMESUL</span>
          <br />
          PARA ORÇAR.
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.75, delay: 0.22 }}
          className="mt-10 flex flex-col gap-4 sm:flex-row"
        >
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative overflow-hidden rounded-[10px] bg-[#25D366] px-8 py-4 text-center transition-all duration-300 hover:bg-[#1ebe5d] hover:shadow-[0_10px_54px_rgba(37,211,102,0.36)]"
          >
            <span className="relative z-10 font-condensed text-sm font-bold tracking-[0.22em] text-white">
              FALAR NO WHATSAPP
            </span>
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/14 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          </a>

          <a
            href={salesSiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[10px] border border-white/18 px-8 py-4 text-center transition-all duration-300 hover:border-imesul-red/60 hover:bg-white/[0.04]"
          >
            <span className="font-condensed text-sm font-bold tracking-[0.22em] text-imesul-steel-light">
              VER SITE DE VENDAS
            </span>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
