"use client";

import { useEffect } from "react";

// Conecta o Lenis ao ticker do GSAP sem bloquear a primeira renderizacao.
export default function SmoothScroll() {
  useEffect(() => {
    let lenis;
    let gsap;
    let tickerCallback;
    let idleId;
    let timeoutId;
    let cancelled = false;

    // Carrega as bibliotecas durante tempo ocioso e mantem o scroll nativo como fallback.
    const initSmoothScroll = async () => {
      const [{ default: Lenis }, gsapModule, scrollTriggerModule] =
        await Promise.all([
          import("lenis"),
          import("gsap"),
          import("gsap/ScrollTrigger"),
        ]);

      if (cancelled) return;

      gsap = gsapModule.gsap;
      const { ScrollTrigger } = scrollTriggerModule;
      gsap.registerPlugin(ScrollTrigger);

      lenis = new Lenis({
        duration: 1.12,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        syncTouch: false,
      });

      lenis.on("scroll", ScrollTrigger.update);
      tickerCallback = (time) => lenis?.raf(time * 1000);
      gsap.ticker.add(tickerCallback);
      gsap.ticker.lagSmoothing(0);
    };

    // Nao suaviza a rolagem quando o usuario prefere menos movimento.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(initSmoothScroll, { timeout: 1800 });
    } else {
      timeoutId = window.setTimeout(initSmoothScroll, 900);
    }

    // Remove callbacks e a instancia para evitar animacoes duplicadas ao desmontar.
    return () => {
      cancelled = true;
      if (idleId) window.cancelIdleCallback(idleId);
      if (timeoutId) window.clearTimeout(timeoutId);
      if (tickerCallback && gsap) gsap.ticker.remove(tickerCallback);
      lenis?.destroy();
    };
  }, []);

  return null;
}
