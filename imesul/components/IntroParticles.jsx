"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

// Simbolo oficial da marca; mesma fonte usada para amostrar as particulas e para o fallback estatico.
const SYMBOL_SRC = "/logo/imesul-symbol.png";
const SOURCE_WIDTH = 560;
const SOURCE_HEIGHT = 446;

const INTRO_SESSION_KEY = "imesulIntroSeen";

// Resolucao usada so para decidir a posicao final de cada particula; mantida baixa por performance.
const SAMPLE_WIDTH = 240;
const SAMPLE_HEIGHT = Math.round((SAMPLE_WIDTH * SOURCE_HEIGHT) / SOURCE_WIDTH);

const PARTICLE_COLORS = ["#D42B2B", "#FF3B3B"];

// Tamanho logico do estagio por breakpoint (mesmos valores das classes w-[]/h-[] do JSX).
// Calculado por largura de janela em vez de getBoundingClientRect, que capturaria o
// container ainda encolhido pela transicao de entrada (scale-[0.92]) e mediria errado.
const STAGE_SIZES = [
  { minWidth: 1024, w: 214, h: 170 },
  { minWidth: 640, w: 188, h: 150 },
  { minWidth: 0, w: 142, h: 113 },
];

function resolveStageSize(windowWidth) {
  return STAGE_SIZES.find((size) => windowWidth >= size.minWidth) || STAGE_SIZES[STAGE_SIZES.length - 1];
}

const TIMING = {
  activateAt: 40,
  reinforceAt: 1500,
  closeAt: 2650,
  exitDuration: 520,
  convergeEnd: 1550,
  hardCeiling: 4500,
};

const REDUCED_TIMING = {
  activate: 40,
  close: 520,
  extra: 260,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// Isola o vermelho da marca e descarta fundo branco e o retangulo grafite do simbolo fonte.
function isBrandRed(r, g, b, a) {
  if (a < 160) return false;
  if (r > 235 && g > 235 && b > 235) return false;
  return r - g > 35 && r - b > 35;
}

// Converte os pixels vermelhos da marca em pontos-alvo (ainda em espaco de amostragem, centralizados).
function sampleParticleTargets(img, budget) {
  const sampler = document.createElement("canvas");
  sampler.width = SAMPLE_WIDTH;
  sampler.height = SAMPLE_HEIGHT;
  const sctx = sampler.getContext("2d");
  if (!sctx) return [];

  sctx.drawImage(img, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
  const { data } = sctx.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);

  const points = [];
  for (let y = 0; y < SAMPLE_HEIGHT; y += 2) {
    for (let x = 0; x < SAMPLE_WIDTH; x += 2) {
      const i = (y * SAMPLE_WIDTH + x) * 4;
      if (isBrandRed(data[i], data[i + 1], data[i + 2], data[i + 3])) {
        points.push({ x, y });
      }
    }
  }

  if (points.length === 0) return [];

  const stride = Math.max(1, Math.floor(points.length / budget));
  const targets = [];
  for (let i = 0; i < points.length; i += stride) {
    targets.push(points[i]);
  }
  return targets;
}

// Cada particula recebe um ponto de partida disperso perto do alvo, nunca espalhado pela tela toda.
function buildParticles(targets, scaleX, scaleY) {
  return targets.map((point) => {
    const tx = (point.x - SAMPLE_WIDTH / 2) * scaleX;
    const ty = (point.y - SAMPLE_HEIGHT / 2) * scaleY;
    const angle = Math.random() * Math.PI * 2;
    const radius = 24 + Math.random() * 64;

    return {
      tx,
      ty,
      sx: tx + Math.cos(angle) * radius,
      sy: ty + Math.sin(angle) * radius,
      radius: 0.6 + Math.random() * 1,
      color: PARTICLE_COLORS[Math.random() < 0.72 ? 0 : 1],
      baseAlpha: 0.62 + Math.random() * 0.34,
      delay: Math.random() * 280,
      duration: 900 + Math.random() * 380,
      phase: Math.random() * Math.PI * 2,
    };
  });
}

// Reconstroi o vermelho da marca em resolucao nativa, sem o fundo branco do arquivo fonte, e pinta o reforco final.
function paintReinforcement(canvas, img, cssWidth, cssHeight, dpr) {
  const nativeWidth = img.naturalWidth || SOURCE_WIDTH;
  const nativeHeight = img.naturalHeight || SOURCE_HEIGHT;

  const source = document.createElement("canvas");
  source.width = nativeWidth;
  source.height = nativeHeight;
  const sourceCtx = source.getContext("2d");
  if (!sourceCtx) return false;

  sourceCtx.drawImage(img, 0, 0, nativeWidth, nativeHeight);
  const imageData = sourceCtx.getImageData(0, 0, nativeWidth, nativeHeight);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    if (!isBrandRed(data[i], data[i + 1], data[i + 2], data[i + 3])) {
      data[i + 3] = 0;
    }
  }
  sourceCtx.putImageData(imageData, 0, 0);

  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, nativeWidth, nativeHeight, 0, 0, canvas.width, canvas.height);
  return true;
}

// Intro institucional: particulas finas convergem ate formar o simbolo da IMESUL, uma vez por sessao.
// Cai para um fallback estatico (mesmo simbolo, sem canvas) em reduced-motion ou se algo falhar.
export default function IntroParticles() {
  const [isVisible, setIsVisible] = useState(false);
  const [mode, setMode] = useState("pending"); // pending | particles | static
  const [isActive, setIsActive] = useState(false);
  const [reinforceActive, setReinforceActive] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const imgRef = useRef(null);
  const particleCanvasRef = useRef(null);
  const reinforceCanvasRef = useRef(null);
  const particlesRef = useRef([]);
  const rafIdRef = useRef(0);

  // Decide o modo da intro, carrega o simbolo e agenda as transicoes de estado (sem tocar em canvas ainda).
  useEffect(() => {
    let cancelled = false;
    let showTimer = 0;
    let activateTimer = 0;
    let reinforceTimer = 0;
    let closeTimer = 0;
    let removeTimer = 0;
    let ceilingTimer = 0;

    if (typeof window === "undefined") return undefined;

    try {
      if (window.sessionStorage.getItem(INTRO_SESSION_KEY) === "1") return undefined;
    } catch {
      // Sem sessionStorage, a intro roda apenas nesta montagem e continua descartavel.
    }

    const markAsSeen = () => {
      try {
        window.sessionStorage.setItem(INTRO_SESSION_KEY, "1");
      } catch {
        // A intro e opcional; se o navegador bloquear storage, ela roda de novo na proxima visita.
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

    let prefersReducedMotion = false;
    try {
      prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      prefersReducedMotion = false;
    }

    // Garante que a intro nunca fique presa na tela, mesmo se imagem e canvas travarem juntos.
    ceilingTimer = window.setTimeout(() => {
      if (cancelled) return;
      markAsSeen();
      setIsVisible(false);
    }, TIMING.hardCeiling);

    // Adia o primeiro setState para fora do corpo sincrono do efeito.
    showTimer = window.setTimeout(() => {
      if (cancelled) return;
      setReducedMotion(prefersReducedMotion);

      if (prefersReducedMotion) {
        setMode("static");
        setIsVisible(true);
        activateTimer = window.setTimeout(() => {
          if (!cancelled) setIsActive(true);
        }, REDUCED_TIMING.activate);
        closeTimer = window.setTimeout(() => closeIntro(REDUCED_TIMING.extra), REDUCED_TIMING.close);
        return;
      }

      const img = new window.Image();
      img.onload = () => {
        if (cancelled) return;
        imgRef.current = img;
        setMode("particles");
        setIsVisible(true);
        activateTimer = window.setTimeout(() => {
          if (!cancelled) setIsActive(true);
        }, TIMING.activateAt);
        reinforceTimer = window.setTimeout(() => {
          if (!cancelled) setReinforceActive(true);
        }, TIMING.reinforceAt);
        closeTimer = window.setTimeout(() => closeIntro(TIMING.exitDuration), TIMING.closeAt);
      };
      img.onerror = () => {
        if (cancelled) return;
        markAsSeen();
        setIsVisible(false);
      };
      img.src = SYMBOL_SRC;
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(showTimer);
      window.clearTimeout(activateTimer);
      window.clearTimeout(reinforceTimer);
      window.clearTimeout(closeTimer);
      window.clearTimeout(removeTimer);
      window.clearTimeout(ceilingTimer);
    };
  }, []);

  // So mexe no canvas depois que ele existe no DOM (modo particles ja escolhido e renderizado).
  useEffect(() => {
    if (mode !== "particles") return undefined;

    const canvas = particleCanvasRef.current;
    const reinforceCanvas = reinforceCanvasRef.current;
    const img = imgRef.current;
    if (!canvas || !reinforceCanvas || !img) return undefined;

    try {
      const isMobile = window.innerWidth < 640;
      const { w: cssWidth, h: cssHeight } = resolveStageSize(window.innerWidth);
      const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
      const budget = isMobile ? 140 : 360;

      const targets = sampleParticleTargets(img, budget);
      if (targets.length === 0) throw new Error("sem pontos de particula");

      particlesRef.current = buildParticles(targets, cssWidth / SAMPLE_WIDTH, cssHeight / SAMPLE_HEIGHT);

      canvas.width = cssWidth * dpr;
      canvas.height = cssHeight * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas 2d indisponivel");
      ctx.scale(dpr, dpr);

      paintReinforcement(reinforceCanvas, img, cssWidth, cssHeight, dpr);

      const startTime = performance.now();

      const draw = (now) => {
        const elapsed = now - startTime;
        ctx.clearRect(0, 0, cssWidth, cssHeight);
        ctx.save();
        ctx.translate(cssWidth / 2, cssHeight / 2);

        particlesRef.current.forEach((particle) => {
          const raw = clamp((elapsed - particle.delay) / particle.duration, 0, 1);
          const eased = easeOutCubic(raw);
          const x = lerp(particle.sx, particle.tx, eased);
          const y = lerp(particle.sy, particle.ty, eased);
          const radius = lerp(particle.radius * 1.6, particle.radius, eased);
          let alpha = eased * particle.baseAlpha;
          if (elapsed > TIMING.convergeEnd) {
            const shimmer = Math.sin(elapsed / 480 + particle.phase) * 0.12;
            alpha = clamp(particle.baseAlpha + shimmer, 0, 1);
          }

          ctx.beginPath();
          ctx.fillStyle = particle.color;
          ctx.globalAlpha = alpha;
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        });

        ctx.restore();
        rafIdRef.current = window.requestAnimationFrame(draw);
      };

      rafIdRef.current = window.requestAnimationFrame(draw);
    } catch {
      // Qualquer falha de canvas cai no fallback estatico sem travar a home.
      setMode("static");
    }

    return () => {
      if (rafIdRef.current) window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
    };
  }, [mode]);

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
        {mode === "particles" ? (
          <div className="relative h-[113px] w-[142px] sm:h-[150px] sm:w-[188px] lg:h-[170px] lg:w-[214px]">
            <canvas ref={particleCanvasRef} className="absolute inset-0 h-full w-full" />
            <canvas
              ref={reinforceCanvasRef}
              className={`absolute inset-0 h-full w-full transition-opacity duration-[420ms] ease-out ${
                reinforceActive ? "opacity-90" : "opacity-0"
              }`}
            />
          </div>
        ) : (
          <Image
            src={SYMBOL_SRC}
            alt=""
            width={520}
            height={520}
            priority
            className="h-auto w-[142px] object-contain sm:w-[188px] lg:w-[214px]"
            draggable="false"
            onError={() => {
              try {
                window.sessionStorage.setItem(INTRO_SESSION_KEY, "1");
              } catch {
                // Falha de imagem nao deve impedir a abertura da pagina.
              }
              setIsVisible(false);
            }}
          />
        )}

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
