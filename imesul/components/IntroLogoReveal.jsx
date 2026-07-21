"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

// Simbolo oficial da marca; unico elemento visual da intro (sem nome, sem slogan, sem video).
const SYMBOL_SRC = "/logo/imesul-symbol-transparent.png";
const SYMBOL_WIDTH = 560;
const SYMBOL_HEIGHT = 446;
const SESSION_KEY = "imesulIntroLogoSeen";

const TIMING = {
  activateAt: 60,
  closeAt: 2000,
  exitDuration: 520,
  hardCeiling: 2900,
};

const REDUCED_TIMING = {
  activateAt: 30,
  closeAt: 420,
  exitDuration: 260,
};

// Intro institucional: revela o simbolo oficial com fade, wipe e leve profundidade, uma vez por sessao.
// Sem canvas e sem particulas — apenas CSS/Tailwind. Cai fora de cena se a imagem falhar ou travar.
export default function IntroLogoReveal() {
  const [isVisible, setIsVisible] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let showTimer = 0;
    let activateTimer = 0;
    let closeTimer = 0;
    let removeTimer = 0;
    let ceilingTimer = 0;

    if (typeof window === "undefined") return undefined;

    try {
      if (window.sessionStorage.getItem(SESSION_KEY) === "1") return undefined;
    } catch {
      // Sem sessionStorage, a intro roda apenas nesta montagem e continua descartavel.
    }

    const markAsSeen = () => {
      try {
        window.sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        // A intro e opcional; se o navegador bloquear storage, ela roda de novo na proxima visita.
      }
    };

    const closeIntro = (exitDuration) => {
      if (cancelled) return;
      markAsSeen();
      setIsClosing(true);
      removeTimer = window.setTimeout(() => {
        if (!cancelled) setIsVisible(false);
      }, exitDuration);
    };

    let prefersReducedMotion = false;
    try {
      prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      prefersReducedMotion = false;
    }

    // Garante que a intro nunca segure a tela por mais de ~2.9s, mesmo se algo travar.
    ceilingTimer = window.setTimeout(() => {
      if (cancelled) return;
      markAsSeen();
      setIsVisible(false);
    }, TIMING.hardCeiling);

    // Adia o primeiro setState para fora do corpo sincrono do efeito.
    showTimer = window.setTimeout(() => {
      if (cancelled) return;
      setReducedMotion(prefersReducedMotion);
      setIsVisible(true);

      const timing = prefersReducedMotion ? REDUCED_TIMING : TIMING;
      activateTimer = window.setTimeout(() => {
        if (!cancelled) setIsActive(true);
      }, timing.activateAt);
      closeTimer = window.setTimeout(() => closeIntro(timing.exitDuration), timing.closeAt);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(showTimer);
      window.clearTimeout(activateTimer);
      window.clearTimeout(closeTimer);
      window.clearTimeout(removeTimer);
      window.clearTimeout(ceilingTimer);
    };
  }, []);

  if (!isVisible) return null;

  const handleImageError = () => {
    try {
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Falha de imagem nao deve impedir a abertura da pagina.
    }
    setIsVisible(false);
  };

  const wrapperTransitionClass = reducedMotion
    ? "transition-opacity duration-300"
    : "transition-[opacity,transform] duration-[560ms] ease-[cubic-bezier(0.16,1,0.3,1)]";
  const wrapperStateClass = isClosing
    ? `pointer-events-none opacity-0 ${reducedMotion ? "" : "scale-[1.035]"}`
    : "scale-100 opacity-100";

  const symbolTransitionClass = reducedMotion
    ? "transition-opacity duration-300 ease-out"
    : "transition-[clip-path,transform,opacity] duration-[680ms] ease-[cubic-bezier(0.16,1,0.3,1)]";
  const symbolStateClass = isActive
    ? reducedMotion
      ? "opacity-100"
      : "scale-100 opacity-100 [clip-path:inset(0_0_0_0)]"
    : reducedMotion
      ? "opacity-0"
      : "scale-[0.96] opacity-0 [clip-path:inset(0_100%_0_0)]";

  const lineClass = reducedMotion
    ? `origin-center bg-gradient-to-r from-transparent via-imesul-red to-transparent transition-opacity duration-300 scale-x-100 ${
        isActive ? "opacity-100" : "opacity-0"
      }`
    : `origin-center bg-gradient-to-r from-transparent via-imesul-red to-transparent opacity-100 transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isActive ? "scale-x-100" : "scale-x-0"
      }`;

  return (
    <div
      className={`fixed inset-0 z-[9998] flex items-center justify-center overflow-hidden bg-[#050b14] ${wrapperTransitionClass} ${wrapperStateClass}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(47,104,171,0.13),transparent_34%),linear-gradient(180deg,#040a12_0%,#0A1628_100%)]" />

      {/* Grade tecnica discreta no fundo, mesma linguagem visual do restante do site. */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-1000 ${
          isActive ? "opacity-[0.05]" : "opacity-0"
        } [background-image:linear-gradient(90deg,rgba(226,238,249,0.7)_1px,transparent_1px),linear-gradient(rgba(226,238,249,0.7)_1px,transparent_1px)] [background-size:56px_56px]`}
      />

      {/* Scan line unica, atravessa o estagio uma vez durante a formacao do simbolo. */}
      {!reducedMotion && (
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(226,238,249,0.10),transparent)] transition-opacity duration-500 ${
            isActive ? "opacity-100 animate-scan [animation-duration:1100ms] [animation-iteration-count:1]" : "opacity-0"
          }`}
        />
      )}

      <div className="relative z-10 flex flex-col items-center">
        <div className="relative flex items-center justify-center">
          {/* Halo suave atras da marca: brilho quente por fora, reflexo frio no centro. */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute left-1/2 top-1/2 h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-700 sm:h-[380px] sm:w-[380px] lg:h-[520px] lg:w-[520px] ${
              isActive ? "opacity-100" : "opacity-0"
            } bg-[radial-gradient(circle_at_50%_50%,rgba(212,43,43,0.18),transparent_58%),radial-gradient(circle_at_50%_46%,rgba(226,238,249,0.08),transparent_36%)]`}
          />

          {/* Simbolo oficial: reveal por clip-path + leve escala, sem esticar ou recortar a imagem. */}
          <div className={`relative ${symbolTransitionClass} ${symbolStateClass}`}>
            <Image
              src={SYMBOL_SRC}
              alt=""
              width={SYMBOL_WIDTH}
              height={SYMBOL_HEIGHT}
              priority
              draggable="false"
              onError={handleImageError}
              className="h-auto w-[176px] object-contain drop-shadow-[0_0_22px_rgba(212,43,43,0.28)] sm:w-[260px] lg:w-[360px]"
            />
          </div>
        </div>

        {/* Linha de energia: nasce do centro para as laterais, acende junto do simbolo. */}
        <div className="relative mt-9 h-[3px] w-52 sm:mt-10 sm:w-60 lg:w-64">
          <div className="absolute inset-0 overflow-hidden rounded-full bg-white/[0.08]">
            <span className={`block h-full w-full ${lineClass}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
