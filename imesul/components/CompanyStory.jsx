"use client";

import Image from "next/image";
import { m as motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import useAdaptiveVideoProfile from "../hooks/useAdaptiveVideoProfile";
import useCompatibility from "../hooks/useCompatibility";
import { getInstitutionalVideoSources, institutionalVideo } from "../data/videoAssets";

// Conteudo editorial dos cinco paineis anteriores ao video institucional.
const chapters = [
  {
    number: "01",
    eyebrow: "ARQUIVO HISTÓRICO IMESUL",
    title: "45 anos de tradição",
    text: "Há mais de 45 anos a IMESUL fornece aço e soluções para construção, indústria, serralheria e agronegócio em Mato Grosso do Sul.",
    image: "/images/company/historia-imesul.webp",
    imageAlt: "Registro histórico da unidade da IMESUL",
  },
  {
    number: "02",
    eyebrow: "ONDE TUDO COMEÇOU",
    title: "Matriz em Dourados",
    text: "A história da IMESUL começou em Dourados e cresceu acompanhando o desenvolvimento da região.",
    image: "/images/company/matriz-dourados.webp",
    imageAlt: "Matriz da IMESUL vista do alto em Dourados",
  },
  {
    number: "03",
    eyebrow: "CONFIANÇA CONSTRUÍDA",
    title: "+1 milhão de clientes atendidos",
    text: "Ao longo das décadas, milhares de profissionais, empresas, construtoras, serralheiros e produtores rurais confiaram na IMESUL.",
    metric: "+1M",
    metricLabel: "CLIENTES ATENDIDOS",
    image: "/images/company/clientes-imesul.webp",
    imageAlt: "Estrutura da IMESUL integrada à região de Dourados",
  },
  {
    number: "04",
    eyebrow: "PRONTA ENTREGA",
    title: "Estrutura e estoque",
    text: "Tubos, chapas, perfis, telhas, laminados e acessórios disponíveis para atender desde pequenas demandas até grandes projetos.",
    image: "/images/company/estrutura-estoque.webp",
    imageAlt: "Vista aproximada da estrutura industrial da IMESUL",
  },
  {
    number: "05",
    eyebrow: "CREDIBILIDADE IMESUL",
    title: "Por que escolher a IMESUL",
    highlights: [
      "Mais de 45 anos de mercado",
      "Estoque próprio",
      "Atendimento especializado",
      "Entrega regional",
      "Mais de 1 milhão de clientes atendidos",
      "Campo Grande e Dourados",
    ],
  },
];

// Escolhe entre foto, metrica e lista de credibilidade sem duplicar o painel.
function StoryVisual({ chapter, index }) {
  if (chapter.highlights) {
    return (
      <div className="story-credibility" aria-label="Diferenciais da IMESUL">
        <span className="story-visual__index">
          {String(index + 1).padStart(2, "0")}
        </span>
        <p className="story-credibility__label">A confiança de quem constrói</p>
        <ul>
          {chapter.highlights.map((highlight) => (
            <li key={highlight}>
              <span aria-hidden="true">✓</span>
              {highlight}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="story-visual">
      <span className="story-visual__index">{String(index + 1).padStart(2, "0")}</span>
      <div className="story-visual__grid" />
      <Image
        src={chapter.image}
        alt={chapter.imageAlt}
        fill
        sizes="(max-width: 767px) 92vw, 58vw"
        className="story-photo"
      />
      <div className="story-photo__shade" />
      {chapter.metric && (
        <div className="story-metric">
          <strong>{chapter.metric}</strong>
          <span>{chapter.metricLabel}</span>
        </div>
      )}
    </div>
  );
}

function CompatibilityStoryVisual({ chapter, index }) {
  if (chapter.highlights) {
    return (
      <div className="border border-white/10 bg-[#091827]/82 p-5 sm:p-6">
        <span className="font-mono text-[10px] tracking-[0.28em] text-imesul-red">
          {String(index + 1).padStart(2, "0")}
        </span>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {chapter.highlights.map((highlight) => (
            <li key={highlight} className="flex items-center gap-3 text-sm text-imesul-steel-light/82">
              <span className="flex h-6 w-6 flex-none items-center justify-center border border-imesul-red/50 text-imesul-red" aria-hidden="true">
                ✓
              </span>
              {highlight}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="relative aspect-[1.18] overflow-hidden border border-white/10 bg-[#091827]">
      <Image
        src={chapter.image}
        alt={chapter.imageAlt}
        fill
        sizes="(max-width: 767px) 92vw, 620px"
        className="object-cover brightness-[0.82] contrast-[1.05]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#06111f]/72 via-transparent to-transparent" />
      {chapter.metric && (
        <div className="absolute bottom-5 right-5 flex flex-col items-end">
          <strong className="font-display text-6xl leading-none text-white">{chapter.metric}</strong>
          <span className="mt-2 font-mono text-[9px] tracking-[0.22em] text-imesul-red">
            {chapter.metricLabel}
          </span>
        </div>
      )}
    </div>
  );
}

function CompatibilityStory({ mode, videoSources, storyVideoRef, videoPanelRef }) {
  const showVideo = mode === "reduced" && Boolean(videoSources);

  return (
    <section id="nossa-historia" className="relative overflow-hidden bg-[#06111f] py-20 sm:py-24">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_28%,rgba(24,62,103,0.18),transparent_34%)]" />
      <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mb-12 flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.26em] text-imesul-steel-light/68">
          <span>IMESUL / TRAJETÓRIA</span>
          <span className="text-imesul-red">MATO GROSSO DO SUL</span>
        </div>

        <div className="grid gap-7">
          {chapters.map((chapter, index) => (
            <article
              key={chapter.title}
              className="grid gap-6 border-b border-white/10 pb-8 md:grid-cols-[0.9fr_1.1fr] md:items-center"
            >
              <div>
                <span className="font-mono text-[10px] tracking-[0.28em] text-imesul-red">
                  {chapter.number} / 06
                </span>
                <p className="mt-6 font-condensed text-xs font-bold uppercase tracking-[0.28em] text-imesul-red">
                  {chapter.eyebrow}
                </p>
                <h2 className="mt-4 font-display text-[clamp(3.4rem,12vw,6.2rem)] uppercase leading-[0.9] text-white md:text-[clamp(3.8rem,7vw,7rem)]">
                  {chapter.title}
                </h2>
                {chapter.text && (
                  <p className="mt-5 max-w-xl text-base leading-7 text-imesul-steel-light/76">
                    {chapter.text}
                  </p>
                )}
              </div>
              <CompatibilityStoryVisual chapter={chapter} index={index} />
            </article>
          ))}

          <article
            ref={videoPanelRef}
            className="grid gap-6 pt-4 md:grid-cols-[0.9fr_1.1fr] md:items-center"
          >
            <div>
              <span className="font-mono text-[10px] tracking-[0.28em] text-imesul-red">
                06 / 06
              </span>
              <p className="mt-6 font-condensed text-xs font-bold uppercase tracking-[0.28em] text-imesul-red">
                VEJA A ESTRUTURA DA IMESUL
              </p>
              <h2 className="mt-4 font-display text-[clamp(3.4rem,12vw,6.2rem)] uppercase leading-[0.9] text-white md:text-[clamp(3.8rem,7vw,7rem)]">
                Estrutura que movimenta projetos
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-imesul-steel-light/76">
                Conheça de perto a estrutura da IMESUL e veja de onde o aço sai para chegar até
                quem constrói.
              </p>
            </div>

            <div className="relative aspect-video overflow-hidden border border-white/10 bg-[#030a13]">
              {showVideo ? (
                <video
                  ref={storyVideoRef}
                  className="h-full w-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="none"
                  poster={institutionalVideo.poster}
                  aria-label="Estrutura da fábrica da IMESUL em Dourados"
                >
                  <source src={videoSources.mp4} type="video/mp4" />
                  <source src={videoSources.webm} type="video/webm" />
                </video>
              ) : (
                <Image
                  src={institutionalVideo.poster}
                  alt="Estrutura da fábrica da IMESUL em Dourados"
                  fill
                  sizes="(max-width: 767px) 92vw, 620px"
                  className="object-cover brightness-[0.82] contrast-[1.05]"
                />
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#030a13]/54 to-transparent" />
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

// Controla a narrativa horizontal no desktop e preserva cards verticais no mobile.
export default function CompanyStory() {
  const { mode, ready } = useCompatibility();
  const sectionRef = useRef(null);
  const trackRef = useRef(null);
  const progressRef = useRef(null);
  const videoPanelRef = useRef(null);
  const storyVideoRef = useRef(null);
  const [isStoryVideoNear, setIsStoryVideoNear] = useState(false);
  const isFullMode = ready && mode === "full";
  const isFallbackMode = ready && mode === "fallback";
  const videoProfile = useAdaptiveVideoProfile({ enabled: isStoryVideoNear });
  const videoSources = getInstitutionalVideoSources(videoProfile);

  // Habilita a selecao de midia somente quando o painel final se aproxima da viewport.
  useEffect(() => {
    if (!ready || isFallbackMode) return undefined;

    const panel = videoPanelRef.current;
    if (!panel || isStoryVideoNear) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsStoryVideoNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "320px" }
    );

    observer.observe(panel);
    return () => observer.disconnect();
  }, [isFallbackMode, isStoryVideoNear, ready]);

  // Recarrega o video ao trocar de perfil e remove fontes no modo de poster.
  useEffect(() => {
    if (!ready || isFallbackMode) return undefined;

    if (!storyVideoRef.current) return;
    if (!videoSources) {
      storyVideoRef.current.pause();
      storyVideoRef.current.load();
      return;
    }
    storyVideoRef.current.load();
    storyVideoRef.current.play().catch(() => {});
  }, [isFallbackMode, ready, videoSources]);

  // Converte progresso vertical em deslocamento horizontal e crescimento do video.
  // O gatilho e removido quando a secao deixa de existir.
  useEffect(() => {
    if (!isFullMode) return undefined;

    let trigger;
    let cancelled = false;
    let refreshFrame = 0;
    let refreshStoryTrigger;

    const setup = async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      const updatePosition = (nextProgress) => {
        const trackWidth = trackRef.current?.scrollWidth || window.innerWidth * 6;
        const maxOffset = Math.max(trackWidth - window.innerWidth, 0);
        const nextX = window.innerWidth >= 768 ? -nextProgress * maxOffset : 0;
        const videoProgress = Math.min(
          Math.max((nextProgress - 0.8) / 0.2, 0),
          1
        );

        if (trackRef.current) {
          trackRef.current.style.transform = `translate3d(${nextX}px, 0, 0)`;
        }
        if (progressRef.current) {
          progressRef.current.style.transform = `scaleX(${nextProgress})`;
        }
        if (videoPanelRef.current) {
          videoPanelRef.current.style.setProperty(
            "--story-video-progress",
            videoProgress
          );
        }
      };

      refreshStoryTrigger = () => {
        if (refreshFrame) return;
        refreshFrame = window.requestAnimationFrame(() => {
          refreshFrame = 0;
          ScrollTrigger.refresh();
        });
      };

      trigger = ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => updatePosition(self.progress),
        onRefresh: (self) => updatePosition(self.progress),
      });

      refreshStoryTrigger();
      window.addEventListener("load", refreshStoryTrigger, { once: true });
      window.addEventListener("resize", refreshStoryTrigger);
    };

    setup();

    return () => {
      cancelled = true;
      if (refreshFrame) window.cancelAnimationFrame(refreshFrame);
      if (refreshStoryTrigger) {
        window.removeEventListener("load", refreshStoryTrigger);
        window.removeEventListener("resize", refreshStoryTrigger);
      }
      trigger?.kill();
    };
  }, [isFullMode]);

  if (ready && mode !== "full") {
    return (
      <CompatibilityStory
        mode={mode}
        videoSources={videoSources}
        storyVideoRef={storyVideoRef}
        videoPanelRef={videoPanelRef}
      />
    );
  }

  return (
    <section ref={sectionRef} id="nossa-historia" className="company-story">
      <div className="company-story__sticky">
        <div className="company-story__topline">
          <span>IMESUL / TRAJETÓRIA</span>
          <span className="company-story__topline-rule" />
          <span>MATO GROSSO DO SUL</span>
        </div>

        <div
          ref={trackRef}
          className="company-story__track"
        >
          {chapters.map((chapter, index) => (
            <article className="story-panel" key={chapter.title}>
              <motion.div
                initial={{ opacity: 0, y: 26 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.78, ease: [0.16, 1, 0.3, 1] }}
                className="story-panel__content"
              >
                <span className="story-panel__number">{chapter.number} / 06</span>
                <p className="story-panel__eyebrow">{chapter.eyebrow}</p>
                <h2>{chapter.title}</h2>
                {chapter.text && (
                  <p className="story-panel__text">{chapter.text}</p>
                )}
              </motion.div>
              <StoryVisual chapter={chapter} index={index} />
            </article>
          ))}

          <article
            ref={videoPanelRef}
            className="story-panel story-panel--video"
          >
            <div className="story-video__frame">
              <video
                ref={storyVideoRef}
                className="story-video"
                autoPlay={Boolean(videoSources)}
                muted
                loop
                playsInline
                preload="none"
                poster={institutionalVideo.poster}
                aria-label="Estrutura da fábrica da IMESUL em Dourados"
              >
                {videoSources?.mp4 && videoSources?.webm && (
                  <>
                    {/* Usa a mesma politica do Hero para manter qualidade e cache consistentes. */}
                    <source src={videoSources.mp4} type="video/mp4" />
                    <source src={videoSources.webm} type="video/webm" />
                  </>
                )}
              </video>
              <div className="story-video__shade" />
            </div>
            <div className="story-video__content">
              <motion.div
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.82, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Oculto (nao removido) para preservar o espacamento vertical do bloco. */}
                <span className="story-panel__number" style={{ visibility: "hidden" }} aria-hidden="true">
                  06 / 06
                </span>
                <p className="story-panel__eyebrow">VEJA A ESTRUTURA DA IMESUL</p>
                <h2>Estrutura que movimenta projetos</h2>
                <p className="story-panel__text">
                  Conheça de perto a estrutura da IMESUL e veja de onde o aço sai
                  para chegar até quem constrói.
                </p>
              </motion.div>
            </div>
          </article>
        </div>

        <div className="company-story__progress" aria-hidden="true">
          <span ref={progressRef} />
        </div>
      </div>
    </section>
  );
}
