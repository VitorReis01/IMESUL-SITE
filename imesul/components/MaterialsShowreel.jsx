"use client";

// Abertura cinematografica e imersiva do showroom de materiais.
// No desktop (>=1024px), a secao fica pinada (GSAP ScrollTrigger, pin:true) em tela cheia enquanto
// o usuario rola: ha um hold inicial com o video ainda pequeno e o titulo parado, depois o video
// real da fabrica expande quase full-width enquanto o fundo perde forca e o titulo se abre para os
// lados, depois a legenda aparece por cima do video ja grande, e por fim tudo segura parado antes
// da secao liberar o scroll normal para o ProductScrollExperience. O pin substitui o sticky CSS
// usado antes (nao usar os dois juntos) — cleanup via gsap.context().revert(), sem preventDefault,
// sem bloquear wheel/touch, sem window.scrollTo.
// Mobile (<1024px) NAO recebe pin/scrub/scale: fica estatica, com scroll normal da pagina, usando
// so as classes base (sem overrides de GSAP). Reduced-motion cai para um card grande estatico.
import { useEffect, useMemo, useRef, useState } from "react";
import { m as motion, useReducedMotion } from "framer-motion";
import useAdaptiveVideoProfile from "../hooks/useAdaptiveVideoProfile";
import useCompatibility from "../hooks/useCompatibility";
import { institutionalVideo, VIDEO_DISABLED_PROFILE } from "../data/videoAssets";

// Video proprio do showreel (nao compartilhado com o Hero); um unico par de arquivos serve todos
// os perfis de viewport, mas o profile "poster" (reduced-motion/save-data) continua desativando-o.
// Otimizado de 16,06 MB/1080p/~19,6 Mbps para ~2,1 MB (webm) / ~1,9 MB (mp4), sem audio (o video e
// sempre muted) — webm primeiro, mp4 como fallback para navegadores sem suporte a VP9.
const SHOWREEL_VIDEO_WEBM = "/videos/estoque-showreel.webm";
const SHOWREEL_VIDEO_MP4 = "/videos/estoque-showreel.mp4";

// Fundo amplo decorativo atras do video/card principal (nao e o poster do video, que continua
// vindo de institutionalVideo.poster para o fallback do <video>).
const SHOWREEL_BACKGROUND_SRC = "/images/company/estrutura-estoque.webp";

function StaticShowreel({ mode, videoSources, videoRef, canUseVideo }) {
  const showVideo = mode === "reduced" && canUseVideo && Boolean(videoSources);

  return (
    <section id="showroom-abertura" className="relative overflow-hidden bg-[#050b14] py-20 sm:py-24">
      <div aria-hidden="true" className="absolute inset-0 opacity-40">
        {/* eslint-disable-next-line @next/next/no-img-element -- fallback visual estatico, sem dependencia de animacao. */}
        <img
          src={SHOWREEL_BACKGROUND_SRC}
          alt=""
          className="h-full w-full object-cover"
          draggable="false"
        />
      </div>
      <div className="absolute inset-0 bg-[#050b14]/76" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(47,104,171,0.12),transparent_42%)]" />
      <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(90deg,rgba(255,255,255,0.09)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:86px_86px]" />

      <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-5 text-center sm:px-8">
        <h2 className="max-w-4xl font-display leading-[0.94] text-white [font-size:clamp(2rem,9vw,4rem)] sm:[font-size:clamp(2.4rem,7vw,5rem)]">
          Materiais que sustentam grandes projetos
        </h2>

        <div className="relative mt-8 aspect-video w-full max-w-3xl overflow-hidden rounded-[18px] border border-white/10 bg-[#07111f] shadow-[0_28px_80px_rgba(0,0,0,0.42)]">
          {showVideo ? (
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="none"
              poster={institutionalVideo.poster}
              aria-label="Movimentação de materiais e estrutura da fábrica da IMESUL"
            >
              {videoSources?.mp4 && <source src={videoSources.mp4} type="video/mp4" />}
              {videoSources?.webm && <source src={videoSources.webm} type="video/webm" />}
            </video>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- usa o poster/foto existente como fallback seguro.
            <img
              src={institutionalVideo.poster}
              alt="Movimentação de materiais e estrutura da fábrica da IMESUL"
              className="h-full w-full object-cover"
              draggable="false"
            />
          )}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,8,18,0.16)_0%,transparent_36%,rgba(2,8,18,0.56)_100%)]" />
        </div>

        <p className="mt-6 max-w-xl text-sm leading-6 text-imesul-steel-light/80 sm:text-base sm:leading-relaxed">
          Da estrutura ao acabamento, a Imesul conecta estoque, atendimento e logística para obras,
          serralherias, indústrias e produtores rurais.
        </p>
      </div>
    </section>
  );
}

export default function MaterialsShowreel() {
  const { capabilities, mode, ready } = useCompatibility();
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
  const [animationFailed, setAnimationFailed] = useState(false);
  // Controla a revelacao do video real: comeca invisivel (fundo neutro da secao) e so aparece
  // quando o primeiro frame estiver decodificado, sem nunca mostrar o poster antigo no meio tempo.
  const [videoReady, setVideoReady] = useState(false);
  const isFullMode = ready && mode === "full" && !animationFailed;
  const isFallbackMode = ready && mode === "fallback";
  const videoProfile = useAdaptiveVideoProfile({ enabled: isNear && !isFallbackMode });
  const videoSources = useMemo(
    () =>
      videoProfile === VIDEO_DISABLED_PROFILE
        ? null
        : { webm: SHOWREEL_VIDEO_WEBM, mp4: SHOWREEL_VIDEO_MP4 },
    [videoProfile]
  );

  // Adia a escolha da fonte de video ate a secao se aproximar da viewport.
  useEffect(() => {
    if (!ready || isFallbackMode) return undefined;

    const section = sectionRef.current;
    if (!section || isNear) return undefined;

    if (!capabilities.supportsIntersectionObserver) return undefined;

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
  }, [capabilities.supportsIntersectionObserver, isFallbackMode, isNear, ready]);

  // Recarrega o video ao trocar de perfil e remove fontes no modo de poster.
  // videoReady volta a false a cada troca de fonte: o video fica oculto ate o novo frame chegar.
  useEffect(() => {
    if (!ready || isFallbackMode) return undefined;

    if (!videoRef.current) return;
    setVideoReady(false);
    if (!videoSources) {
      videoRef.current.pause();
      videoRef.current.load();
      return;
    }
    videoRef.current.load();
    videoRef.current.play().catch(() => {});
  }, [isFallbackMode, ready, videoSources]);

  // Pina a secao em tela cheia e expande o video conforme o usuario rola dentro dela.
  // Roda so no desktop com movimento permitido; mobile e reduced-motion ficam no layout estatico.
  useEffect(() => {
    if (!isFullMode) return undefined;

    let media;
    let cancelled = false;
    let refreshFrame = 0;
    let refreshShowreel;

    const setup = async () => {
      try {
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

        // Mobile (<1024px) nao recebe nenhum matchMedia aqui: sem pin, sem scrub, sem scale.
        // A secao fica com as classes base (estatica), e o scroll da pagina passa por ela normalmente.
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
      } catch {
        if (!cancelled) setAnimationFailed(true);
      }
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
  }, [isFullMode]);

  if (ready && (mode !== "full" || animationFailed)) {
    return (
      <StaticShowreel
        mode={animationFailed ? "reduced" : mode}
        videoSources={videoSources}
        videoRef={videoRef}
        canUseVideo={capabilities.supportsVideoMP4 || capabilities.supportsVideoWebM}
      />
    );
  }

  return (
    <section
      id="showroom-abertura"
      ref={sectionRef}
      className={`relative h-auto overflow-hidden bg-[#050b14] ${
        immersive ? "min-h-[100svh] py-6 sm:py-8 lg:h-screen lg:py-0 [@media(max-height:480px)]:py-3" : "py-24 sm:py-28"
      }`}
    >
      <div
        className={`relative flex h-full w-full flex-col items-center px-5 sm:px-8 lg:px-12 ${
          immersive ? "min-h-[100svh] justify-center overflow-hidden lg:h-screen" : ""
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
          className={`relative z-10 flex w-full max-w-[1400px] flex-1 flex-col items-center justify-center ${
            immersive ? "py-0 lg:h-full lg:py-0" : "py-16"
          }`}
        >
          <h2
            className={`mt-4 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 text-center font-display leading-[0.94] text-white [font-size:clamp(1.85rem,9.5vw,3.15rem)] sm:[font-size:clamp(2.1rem,7vw,3.7rem)] lg:[font-size:clamp(2.2rem,5vw,4.2rem)] [@media(max-height:480px)]:mt-2 [@media(max-height:480px)]:[font-size:clamp(1.25rem,5vw,2rem)] ${
              immersive ? "lg:absolute lg:left-0 lg:right-0 lg:top-[19%] lg:mt-0" : ""
            }`}
          >
            <span ref={titleLeftRef}>Materiais que sustentam</span>
            <span ref={titleRightRef}>grandes projetos</span>
          </h2>

          <div
            ref={videoBoxRef}
            className={`relative z-20 mt-6 aspect-video w-full max-w-3xl overflow-hidden rounded-[18px] shadow-[0_34px_90px_rgba(0,0,0,0.5)] sm:mt-8 lg:rounded-[20px] lg:shadow-[0_50px_150px_rgba(0,0,0,0.55)] [@media(max-height:480px)]:mt-3 ${
              immersive
                ? "mx-auto lg:absolute lg:left-1/2 lg:top-1/2 lg:mx-0 lg:mt-0 lg:w-auto lg:[max-width:calc(100vw-96px)]"
                : "mx-auto lg:mt-14"
            }`}
          >
            <video
              ref={videoRef}
              className={`h-full w-full object-cover transition-opacity duration-200 ${videoReady ? "opacity-100" : "opacity-0"}`}
              autoPlay={Boolean(videoSources)}
              muted
              loop
              playsInline
              preload="auto"
              onLoadedData={() => setVideoReady(true)}
              aria-label="Movimentação de materiais e estrutura da fábrica da IMESUL"
            >
              {videoSources?.webm && <source src={videoSources.webm} type="video/webm" />}
              {videoSources?.mp4 && <source src={videoSources.mp4} type="video/mp4" />}
            </video>
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,8,18,0.18)_0%,transparent_30%,transparent_65%,rgba(2,8,18,0.6)_100%)]" />
          </div>

          <p
            ref={subtitleRef}
            className={`mt-5 max-w-xl text-center text-sm leading-6 text-imesul-steel-light/80 sm:mt-7 sm:text-base sm:leading-relaxed lg:mt-10 lg:text-lg [@media(max-height:480px)]:mt-3 [@media(max-height:480px)]:text-xs [@media(max-height:480px)]:leading-5 ${
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
          className={`relative z-10 mt-5 flex flex-col items-center gap-2 pb-3 text-center sm:mt-7 lg:mt-10 lg:pb-16 [@media(max-height:480px)]:hidden ${
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
