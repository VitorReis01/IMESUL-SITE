"use client";

import { useEffect, useRef, useState } from "react";

// Video aprovado da intro; tem ~10s no arquivo, mas a exibicao e limitada por TIMING.maxPlayback.
const VIDEO_SRC = "/videos/imesul-intro.mp4";
const SESSION_KEY = "imesulIntroVideoSeen";

const TIMING = {
  readinessTimeout: 3000, // se o video nao comecar a tocar ate aqui, pula a intro
  maxPlayback: 5500, // tempo maximo de reproducao visivel, mesmo que o arquivo dure mais
  fadeOutDuration: 500, // duracao do fade de saida
  hardCeiling: 9000, // rede de seguranca absoluta a partir do mount; nao deve disparar em uso normal
};

// Intro institucional em video: toca uma vez por sessao, corta a exibicao em ~5.5s mesmo que o
// arquivo dure mais, e libera o Hero com um fade suave. Cai para o site normal se o video falhar,
// demorar demais para comecar ou se o usuario preferir menos movimento.
export default function IntroVideo() {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const videoRef = useRef(null);

  // Decide se a intro deve rodar (sessao, reduced-motion) e agenda a rede de seguranca.
  useEffect(() => {
    let cancelled = false;
    let showTimer = 0;
    let hardCeilingTimer = 0;

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

    let prefersReducedMotion = false;
    try {
      prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      prefersReducedMotion = false;
    }

    // Reduced motion: pula a intro em video por completo, sem carregar o arquivo.
    if (prefersReducedMotion) {
      markAsSeen();
      return undefined;
    }

    // Garante que a intro nunca fique presa na tela, mesmo se o video travar ou os eventos falharem.
    hardCeilingTimer = window.setTimeout(() => {
      if (cancelled) return;
      markAsSeen();
      setIsVisible(false);
    }, TIMING.hardCeiling);

    // Adia o primeiro setState para fora do corpo sincrono do efeito.
    showTimer = window.setTimeout(() => {
      if (!cancelled) setIsVisible(true);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(showTimer);
      window.clearTimeout(hardCeilingTimer);
    };
  }, []);

  // So mexe no elemento de video depois que ele existe no DOM (isVisible ja true e renderizado).
  useEffect(() => {
    if (!isVisible) return undefined;

    const video = videoRef.current;
    if (!video) return undefined;

    let cancelled = false;
    let readinessTimer = 0;
    let playbackTimer = 0;
    let removeTimer = 0;

    const markAsSeen = () => {
      try {
        window.sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        // A intro e opcional; se o navegador bloquear storage, ela roda de novo na proxima visita.
      }
    };

    // Pula a intro imediatamente: video falhou, nao carregou a tempo ou autoplay foi bloqueado.
    const skipIntro = () => {
      if (cancelled) return;
      cancelled = true;
      markAsSeen();
      setIsVisible(false);
    };

    // Encerra com fade suave: fim natural do video ou limite maximo de exibicao atingido.
    const closeIntro = () => {
      if (cancelled) return;
      markAsSeen();
      setIsClosing(true);
      removeTimer = window.setTimeout(() => {
        if (!cancelled) setIsVisible(false);
      }, TIMING.fadeOutDuration);
    };

    const handlePlaying = () => {
      if (readinessTimer) {
        window.clearTimeout(readinessTimer);
        readinessTimer = 0;
      }
      if (!playbackTimer) {
        playbackTimer = window.setTimeout(closeIntro, TIMING.maxPlayback);
      }
    };

    const handleEnded = () => closeIntro();
    const handleError = () => skipIntro();

    video.addEventListener("playing", handlePlaying);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("error", handleError);

    readinessTimer = window.setTimeout(skipIntro, TIMING.readinessTimeout);

    const playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
      playAttempt.catch(() => {
        // Autoplay bloqueado pelo navegador conta como falha; libera o site normalmente.
        skipIntro();
      });
    }

    return () => {
      cancelled = true;
      window.clearTimeout(readinessTimer);
      window.clearTimeout(playbackTimer);
      window.clearTimeout(removeTimer);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("error", handleError);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9998] flex items-center justify-center overflow-hidden bg-[#050b14] transition-opacity duration-[500ms] ease-out ${
        isClosing ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      aria-hidden="true"
    >
      <video
        ref={videoRef}
        src={VIDEO_SRC}
        className="h-full w-full object-contain"
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        aria-hidden="true"
      />
    </div>
  );
}
