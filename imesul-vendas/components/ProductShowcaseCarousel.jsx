"use client";

import { useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { catalogCategories } from "../data/catalogCategories";
import { catalogProducts } from "../data/catalogProducts";

const dragThreshold = 8;
const autoplaySpeed = 0.42;
const resumeDelay = 420;
const inertiaFriction = 0.935;
const maxDragVelocity = 22;

// Faixa interativa de produtos reais do catalogo, posicionada antes da navegacao por materiais.
export default function ProductShowcaseCarousel({ onSelectProduct, onTrackInteraction }) {
  const trackRef = useRef(null);
  const positionRef = useRef(0);
  const speedRef = useRef(autoplaySpeed);
  const targetSpeedRef = useRef(autoplaySpeed);
  const inertiaVelocityRef = useRef(0);
  const pausedRef = useRef(false);
  const hoverPausedRef = useRef(false);
  const draggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragLastXRef = useRef(0);
  const dragLastTimeRef = useRef(0);
  const dragMovedRef = useRef(false);
  const animationFrameRef = useRef(null);
  const resumeTimeoutRef = useRef(null);
  const reducedMotionRef = useRef(false);
  const documentHiddenRef = useRef(false);

  const products = useMemo(
    () =>
      catalogProducts
        .map((product) => ({
          ...product,
          category: catalogCategories.find((category) => category.id === product.categoryId),
        }))
        .filter((product) => product.category),
    []
  );
  const loopProducts = useMemo(() => [...products, ...products], [products]);

  // Mantem o movimento continuo sem depender de biblioteca pesada de carrossel.
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = media.matches;
    documentHiddenRef.current = document.hidden;
    const syncMotionPreference = () => {
      reducedMotionRef.current = media.matches;
      targetSpeedRef.current = media.matches ? 0 : autoplaySpeed;
    };
    const syncVisibility = () => {
      documentHiddenRef.current = document.hidden;
      if (document.hidden) {
        speedRef.current = 0;
        targetSpeedRef.current = 0;
      }
    };

    const animate = () => {
      const track = trackRef.current;
      const halfWidth = track ? track.scrollWidth / 2 : 0;
      const hasInertia = Math.abs(inertiaVelocityRef.current) > 0.05;
      const shouldPause = pausedRef.current || draggingRef.current || reducedMotionRef.current || documentHiddenRef.current || hasInertia;
      targetSpeedRef.current = shouldPause ? 0 : autoplaySpeed;
      speedRef.current += (targetSpeedRef.current - speedRef.current) * 0.085;

      if (track && halfWidth > 0) {
        if (!draggingRef.current && hasInertia) {
          positionRef.current += inertiaVelocityRef.current;
          inertiaVelocityRef.current *= inertiaFriction;
          if (Math.abs(inertiaVelocityRef.current) <= 0.05) {
            inertiaVelocityRef.current = 0;
          }
        } else if (!draggingRef.current) {
          positionRef.current -= speedRef.current;
        }

        if (positionRef.current <= -halfWidth) positionRef.current += halfWidth;
        if (positionRef.current > 0) positionRef.current -= halfWidth;
        track.style.transform = `translate3d(${positionRef.current}px, 0, 0)`;
      }

      animationFrameRef.current = window.requestAnimationFrame(animate);
    };

    syncMotionPreference();
    media.addEventListener("change", syncMotionPreference);
    document.addEventListener("visibilitychange", syncVisibility);
    animationFrameRef.current = window.requestAnimationFrame(animate);

    return () => {
      media.removeEventListener("change", syncMotionPreference);
      document.removeEventListener("visibilitychange", syncVisibility);
      if (animationFrameRef.current) window.cancelAnimationFrame(animationFrameRef.current);
      if (resumeTimeoutRef.current) window.clearTimeout(resumeTimeoutRef.current);
    };
  }, []);

  const pauseCarousel = () => {
    if (resumeTimeoutRef.current) window.clearTimeout(resumeTimeoutRef.current);
    hoverPausedRef.current = true;
    pausedRef.current = true;
  };

  const resumeCarousel = (delay = resumeDelay) => {
    if (resumeTimeoutRef.current) window.clearTimeout(resumeTimeoutRef.current);
    resumeTimeoutRef.current = window.setTimeout(() => {
      if (!hoverPausedRef.current && !draggingRef.current) {
        pausedRef.current = false;
      }
    }, delay);
  };

  const handlePointerDown = (event) => {
    if (resumeTimeoutRef.current) window.clearTimeout(resumeTimeoutRef.current);
    draggingRef.current = true;
    pausedRef.current = true;
    dragMovedRef.current = false;
    dragStartXRef.current = event.clientX;
    dragLastXRef.current = event.clientX;
    dragLastTimeRef.current = event.timeStamp;
    inertiaVelocityRef.current = 0;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!draggingRef.current) return;

    const delta = event.clientX - dragLastXRef.current;
    const elapsed = Math.max(event.timeStamp - dragLastTimeRef.current, 16);
    dragLastXRef.current = event.clientX;
    dragLastTimeRef.current = event.timeStamp;
    positionRef.current += delta;
    inertiaVelocityRef.current = reducedMotionRef.current
      ? 0
      : Math.max(-maxDragVelocity, Math.min(maxDragVelocity, (delta / elapsed) * 16));

    if (Math.abs(event.clientX - dragStartXRef.current) > dragThreshold) {
      dragMovedRef.current = true;
    }
  };

  const handlePointerUp = (event) => {
    if (draggingRef.current && dragMovedRef.current) {
      onTrackInteraction?.({
        type: "click",
        label: "Arraste no carrossel de produtos",
        section: "Produtos em destaque",
        detail: "Usuário explorou produtos por drag/swipe",
      });
    }

    draggingRef.current = false;
    event?.currentTarget?.releasePointerCapture?.(event.pointerId);
    if (!hoverPausedRef.current) {
      resumeCarousel();
    }
  };

  const handleProductClick = (product) => {
    if (dragMovedRef.current) return;

    onTrackInteraction?.({
      type: "click",
      label: "Produto do carrossel",
      section: "Produtos em destaque",
      detail: product.name,
    });
    onTrackInteraction?.({
      type: "click",
      label: "CTA do produto no carrossel",
      section: "Produtos em destaque",
      detail: `Montar solicitação: ${product.name}`,
    });
    onSelectProduct?.(product);
  };

  return (
    <section
      className="relative z-10 overflow-hidden border-b border-white/[0.08] bg-[#06101d]/86 py-16 sm:py-20"
      aria-label="Carrossel de produtos do catálogo Imesul"
    >
      <div className="mx-auto max-w-[1480px] px-6 sm:px-8 lg:px-12">
        <header data-scroll-reveal className="max-w-4xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-[#f0c776]">
            Catálogo IMESUL
          </p>
          <h2 className="mt-4 font-display text-[clamp(2.8rem,4.6vw,5.2rem)] leading-[0.9] text-white">
            Produtos do catálogo IMESUL
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-imesul-steel-light/72 sm:text-lg">
            Arraste para ver os itens e clique para montar uma solicitação.
          </p>
        </header>
      </div>

      <div
        className="relative mt-10 cursor-grab touch-pan-y overflow-hidden active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerEnter={pauseCarousel}
        onPointerLeave={() => {
          hoverPausedRef.current = false;
          if (draggingRef.current) {
            handlePointerUp();
          } else {
            resumeCarousel(180);
          }
        }}
      >
        <span className="pointer-events-none absolute inset-y-0 left-0 z-20 w-[clamp(42px,10vw,170px)] bg-gradient-to-r from-[#06101d] via-[#06101d]/82 to-transparent" />
        <span className="pointer-events-none absolute inset-y-0 right-0 z-20 w-[clamp(42px,10vw,170px)] bg-gradient-to-l from-[#06101d] via-[#06101d]/82 to-transparent" />
        <div ref={trackRef} className="flex w-max gap-4 pl-6 will-change-transform sm:gap-5 sm:pl-8 lg:pl-12">
          {loopProducts.map((product, index) => (
            <button
              key={`${product.id}-${index}`}
              type="button"
              aria-label={`Montar solicitação para ${product.name}`}
              onClick={() => handleProductClick(product)}
              className="group relative flex h-[285px] w-[235px] shrink-0 cursor-pointer flex-col overflow-hidden rounded-[10px] border border-white/[0.1] bg-[linear-gradient(145deg,rgba(10,24,41,0.94),rgba(4,11,20,0.98))] text-left shadow-[0_24px_70px_rgba(0,0,0,0.26)] transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-1 hover:border-[#f0c776]/45 hover:shadow-[0_28px_80px_rgba(240,199,118,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0c776] focus-visible:ring-offset-2 focus-visible:ring-offset-[#06101d] sm:h-[315px] sm:w-[270px]"
            >
              <span className="relative h-40 overflow-hidden border-b border-white/[0.08] bg-[#eef1f4] sm:h-44">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  loading="lazy"
                  decoding="async"
                  sizes="(max-width: 640px) 235px, 270px"
                  className="object-contain p-4 transition-transform duration-500 group-hover:scale-[1.05]"
                />
              </span>
              <span className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#f0c776]">
                  {product.category.name}
                </span>
                <strong className="mt-3 line-clamp-2 font-condensed text-[1.35rem] font-semibold leading-none text-white">
                  {product.name}
                </strong>
                <span className="mt-auto inline-flex items-center gap-2 pt-5 font-condensed text-[11px] font-bold uppercase tracking-[0.14em] text-white">
                  Montar solicitação
                  <ArrowRight size={14} aria-hidden="true" />
                </span>
              </span>
              <span className="pointer-events-none absolute inset-0 opacity-0 ring-1 ring-inset ring-[#f0c776]/25 transition-opacity duration-300 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
