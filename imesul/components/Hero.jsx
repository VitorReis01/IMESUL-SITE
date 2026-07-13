"use client";

import { useEffect, useRef } from "react";
import { m as motion } from "framer-motion";
import useAdaptiveVideoProfile from "../hooks/useAdaptiveVideoProfile";
import { getInstitutionalVideoSources, institutionalVideo } from "../data/videoAssets";

// Apresenta a mensagem principal sobre o video da fabrica e controla seu fallback.
export default function Hero() {
  const heroRef = useRef(null);
  const visualRef = useRef(null);
  const videoRef = useRef(null);
  const videoProfile = useAdaptiveVideoProfile();
  const videoSources = getInstitutionalVideoSources(videoProfile);

  // Aplica parallax enquanto o Hero sai da viewport e limpa o ScrollTrigger no final.
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
        gsap.to(visualRef.current, {
          yPercent: 8,
          scale: 1.04,
          ease: "none",
          scrollTrigger: {
            trigger: heroRef.current,
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });
      }, heroRef);
    };

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setup();
    }

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, []);

  // Recarrega o elemento ao trocar de perfil e remove a midia quando fica apenas o poster.
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

  return (
    <section id="inicio" ref={heroRef} className="relative min-h-screen overflow-hidden bg-[#050b14]">
      <div ref={visualRef} className="absolute inset-x-0 top-[-6%] h-[112%] w-full">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          autoPlay={Boolean(videoSources)}
          muted
          loop
          playsInline
          preload="none"
          poster={institutionalVideo.poster}
          aria-hidden="true"
        >
          {videoSources?.mp4 && videoSources?.webm && (
            <>
              {/* Prioriza MP4 porque a comparacao visual preservou melhor os detalhes da fabrica. */}
              <source src={videoSources.mp4} type="video/mp4" />
              <source src={videoSources.webm} type="video/webm" />
            </>
          )}
        </video>
      </div>

      <div className="absolute inset-0 bg-[#020812]/35" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,8,18,0.98)_0%,rgba(2,8,18,0.94)_28%,rgba(2,8,18,0.76)_48%,rgba(2,8,18,0.48)_70%,rgba(2,8,18,0.3)_100%)]" />
      <div className="absolute inset-0 bg-[#020812]/26 lg:bg-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_74%_45%,rgba(212,43,43,0.14),transparent_34%),radial-gradient(circle_at_86%_14%,rgba(66,132,202,0.14),transparent_30%),radial-gradient(circle_at_18%_54%,rgba(2,8,18,0.62),transparent_34%)]" />
      <div className="absolute bottom-0 left-0 right-0 h-44 bg-gradient-to-t from-imesul-blue via-imesul-blue/72 to-transparent" />

      <div className="relative z-10 mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 items-center gap-10 px-6 pb-20 pt-28 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:px-16 lg:pt-24">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.12, delayChildren: 0.25 } } }}
          className="max-w-[820px]"
        >
          <motion.div
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
            className="mb-7 flex items-center gap-4"
          >
            <span className="font-mono text-[10px] tracking-[0.42em] text-imesul-red uppercase">
              SOLUÇÕES EM AÇO
            </span>
            <span className="h-px w-16 bg-imesul-red" />
          </motion.div>

          <motion.h1
            initial={false}
            variants={{
              hidden: { opacity: 0, y: 54 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] } },
            }}
            className="font-display leading-[0.92] text-white [font-size:clamp(2.35rem,7.4vw,4.6rem)] sm:[font-size:clamp(2rem,6.4vw,7.8rem)]"
          >
            AÇO QUE
            <br />
            <span className="text-imesul-red text-glow-red">TRANSFORMA</span>
            <br />
            PROJETOS EM
            <br />
            REALIDADE.
          </motion.h1>

          <motion.p
            variants={{ hidden: { opacity: 0, y: 28 }, visible: { opacity: 1, y: 0, transition: { duration: 0.8 } } }}
            className="mt-8 max-w-[560px] text-lg font-light leading-relaxed text-imesul-steel-light/82 lg:text-xl"
          >
            Soluções completas em aço para construção, indústria e serralheria.
            <br />
            Campo Grande e Dourados — MS.
          </motion.p>

        </motion.div>

        <div className="hidden lg:block" aria-hidden="true" />
      </div>
    </section>
  );
}
