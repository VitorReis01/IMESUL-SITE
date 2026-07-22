"use client";

// Ponte curta entre o showroom de produtos e o CTA final.
// Desktop: a secao pina (GSAP ScrollTrigger, pin:true, sem scrub) assim que chega ao topo da tela; o
// pin apenas segura a posicao — a troca das palavras roda sozinha por tempo (setTimeout), nao por
// progresso de scroll. Ao terminar em "E MUITO MAIS" a sequencia para; a partir dai o scroll do
// usuario segue normalmente ate consumir a distancia reservada pelo pin e liberar para o FinalCTA.
// Mobile/tablet: mesma sequencia automatica, sem pin, disparada ao entrar na viewport (uma vez).
// prefers-reduced-motion: so "E MUITO MAIS" estatico, sem pin, sem timers.
import { useEffect, useRef, useState } from "react";
import { m as motion, AnimatePresence, useReducedMotion } from "framer-motion";

const WORDS = [
  "TELHAS",
  "TUBOS",
  "CHAPAS",
  "PERFIS",
  "ACESSÓRIOS",
  "STEEL DECK",
  "PAINÉIS",
  "E MUITO MAIS",
];

const LAST_INDEX = WORDS.length - 1;
const STEP_MS = 500; // cada palavra fica ~500ms em tela (dentro de 350-500ms pedido)
const SETTLE_MS = 850; // segura "E MUITO MAIS" mais um pouco antes de liberar (dentro de 700-1000ms)

export default function MoreMaterialsMorph() {
  const shouldReduceMotion = useReducedMotion();
  const sectionRef = useRef(null);
  const hasPlayedRef = useRef(false);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [settled, setSettled] = useState(false);

  const finished = index >= LAST_INDEX;

  // Dispara a sequencia automatica uma unica vez, vinda de duas fontes possiveis:
  // o onEnter do pin no desktop, ou o IntersectionObserver no mobile/tablet (guardado por largura
  // para nunca disparar no desktop, onde quem inicia é o pin).
  const startSequence = () => {
    if (hasPlayedRef.current) return;
    hasPlayedRef.current = true;
    setStarted(true);
  };

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || shouldReduceMotion) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && window.innerWidth < 1024) {
          startSequence();
          observer.disconnect();
        }
      },
      { rootMargin: "-10% 0px" }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [shouldReduceMotion]);

  // Avanca uma palavra por vez ate a ultima, depois segura por SETTLE_MS e para — sem RAF, sem scrub.
  useEffect(() => {
    if (!started || shouldReduceMotion) return undefined;

    if (index < LAST_INDEX) {
      const timeoutId = window.setTimeout(() => {
        setIndex((current) => Math.min(current + 1, LAST_INDEX));
      }, STEP_MS);
      return () => window.clearTimeout(timeoutId);
    }

    const settleTimeoutId = window.setTimeout(() => setSettled(true), SETTLE_MS);
    return () => window.clearTimeout(settleTimeoutId);
  }, [started, index, shouldReduceMotion]);

  // Desktop: cria apenas o pin (sem timeline/scrub) e chama startSequence() quando ele engatar.
  useEffect(() => {
    let media;
    let cancelled = false;
    let refreshTimeoutId;
    let refreshMorph;

    const setup = async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      media = gsap.matchMedia();

      // Debounce simples (sem requestAnimationFrame) para recalcular start/end apos load/resize.
      refreshMorph = () => {
        window.clearTimeout(refreshTimeoutId);
        refreshTimeoutId = window.setTimeout(() => {
          ScrollTrigger.refresh();
        }, 150);
      };

      media.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        const context = gsap.context(() => {
          // "top top": pina assim que a secao chega ao topo da viewport. "end" reserva ~130vh de
          // distancia de scroll — o suficiente, num scroll normal, para a sequencia automatica
          // (~4,35s) terminar antes do usuario atravessar essa distancia e liberar o pin. Sem scrub:
          // a troca das palavras roda por tempo (startSequence), o pin so segura a posicao na tela.
          ScrollTrigger.create({
            trigger: sectionRef.current,
            start: "top top",
            end: () => `+=${window.innerHeight * 1.3}`,
            pin: true,
            pinSpacing: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onEnter: startSequence,
          });
        }, sectionRef);

        refreshMorph();
        window.addEventListener("load", refreshMorph, { once: true });
        window.addEventListener("resize", refreshMorph);

        return () => context.revert();
      });
    };

    setup();

    return () => {
      cancelled = true;
      window.clearTimeout(refreshTimeoutId);
      if (refreshMorph) {
        window.removeEventListener("load", refreshMorph);
        window.removeEventListener("resize", refreshMorph);
      }
      media?.revert();
    };
  }, []);

  const word = WORDS[index];

  return (
    <section
      ref={sectionRef}
      className={`relative overflow-hidden bg-[#050b14] py-28 sm:py-32 ${
        !shouldReduceMotion ? "lg:flex lg:h-screen lg:flex-col lg:items-center lg:justify-center lg:py-0" : ""
      }`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(212,43,43,0.1),transparent_45%),linear-gradient(180deg,#050b14_0%,#07101c_100%)]" />
      <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(90deg,rgba(255,255,255,0.09)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:86px_86px]" />

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-4"
        >
          <span className="h-px w-10 bg-imesul-red" />
          <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-imesul-red">
            Linha completa
          </span>
          <span className="h-px w-10 bg-imesul-red" />
        </motion.div>

        <div className="relative mt-8 min-h-[100px] w-full sm:min-h-[130px] lg:min-h-[210px]">
          {shouldReduceMotion ? (
            <span className="absolute inset-0 flex items-center justify-center whitespace-nowrap font-display uppercase leading-none text-imesul-red text-glow-red [font-size:clamp(2.4rem,9vw,7rem)]">
              E MUITO MAIS
            </span>
          ) : (
            <AnimatePresence initial={false}>
              <motion.span
                key={word}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, scale: settled ? 1.12 : finished ? 1.04 : 1 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className={`absolute inset-0 flex items-center justify-center whitespace-nowrap font-display uppercase leading-none [font-size:clamp(2.1rem,9vw,4.5rem)] lg:[font-size:clamp(3rem,7vw,8rem)] ${
                  finished ? "text-imesul-red text-glow-red" : "text-white"
                }`}
              >
                {word}
              </motion.span>
            </AnimatePresence>
          )}
        </div>

        <span className="sr-only">
          Materiais em destaque: telhas, tubos, chapas, perfis, acessórios, steel deck, painéis e
          muito mais.
        </span>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-8 max-w-xl text-sm leading-relaxed text-imesul-steel-light/72 sm:text-base"
        >
          Além dos principais materiais, a Imesul oferece uma linha completa para obras,
          serralherias, indústrias e produtores rurais.
        </motion.p>

        <motion.span
          aria-hidden="true"
          initial={{ scaleX: 0, opacity: 0 }}
          whileInView={{ scaleX: 1, opacity: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10 h-px w-40 origin-center bg-gradient-to-r from-transparent via-imesul-red to-transparent"
        />
      </div>
    </section>
  );
}
