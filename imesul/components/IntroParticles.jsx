"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const LOGO_SRC = "/images/logo-imesul-symbol-particles.png";
const INTRO_SESSION_KEY = "imesulIntroMinimalSeen";
const INTRO_TIMING = {
  activate: 40,
  close: 1850,
  remove: 2320,
  reducedClose: 520,
  reducedRemove: 780,
};

// Intro institucional minimalista: mostra a marca uma vez por sessao e libera o site se algo falhar.
export default function IntroParticles() {
  const [isVisible, setIsVisible] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let showTimer = 0;
    let activateTimer = 0;
    let closeTimer = 0;
    let removeTimer = 0;
    let cancelled = false;

    const markAsSeen = () => {
      try {
        window.sessionStorage.setItem(INTRO_SESSION_KEY, "1");
      } catch {
        // A intro e opcional; se o navegador bloquear storage, o site segue normalmente.
      }
    };

    const closeIntro = (removeDelay) => {
      if (cancelled) return;
      markAsSeen();
      setIsClosing(true);
      removeTimer = window.setTimeout(() => {
        if (!cancelled) setIsVisible(false);
      }, removeDelay);
    };

    try {
      if (typeof window === "undefined") return undefined;
      if (window.sessionStorage.getItem(INTRO_SESSION_KEY) === "1") return undefined;
    } catch {
      // Sem sessionStorage, a intro roda apenas nesta montagem e continua descartavel.
    }

    let prefersReducedMotion = false;
    try {
      prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      prefersReducedMotion = false;
    }

    showTimer = window.setTimeout(() => {
      if (cancelled) return;
      setReducedMotion(prefersReducedMotion);
      setIsVisible(true);
      activateTimer = window.setTimeout(() => {
        if (!cancelled) setIsActive(true);
      }, INTRO_TIMING.activate);
    }, 0);

    closeTimer = window.setTimeout(
      () =>
        closeIntro(
          prefersReducedMotion
            ? INTRO_TIMING.reducedRemove - INTRO_TIMING.reducedClose
            : INTRO_TIMING.remove - INTRO_TIMING.close
        ),
      prefersReducedMotion ? INTRO_TIMING.reducedClose : INTRO_TIMING.close
    );

    return () => {
      cancelled = true;
      window.clearTimeout(showTimer);
      window.clearTimeout(activateTimer);
      window.clearTimeout(closeTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  const handleImageError = () => {
    try {
      window.sessionStorage.setItem(INTRO_SESSION_KEY, "1");
    } catch {
      // Falha de imagem nao deve impedir a abertura da pagina.
    }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9998] flex items-center justify-center overflow-hidden bg-[#050b14] transition-opacity duration-500 ${
        isClosing ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(47,104,171,0.13),transparent_34%),linear-gradient(180deg,#040a12_0%,#0A1628_100%)]" />

      <div
        className={`relative z-10 flex flex-col items-center transition-all ${
          reducedMotion
            ? "duration-300"
            : "duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
        } ${
          isActive && !isClosing
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-2 scale-[0.92] opacity-0"
        }`}
      >
        <Image
          src={LOGO_SRC}
          alt=""
          width={520}
          height={520}
          priority
          className="h-auto w-[142px] object-contain sm:w-[188px] lg:w-[214px]"
          draggable="false"
          onError={handleImageError}
        />

        <div className="mt-8 h-px w-44 overflow-hidden bg-white/10 sm:w-56">
          <span
            className={`block h-full origin-left bg-imesul-red transition-transform ${
              reducedMotion
                ? "duration-300"
                : "duration-[1350ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
            } ${isActive ? "scale-x-100" : "scale-x-0"}`}
          />
        </div>

        <p
          className={`mt-5 font-mono text-[10px] uppercase tracking-[0.44em] text-imesul-steel-light/78 transition-all ${
            reducedMotion
              ? "duration-300"
              : "duration-700 delay-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
          } ${isActive ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}
        >
          IMESUL
        </p>
      </div>
    </div>
  );
}
