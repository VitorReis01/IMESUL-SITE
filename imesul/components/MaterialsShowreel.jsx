"use client";

// Abertura cinematografica e imersiva do showroom de materiais.
// No desktop, a secao fica pinada (GSAP ScrollTrigger, pin:true) em tela cheia enquanto o usuario
// rola: ha um hold inicial com o video ainda pequeno e o titulo parado, depois o video real da
// fabrica expande quase full-width enquanto o fundo perde forca e o titulo se abre para os lados,
// depois a legenda aparece por cima do video ja grande, e por fim tudo segura parado antes da
// secao liberar o scroll normal para o ProductScrollExperience. O pin substitui o sticky CSS usado
// antes (nao usar os dois juntos) — cleanup via gsap.context().revert(), sem preventDefault, sem
// bloquear wheel/touch, sem window.scrollTo.
// Mobile e reduced-motion caem para um card grande estatico, sem pin e sem scrub.
import { useEffect, useMemo, useRef, useState } from "react";
import { m as motion, useReducedMotion } from "framer-motion";
import useAdaptiveVideoProfile from "../hooks/useAdaptiveVideoProfile";
import { institutionalVideo, VIDEO_DISABLED_PROFILE } from "../data/videoAssets";

// Video proprio do showreel (nao compartilhado com o Hero); um unico arquivo serve todos os
// perfis de viewport, mas o profile "poster" (reduced-motion/save-data) continua desativando-o.
const SHOWREEL_VIDEO_SRC = "/videos/estoque-showreel.mp4";

// Fundo amplo decorativo atras do video/card principal (nao e o poster do video, que continua
// vindo de institutionalVideo.poster para o fallback do <video>).
const SHOWREEL_BACKGROUND_SRC = "/images/company/estrutura-estoque.webp";

export default function MaterialsShowreel() {
  // Decide o layout em JS (nao via variante CSS) para nunca deixar a legenda presa em opacidade 0:
  // sem isso, desktop com reduced-motion herdaria o layout imersivo (posicoes absolutas, legenda
  // escondida) sem nenhum GSAP rodando para revelar nada. null (SSR) conta como "sem reducao".
  const shouldReduceMotion = useReducedMotion();
  const immersive = shouldReduceMotion !== true;
  const sectionRef = useRef(null);
  const bgRef = useRef(null);
  const videoBoxRef = useRef(null);
  const titleLeftRef = useRef(null);
  const titleRightRef = useRef(null);
  const subtitleRef = useRef(null);
  const scrollCueRef = useRef(null);
  const videoRef = useRef(null);
  const [isNear, setIsNear] = useState(false);
  const videoProfile = useAdaptiveVideoProfile({ enabled: isNear });
  const videoSources = useMemo(
    () => (videoProfile === VIDEO_DISABLED_PROFILE ? null : { mp4: SHOWREEL_VIDEO_SRC }),
    [videoProfile]
  );

  // Adia a escolha da fonte de video ate a secao se aproximar da viewport.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || isNear) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "320px" }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [isNear]);

  // Recarrega o video ao trocar de perfil e remove fontes no modo de poster.
  useEffect(() => {
    if (!videoRef.current) return;
    if (!videoSources) {
      videoRef.current.pause();
      videoRef.current.load();
      return;
    }
    videoRef.current.load();
    videoRef.current.play().catch(() => {});
  }, [videoSources]);

  // Pina a secao em tela cheia e expande o video conforme o usuario rola dentro dela.
  // Roda so no desktop com movimento permitido; mobile e reduced-motion ficam no layout estatico.
  useEffect(() => {
    let media;
    let cancelled = false;
    let refreshFrame = 0;
    let refreshShowreel;

    const setup = async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      media = gsap.matchMedia();

      // Recalcula start/end depois que o layout das secoes acima termina de assentar.
      refreshShowreel = () => {
        if (refreshFrame) return;
        refreshFrame = window.requestAnimationFrame(() => {
          refreshFrame = 0;
          ScrollTrigger.refresh();
        });
      };

      media.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        const context = gsap.context(() => {
          // xPercent/yPercent ficam fixos em -50 o tempo todo (nunca entram no timeline abaixo):
          // com left:50%/top:50% no CSS, isso centraliza o video de forma absoluta e imune a
          // qualquer particularidade de centralizacao por flexbox, em qualquer largura.
          gsap.set(videoBoxRef.current, {
            width: "44vw",
            height: "50vh",
            borderRadius: 28,
            xPercent: -50,
            yPercent: -50,
          });
          gsap.set(bgRef.current, { opacity: 0.55, scale: 1.04 });
          gsap.set(subtitleRef.current, { opacity: 0, y: 22 });

          // "top top": a secao pina assim que fica totalmente estabelecida (topo no topo da
          // viewport). "end" e um deslocamento relativo de 170% da altura da viewport a partir
          // dali — essa e a distancia de scroll que o pin "segura" antes de liberar a pagina;
          // pinSpacing garante que o ProductScrollExperience seja empurrado para baixo nessa
          // mesma medida, sem sobrepor a secao pinada.
          const timeline = gsap.timeline({
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top top",
              end: () => `+=${window.innerHeight * 1.7}`,
              scrub: true,
              pin: true,
              pinSpacing: true,
              anticipatePin: 1,
              invalidateOnRefresh: true,
            },
          });

          // Distribuicao (0 a 1 = 0% a 100% do progresso dentro do pin):
          // 0%-20%   hold inicial — nada muda, usuario entende a secao com o video ainda pequeno;
          // 20%-75%  expansao principal — video, fundo e titulo se movem juntos;
          // 75%-90%  refinamento final — a legenda aparece por cima do video ja grande;
          // 90%-100% hold final — tudo parado antes do pin liberar o scroll normal.
          timeline
            .to(scrollCueRef.current, { opacity: 0, y: -10, ease: "none", duration: 0.15 }, 0.05)
            .to(videoBoxRef.current, { width: "91vw", height: "82vh", borderRadius: 11, ease: "none", duration: 0.55 }, 0.2)
            .to(bgRef.current, { opacity: 0.15, scale: 1.14, ease: "none", duration: 0.55 }, 0.2)
            .to(titleLeftRef.current, { xPercent: -70, opacity: 0, ease: "none", duration: 0.55 }, 0.2)
            .to(titleRightRef.current, { xPercent: 70, opacity: 0, ease: "none", duration: 0.55 }, 0.2)
            .to(subtitleRef.current, { opacity: 1, y: 0, ease: "none", duration: 0.15 }, 0.75)
            .to({}, { duration: 0.1 }, 0.9);
        }, sectionRef);

        refreshShowreel();
        window.addEventListener("load", refreshShowreel, { once: true });
        window.addEventListener("resize", refreshShowreel);

        return () => context.revert();
      });
    };

    setup();

    return () => {
      cancelled = true;
      if (refreshFrame) window.cancelAnimationFrame(refreshFrame);
      if (refreshShowreel) {
        window.removeEventListener("load", refreshShowreel);
        window.removeEventListener("resize", refreshShowreel);
      }
      media?.revert();
    };
  }, []);

  return (
    <section
      id="showroom-abertura"
      ref={sectionRef}
      className={`relative h-auto overflow-hidden bg-[#050b14] py-24 sm:py-28 ${
        immersive ? "lg:h-screen lg:py-0" : ""
      }`}
    >
      <div
        className={`relative flex h-full w-full flex-col items-center px-6 sm:px-8 lg:px-12 ${
          immersive ? "lg:h-screen lg:justify-center lg:overflow-hidden" : ""
        }`}
      >
        {/* Fundo amplo: o mesmo frame real da fabrica, escurecido, ocupando a viewport inteira no desktop. */}
        <div ref={bgRef} aria-hidden="true" className="absolute inset-0 opacity-40 lg:opacity-55">
          {/* eslint-disable-next-line @next/next/no-img-element -- fundo decorativo animado via ref/GSAP, sem necessidade de otimizacao responsiva do next/image. */}
          <img
            src={SHOWREEL_BACKGROUND_SRC}
            alt=""
            className="h-full w-full object-cover"
            draggable="false"
          />
        </div>
        <div className="absolute inset-0 bg-[#050b14]/72" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(47,104,171,0.14),transparent_42%)]" />
        <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(90deg,rgba(255,255,255,0.09)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:86px_86px]" />

        <div
          className={`relative z-10 flex w-full max-w-[1400px] flex-1 flex-col items-center justify-center py-16 ${
            immersive ? "lg:h-full lg:py-0" : ""
          }`}
        >
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.6 }}
            className={`flex items-center gap-4 ${immersive ? "lg:absolute lg:left-0 lg:right-0 lg:top-[7%]" : ""}`}
          >
            <span className="h-px w-10 bg-imesul-red" />
            <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-imesul-red">
              Showroom IMESUL
            </span>
            <span className="h-px w-10 bg-imesul-red" />
          </motion.div>

          <h2
            className={`mt-6 flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 text-center font-display leading-[0.94] text-white [font-size:clamp(2.2rem,5vw,4.2rem)] ${
              immersive ? "lg:absolute lg:left-0 lg:right-0 lg:top-[19%] lg:mt-0" : ""
            }`}
          >
            <span ref={titleLeftRef}>Materiais que sustentam</span>
            <span ref={titleRightRef}>grandes projetos</span>
          </h2>

          <div
            ref={videoBoxRef}
            className={`relative z-20 mx-auto mt-14 aspect-video w-full max-w-3xl overflow-hidden rounded-[20px] shadow-[0_50px_150px_rgba(0,0,0,0.55)] ${
              immersive
                ? "lg:absolute lg:left-1/2 lg:top-1/2 lg:mx-0 lg:mt-0 lg:w-auto lg:[max-width:calc(100vw-96px)]"
                : ""
            }`}
          >
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              autoPlay={Boolean(videoSources)}
              muted
              loop
              playsInline
              preload="none"
              poster={institutionalVideo.poster}
              aria-label="Movimentação de materiais e estrutura da fábrica da IMESUL"
            >
              {videoSources?.mp4 && <source src={videoSources.mp4} type="video/mp4" />}
            </video>
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,8,18,0.18)_0%,transparent_30%,transparent_65%,rgba(2,8,18,0.6)_100%)]" />
          </div>

          <p
            ref={subtitleRef}
            className={`mt-10 max-w-xl text-center text-base leading-relaxed text-imesul-steel-light/80 sm:text-lg ${
              immersive ? "lg:absolute lg:bottom-[9%] lg:left-0 lg:right-0 lg:mt-0 lg:opacity-0" : ""
            }`}
          >
            Da estrutura ao acabamento, a Imesul conecta estoque, atendimento e logística para
            obras, serralherias, indústrias e produtores rurais.
          </p>
        </div>

        <motion.div
          ref={scrollCueRef}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className={`relative z-10 mt-10 flex flex-col items-center gap-2 pb-16 text-center ${
            immersive ? "lg:absolute lg:bottom-[3%] lg:left-0 lg:right-0 lg:mt-0 lg:pb-0" : ""
          }`}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-imesul-steel-light/55">
            Role para conhecer os materiais
          </span>
          <span
            aria-hidden="true"
            className="h-6 w-px animate-bounce bg-gradient-to-b from-imesul-red to-transparent"
          />
        </motion.div>
      </div>
    </section>
  );
}
