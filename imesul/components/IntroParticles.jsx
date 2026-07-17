"use client";

import { useEffect, useRef, useState } from "react";
import NextImage from "next/image";

const LOGO_SRC = "/images/logo-imesul-symbol.png";
const INTRO_SESSION_KEY = "imesulIntroParticlesSeen";
const INTRO_DURATION = 3200;

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function easeInOutCubic(value) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[randomIndex]] = [items[randomIndex], items[index]];
  }
  return items;
}

// Intro institucional em canvas: amostra o simbolo oficial e transforma pixels visiveis em particulas.
export default function IntroParticles() {
  const canvasRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let showTimer = 0;

    try {
      if (typeof window === "undefined") return undefined;
      if (window.sessionStorage.getItem(INTRO_SESSION_KEY) === "1") return undefined;
    } catch {
      // Sem acesso a sessionStorage, a animacao roda apenas nesta montagem.
    }

    let prefersReducedMotion = false;
    try {
      prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      prefersReducedMotion = false;
    }

    showTimer = window.setTimeout(() => {
      if (!cancelled) {
        setReducedMotion(prefersReducedMotion);
        setIsVisible(true);
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(showTimer);
    };
  }, []);

  useEffect(() => {
    if (!isVisible) return undefined;

    let animationFrame = 0;
    let closeTimer = 0;
    let removeTimer = 0;
    let cancelled = false;

    const hideIntro = (markAsSeen = true) => {
      if (cancelled) return;
      if (markAsSeen) {
        try {
          window.sessionStorage.setItem(INTRO_SESSION_KEY, "1");
        } catch {
          // A intro continua descartavel mesmo quando o navegador bloqueia sessionStorage.
        }
      }

      setIsClosing(true);
      removeTimer = window.setTimeout(() => {
        if (!cancelled) setIsVisible(false);
      }, 460);
    };

    if (reducedMotion) {
      closeTimer = window.setTimeout(() => hideIntro(), 1150);

      return () => {
        cancelled = true;
        window.clearTimeout(closeTimer);
        window.clearTimeout(removeTimer);
      };
    }

    let image;

    const cleanup = () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(closeTimer);
      window.clearTimeout(removeTimer);
      if (image) {
        image.onload = null;
        image.onerror = null;
      }
    };

    let canvas;
    let context;
    try {
      canvas = canvasRef.current;
      context = canvas?.getContext("2d", { alpha: true });
    } catch {
      hideIntro(false);
      return () => {
        cancelled = true;
        cleanup();
      };
    }

    if (!canvas || !context) {
      closeTimer = window.setTimeout(() => hideIntro(false), 120);
      return () => {
        cancelled = true;
        cleanup();
      };
    }

    try {
      image = new window.Image();
      image.decoding = "async";
      image.src = LOGO_SRC;
    } catch {
      hideIntro(false);
      return () => {
        cancelled = true;
        cleanup();
      };
    }

    const startAnimation = () => {
      if (cancelled) return;

      try {
        const viewportWidth = Math.max(window.innerWidth || 0, 1);
        const viewportHeight = Math.max(window.innerHeight || 0, 1);
        const isMobile = viewportWidth < 768;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewportWidth * dpr);
        canvas.height = Math.floor(viewportHeight * dpr);
        canvas.style.width = `${viewportWidth}px`;
        canvas.style.height = `${viewportHeight}px`;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);

        const naturalRatio =
          image.naturalWidth > 0 && image.naturalHeight > 0
            ? image.naturalHeight / image.naturalWidth
            : 1;
        const logoWidth = Math.min(viewportWidth * (isMobile ? 0.5 : 0.34), isMobile ? 230 : 430);
        const logoHeight = logoWidth * naturalRatio;
        const targetLeft = viewportWidth / 2 - logoWidth / 2;
        const targetTop = viewportHeight / 2 - logoHeight / 2;

        const sampleCanvas = document.createElement("canvas");
        const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });
        if (!sampleContext) {
          hideIntro(false);
          return;
        }

        const sampleStep = isMobile ? 9 : 6;
        const maxParticles = isMobile ? 430 : 1050;
        sampleCanvas.width = Math.max(1, Math.floor(logoWidth));
        sampleCanvas.height = Math.max(1, Math.floor(logoHeight));
        sampleContext.drawImage(image, 0, 0, sampleCanvas.width, sampleCanvas.height);

        const pixels = sampleContext.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height).data;
        const candidates = [];

        for (let y = 0; y < sampleCanvas.height; y += sampleStep) {
          for (let x = 0; x < sampleCanvas.width; x += sampleStep) {
            const pixelIndex = (y * sampleCanvas.width + x) * 4;
            const alpha = pixels[pixelIndex + 3];
            if (alpha < 60) continue;

            candidates.push({
              targetX: targetLeft + x,
              targetY: targetTop + y,
            });
          }
        }

        if (candidates.length === 0) {
          hideIntro(false);
          return;
        }

        const particles = shuffle(candidates)
          .slice(0, maxParticles)
          .map((particle, index) => {
            const angle = Math.random() * Math.PI * 2;
            const scatterRadius = Math.max(viewportWidth, viewportHeight) * (0.36 + Math.random() * 0.42);
            const disperseRadius = Math.max(viewportWidth, viewportHeight) * (0.28 + Math.random() * 0.44);
            const isHighlight = index % 13 === 0 || Math.random() > 0.94;

            return {
              ...particle,
              startX: viewportWidth / 2 + Math.cos(angle) * scatterRadius,
              startY: viewportHeight / 2 + Math.sin(angle) * scatterRadius,
              endX: particle.targetX + Math.cos(angle + 0.8) * disperseRadius,
              endY: particle.targetY + Math.sin(angle + 0.8) * disperseRadius,
              size: isMobile ? 1.2 + Math.random() * 1.3 : 1.25 + Math.random() * 1.8,
              color: isHighlight
                ? `rgba(212, 43, 43, ${0.74 + Math.random() * 0.22})`
                : `rgba(230, 238, 246, ${0.68 + Math.random() * 0.28})`,
              delay: Math.random() * 0.08,
            };
          });

        const startedAt = performance.now();

        const draw = (now) => {
          if (cancelled) return;

          try {
            const progress = clamp((now - startedAt) / INTRO_DURATION, 0, 1);

            context.clearRect(0, 0, viewportWidth, viewportHeight);
            context.globalCompositeOperation = "lighter";

            particles.forEach((particle) => {
              const localProgress = clamp((progress - particle.delay) / (1 - particle.delay), 0, 1);
              let x = particle.targetX;
              let y = particle.targetY;
              let alpha = 1;

              if (localProgress < 0.48) {
                const phase = easeInOutCubic(localProgress / 0.48);
                x = particle.startX + (particle.targetX - particle.startX) * phase;
                y = particle.startY + (particle.targetY - particle.startY) * phase;
                alpha = 0.25 + phase * 0.75;
              } else if (localProgress < 0.64) {
                const hold = (localProgress - 0.48) / 0.16;
                const pulse = Math.sin(hold * Math.PI) * 0.6;
                alpha = 0.9 + pulse * 0.1;
              } else {
                const phase = easeOutCubic((localProgress - 0.64) / 0.36);
                x = particle.targetX + (particle.endX - particle.targetX) * phase;
                y = particle.targetY + (particle.endY - particle.targetY) * phase;
                alpha = 1 - phase;
              }

              if (alpha <= 0) return;
              context.globalAlpha = alpha;
              context.fillStyle = particle.color;
              context.beginPath();
              context.arc(x, y, particle.size, 0, Math.PI * 2);
              context.fill();
            });

            context.globalAlpha = 1;
            context.globalCompositeOperation = "source-over";

            if (progress < 1) {
              animationFrame = window.requestAnimationFrame(draw);
            } else {
              hideIntro();
            }
          } catch {
            hideIntro(false);
          }
        };

        animationFrame = window.requestAnimationFrame(draw);
      } catch {
        hideIntro(false);
      }
    };

    image.onload = startAnimation;
    image.onerror = () => {
      closeTimer = window.setTimeout(() => hideIntro(false), 120);
    };

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [isVisible, reducedMotion]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9998] flex items-center justify-center overflow-hidden bg-[#050b14] transition-opacity duration-500 ${
        isClosing ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(212,43,43,0.16),transparent_30%),radial-gradient(circle_at_50%_72%,rgba(47,104,171,0.14),transparent_34%),linear-gradient(180deg,#050b14_0%,#0A1628_100%)]" />
      <canvas ref={canvasRef} className="relative z-10 h-full w-full" />

      {reducedMotion && (
        <NextImage
          src={LOGO_SRC}
          alt=""
          width={320}
          height={320}
          className={`relative z-20 h-auto w-[140px] object-contain transition duration-700 sm:w-[190px] ${
            isClosing ? "scale-95 opacity-0" : "scale-100 opacity-100"
          }`}
          draggable="false"
        />
      )}
    </div>
  );
}
