"use client";

// Wrapper fino para links que precisam de um brilho seguindo o cursor no hover (desktop) e uma leve
// elevacao, sem depender de setState por movimento do mouse: a posicao do brilho vai direto para
// CSS custom properties (--glow-x/--glow-y) via ref, e um radial-gradient le essas variaveis. Em
// touch nao ha mousemove, entao o brilho so aparece via :hover simples (mesmo comportamento ja
// existente no botao). Em prefers-reduced-motion, nem o brilho nem a elevacao sao renderizados.
import { useRef } from "react";
import { useReducedMotion } from "framer-motion";

const GLOW_BY_VARIANT = {
  whatsapp: "rgba(184,255,214,0.45)",
  secondary: "rgba(212,43,43,0.32)",
};

const FOCUS_OUTLINE_BY_VARIANT = {
  whatsapp: "focus-visible:outline-white/80",
  secondary: "focus-visible:outline-imesul-red/70",
};

export default function PremiumGlowButton({
  href,
  variant = "secondary",
  className = "",
  children,
  ...anchorProps
}) {
  const ref = useRef(null);
  const shouldReduceMotion = useReducedMotion();
  const glowColor = GLOW_BY_VARIANT[variant] || GLOW_BY_VARIANT.secondary;
  const focusOutline = FOCUS_OUTLINE_BY_VARIANT[variant] || FOCUS_OUTLINE_BY_VARIANT.secondary;

  const handleMouseMove = (event) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--glow-x", `${event.clientX - rect.left}px`);
    el.style.setProperty("--glow-y", `${event.clientY - rect.top}px`);
  };

  return (
    <a
      ref={ref}
      href={href}
      onMouseMove={shouldReduceMotion ? undefined : handleMouseMove}
      className={`group/glow relative isolate overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${focusOutline} ${
        shouldReduceMotion ? "" : "hover:-translate-y-0.5"
      } ${className}`}
      {...anchorProps}
    >
      {!shouldReduceMotion && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/glow:opacity-100"
          style={{
            background: `radial-gradient(160px circle at var(--glow-x, 50%) var(--glow-y, 50%), ${glowColor}, transparent 70%)`,
          }}
        />
      )}
      {children}
    </a>
  );
}
