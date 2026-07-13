"use client";

import { useRef, useEffect } from "react";
import { m as motion } from "framer-motion";
import { benefits } from "../data/products";

// Icones locais evitam uma dependencia externa para quatro desenhos simples.
const icons = {
  warehouse: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  shield: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  ),
  truck: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="3" width="15" height="13"/>
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
      <circle cx="5.5" cy="18.5" r="2.5"/>
      <circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  ),
  headset: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 18v-6a9 9 0 0118 0v6"/>
      <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/>
    </svg>
  ),
};

// Apresenta os diferenciais, a cobertura regional e as tres unidades de atendimento.
export default function WhyChoose() {
  const sectionRef = useRef(null);
  const cardsRef = useRef([]);

  // Revela cada card quando a secao entra na tela e limpa os gatilhos ao desmontar.
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
      cardsRef.current.forEach((card, i) => {
        if (!card) return;
        gsap.fromTo(
          card,
          { y: 50, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: "power3.out",
            delay: i * 0.1,
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 70%",
            },
          }
        );
      });
      }, sectionRef);
    };

    setup();

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, []);

  return (
    <section id="diferenciais" ref={sectionRef} className="relative py-24 lg:py-36 bg-imesul-blue overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(212,43,43,0.5), transparent)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 30% 50%, rgba(212,43,43,0.05) 0%, transparent 60%)",
        }}
      />

      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-display text-white/[0.025] select-none pointer-events-none"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(8rem, 18vw, 16rem)",
          letterSpacing: "0.1em",
        }}
        aria-hidden="true"
      >
        QUALIDADE
      </div>

      <div className="max-w-[1600px] mx-auto px-8 lg:px-16 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center text-center mb-20"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-px bg-imesul-red" />
            <span
              className="font-mono text-imesul-red text-[10px] tracking-[0.4em] uppercase"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              NOSSOS DIFERENCIAIS
            </span>
            <div className="w-12 h-px bg-imesul-red" />
          </div>
          <h2
            className="font-display text-white leading-none"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2.5rem, 5vw, 5rem)",
              letterSpacing: "0.03em",
            }}
          >
            POR QUE ESCOLHER
            <br />
            A <span style={{ color: "#D42B2B" }}>IMESUL</span>?
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {benefits.map((benefit, i) => (
            <div
              key={i}
              ref={(el) => (cardsRef.current[i] = el)}
              className="relative group p-8 border border-white/5 hover:border-imesul-red/30 transition-all duration-500 hover:bg-imesul-blue-light/30"
            >
              <div
                className="absolute top-4 right-5 font-mono text-[11px] text-white/10"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {benefit.number}
              </div>

              <div className="w-14 h-14 border border-imesul-red/30 group-hover:border-imesul-red/70 flex items-center justify-center text-imesul-red mb-6 transition-colors duration-500">
                {icons[benefit.icon]}
              </div>

              <h3
                className="font-display text-white text-2xl mb-3 group-hover:text-imesul-steel-light transition-colors"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}
              >
                {benefit.title}
              </h3>

              <p
                className="font-body text-imesul-steel/60 text-sm leading-relaxed"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {benefit.description}
              </p>

              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-imesul-red/0 via-imesul-red/40 to-imesul-red/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.7 }}
          className="mt-20 p-8 border border-white/5 bg-imesul-blue-mid/40 flex flex-col lg:flex-row items-center justify-between gap-8"
        >
          <div className="flex flex-col gap-1 text-center lg:text-left">
            <span
              className="font-display text-white text-3xl"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}
            >
              ATENDEMOS TODO O MATO GROSSO DO SUL
            </span>
            <span
              className="font-condensed text-imesul-steel/50 text-xs tracking-[0.25em] uppercase"
              style={{ fontFamily: "var(--font-condensed)" }}
            >
              Unidades em Campo Grande e Dourados com entrega regional
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-6">
            {[
              { city: "Dourados", label: "MATRIZ" },
              { city: "Dourados", label: "LOJA DE FÁBRICA" },
              { city: "Campo Grande", label: "UNIDADE 02" },
            ].map((unit, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="w-2 h-2 bg-imesul-red mb-1" />
                <span
                  className="font-display text-white text-xl"
                  style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}
                >
                  {unit.city}
                </span>
                <span
                  className="font-mono text-imesul-steel/40 text-[9px] tracking-[0.35em]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {unit.label}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
