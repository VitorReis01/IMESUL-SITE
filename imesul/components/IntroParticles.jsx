"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

// Simbolo oficial da marca; mesma fonte usada para amostrar as particulas e para o fallback estatico.
const SYMBOL_SRC = "/logo/imesul-symbol.png";
const SOURCE_WIDTH = 560;
const SOURCE_HEIGHT = 446;

const INTRO_SESSION_KEY = "imesulIntroSeen";

// Resolucao usada so para decidir a posicao final de cada particula; mantida baixa por performance.
const SAMPLE_WIDTH = 300;
const SAMPLE_HEIGHT = Math.round((SAMPLE_WIDTH * SOURCE_HEIGHT) / SOURCE_WIDTH);

const PARTICLE_COLORS = ["#D42B2B", "#FF3B3B"];

// Tamanho logico do estagio por breakpoint (mesmos valores das classes w-[]/h-[] do JSX), com
// orcamento de particulas, escala do tamanho do ponto e quantidade de pontos de energia por faixa.
// Calculado por largura de janela em vez de getBoundingClientRect, que capturaria o
// container ainda encolhido pela transicao de entrada (scale-[0.92]) e mediria errado.
const STAGE_SIZES = [
  { minWidth: 1024, w: 380, h: 303, budget: 560, particleScale: 1.15, ambientCount: 8 },
  { minWidth: 640, w: 276, h: 220, budget: 340, particleScale: 1.05, ambientCount: 5 },
  { minWidth: 0, w: 196, h: 156, budget: 190, particleScale: 1, ambientCount: 0 },
];

function resolveStageSize(windowWidth) {
  return STAGE_SIZES.find((size) => windowWidth >= size.minWidth) || STAGE_SIZES[STAGE_SIZES.length - 1];
}

const TIMING = {
  activateAt: 40,
  reinforceAt: 1650,
  closeAt: 3150,
  exitDuration: 620,
  convergeEnd: 1700,
  sweepDuration: 1500,
  ambientFadeStart: 650,
  ambientFadeDuration: 700,
  hardCeiling: 5200,
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
// O raio de dispersao acompanha o tamanho do estagio para continuar controlado em telas maiores.
function buildParticles(targets, scaleX, scaleY, stageWidth, particleScale) {
  return targets.map((point) => {
    const tx = (point.x - SAMPLE_WIDTH / 2) * scaleX;
    const ty = (point.y - SAMPLE_HEIGHT / 2) * scaleY;
    const angle = Math.random() * Math.PI * 2;
    const radius = stageWidth * (0.1 + Math.random() * 0.22);

    return {
      tx,
      ty,
      sx: tx + Math.cos(angle) * radius,
      sy: ty + Math.sin(angle) * radius,
      radius: (0.6 + Math.random() * 1) * particleScale,
      color: PARTICLE_COLORS[Math.random() < 0.72 ? 0 : 1],
      baseAlpha: 0.62 + Math.random() * 0.34,
      delay: Math.random() * 320,
      duration: 950 + Math.random() * 420,
      phase: Math.random() * Math.PI * 2,
    };
  });
}

// Pequenos pontos de energia orbitando perto da marca; ficam de fora no menor breakpoint.
function buildAmbientParticles(count, stageWidth) {
  return Array.from({ length: count }).map(() => ({
    baseAngle: Math.random() * Math.PI * 2,
    angleSpeed: (0.12 + Math.random() * 0.18) * (Math.random() < 0.5 ? -1 : 1),
    orbit: stageWidth * (0.34 + Math.random() * 0.16),
    bobAmount: stageWidth * 0.025,
    bobPhase: Math.random() * Math.PI * 2,
    size: 0.7 + Math.random() * 0.8,
    color: PARTICLE_COLORS[Math.random() < 0.5 ? 0 : 1],
    alpha: 0.22 + Math.random() * 0.24,
  }));
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
  const ambientRef = useRef([]);
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
      const isNarrow = window.innerWidth < 640;
      const stage = resolveStageSize(window.innerWidth);
      const { w: cssWidth, h: cssHeight, budget, particleScale, ambientCount } = stage;
      const dpr = Math.min(window.devicePixelRatio || 1, isNarrow ? 1.5 : 2);

      const targets = sampleParticleTargets(img, budget);
      if (targets.length === 0) throw new Error("sem pontos de particula");

      particlesRef.current = buildParticles(
        targets,
        cssWidth / SAMPLE_WIDTH,
        cssHeight / SAMPLE_HEIGHT,
        cssWidth,
        particleScale
      );
      ambientRef.current = buildAmbientParticles(ambientCount, cssWidth);

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

        // Varredura horizontal discreta que atravessa o estagio uma unica vez, junto da formacao.
        if (elapsed < TIMING.sweepDuration) {
          const sweepT = easeOutCubic(clamp(elapsed / TIMING.sweepDuration, 0, 1));
          const sweepY = lerp(-cssHeight * 0.65, cssHeight * 0.65, sweepT);
          const bandHeight = Math.max(16, cssHeight * 0.12);
          const gradient = ctx.createLinearGradient(0, sweepY - bandHeight / 2, 0, sweepY + bandHeight / 2);
          gradient.addColorStop(0, "rgba(226,238,249,0)");
          gradient.addColorStop(0.5, "rgba(226,238,249,0.13)");
          gradient.addColorStop(1, "rgba(226,238,249,0)");
          ctx.globalAlpha = 1;
          ctx.fillStyle = gradient;
          ctx.fillRect(-cssWidth / 2, sweepY - bandHeight / 2, cssWidth, bandHeight);
        }

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

        // Pontos de energia orbitando perto da marca, revelados so depois que a formacao comeca a aparecer.
        const ambientFade = clamp((elapsed - TIMING.ambientFadeStart) / TIMING.ambientFadeDuration, 0, 1);
        if (ambientFade > 0) {
          ambientRef.current.forEach((amb) => {
            const angle = amb.baseAngle + (elapsed / 1000) * amb.angleSpeed;
            const orbit = amb.orbit + Math.sin(elapsed / 900 + amb.bobPhase) * amb.bobAmount;
            const ax = Math.cos(angle) * orbit;
            const ay = Math.sin(angle) * orbit;

            ctx.beginPath();
            ctx.fillStyle = amb.color;
            ctx.globalAlpha = amb.alpha * ambientFade;
            ctx.arc(ax, ay, amb.size, 0, Math.PI * 2);
            ctx.fill();
          });
        }

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
      className={`fixed inset-0 z-[9998] flex items-center justify-center overflow-hidden bg-[#050b14] transition-[opacity,transform] ${
        reducedMotion ? "duration-300" : "duration-[650ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
      } ${isClosing ? "pointer-events-none scale-[1.04] opacity-0" : "scale-100 opacity-100"}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(47,104,171,0.13),transparent_34%),linear-gradient(180deg,#040a12_0%,#0A1628_100%)]" />

      {/* Grade tecnica discreta no fundo, reforca a sensacao industrial sem competir com a marca. */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-1000 ${
          isActive ? "opacity-[0.05]" : "opacity-0"
        } [background-image:linear-gradient(90deg,rgba(226,238,249,0.7)_1px,transparent_1px),linear-gradient(rgba(226,238,249,0.7)_1px,transparent_1px)] [background-size:56px_56px]`}
      />

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
        <div className="relative flex items-center justify-center">
          {/* Halo suave atras da marca: brilho quente da marca por fora, reflexo frio no centro. */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute left-1/2 top-1/2 h-[240px] w-[240px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-700 sm:h-[350px] sm:w-[350px] lg:h-[480px] lg:w-[480px] ${
              isActive ? "opacity-100" : "opacity-0"
            } bg-[radial-gradient(circle_at_50%_50%,rgba(212,43,43,0.16),transparent_58%),radial-gradient(circle_at_50%_46%,rgba(226,238,249,0.1),transparent_36%)]`}
          />

          {mode === "particles" ? (
            <div className="relative h-[156px] w-[196px] sm:h-[220px] sm:w-[276px] lg:h-[303px] lg:w-[380px]">
              <canvas ref={particleCanvasRef} className="absolute inset-0 h-full w-full" />
              <canvas
                ref={reinforceCanvasRef}
                className={`absolute inset-0 h-full w-full transition-opacity duration-[420ms] ease-out [filter:drop-shadow(0_0_16px_rgba(212,43,43,0.32))] ${
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
              className="h-auto w-[196px] object-contain sm:w-[276px] lg:w-[380px]"
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
        </div>

        {/* Linha de energia: nasce do centro para as laterais e acende no momento do reforco final. */}
        <div className="relative mt-10 h-[3px] w-56 sm:mt-11 sm:w-64 lg:w-72">
          <div className="absolute inset-0 overflow-hidden rounded-full bg-white/[0.08]">
            <span
              className={`block h-full w-full origin-center bg-gradient-to-r from-transparent via-imesul-red to-transparent transition-transform ${
                reducedMotion
                  ? "duration-300"
                  : "duration-[1600ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
              } ${isActive ? "scale-x-100" : "scale-x-0"}`}
            />
          </div>
          <span
            className={`pointer-events-none absolute left-1/2 top-1/2 h-2 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-imesul-red/80 blur-md transition-opacity duration-500 ${
              reinforceActive ? "opacity-70" : "opacity-0"
            }`}
          />
        </div>
      </div>
    </div>
  );
}
