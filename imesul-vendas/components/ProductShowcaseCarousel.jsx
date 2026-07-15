"use client";

// Vitrine horizontal dos produtos do catalogo.
// O clique envia categoria/produto para o fluxo de orcamento sem depender do DOM.
import { useCallback, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { catalogCategories } from "../data/catalogCategories";
import { catalogProducts } from "../data/catalogProducts";

const dragThreshold = 8;
const autoplaySpeed = 0.32;
const resumeDelay = 420;
const inertiaFriction = 0.935;
const maxDragVelocity = 22;
const carouselDisplayNames = {
  "consumiveis-acabamento": "ConsumÃ­veis",
};

const carouselDisplayCategories = {
  "consumiveis-acabamento": "Acabamento e ProteÃ§Ã£o",
};

const carouselFallbackTargets = {
  consumiveis: { categoryId: "tintas-solventes-consumiveis", productId: "consumiveis-acabamento" },
  acessorios: { categoryId: "acessorios-serralheria", productId: null },
};

const normalizeSlug = (value) =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Garante que cada card do carrossel tenha categoria e produto de destino antes do clique.
function resolveCarouselTarget(item, products, categories) {
  const fallback = carouselFallbackTargets[item.id] || carouselFallbackTargets[normalizeSlug(item.showcaseName)];
  const exactProduct =
    products.find((product) => product.id === item.id) ||
    products.find((product) => normalizeSlug(product.name) === normalizeSlug(item.name)) ||
    products.find((product) => normalizeSlug(product.name) === normalizeSlug(item.showcaseName));
  const targetProduct = exactProduct || (fallback?.productId ? products.find((product) => product.id === fallback.productId) : null);
  const categoryId = targetProduct?.categoryId || fallback?.categoryId || item.categoryId;
  const category = categories.find((categoryItem) => categoryItem.id === categoryId);

  return {
    categoryId: category?.id || null,
    categoryName: category?.name || item.category?.name || "",
    productId: targetProduct?.id || null,
    productName: targetProduct?.name || item.name,
    openedExactProduct: Boolean(targetProduct),
    hasDestination: Boolean(category),
  };
}

// Faixa interativa de produtos reais do catalogo, posicionada antes da navegacao por materiais.
export default function ProductShowcaseCarousel({ onSelectProduct, onTrackInteraction }) {
  const sectionRef = useRef(null);
  const trackRef = useRef(null);
  const positionRef = useRef(0);
  const speedRef = useRef(autoplaySpeed);
  const targetSpeedRef = useRef(autoplaySpeed);
  const inertiaVelocityRef = useRef(0);
  const pausedRef = useRef(false);
  const hoverPausedRef = useRef(false);
  const draggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const dragLastXRef = useRef(0);
  const dragLastTimeRef = useRef(0);
  const dragMovedRef = useRef(false);
  const dragStartTimeRef = useRef(0);
  const pressedProductRef = useRef(null);
  const animationFrameRef = useRef(null);
  const resumeTimeoutRef = useRef(null);
  const reducedMotionRef = useRef(false);
  const documentHiddenRef = useRef(false);
  const carouselVisibleRef = useRef(false);

  const products = useMemo(
    () =>
      catalogProducts
        .map((product) => {
          const category = catalogCategories.find((categoryItem) => categoryItem.id === product.categoryId);
          const item = {
            ...product,
            category,
            showcaseName: carouselDisplayNames[product.id] || product.name,
            showcaseCategoryName: carouselDisplayCategories[product.id] || category?.name || "",
          };

          return {
            ...item,
            target: resolveCarouselTarget(item, catalogProducts, catalogCategories),
          };
        })
        .filter((product) => product.category),
    []
  );
  const loopProducts = useMemo(() => [...products, ...products], [products]);

  const applyTrackPosition = useCallback(() => {
    const track = trackRef.current;
    const halfWidth = track ? track.scrollWidth / 2 : 0;
    if (!track || halfWidth <= 0) return;

    if (positionRef.current <= -halfWidth) positionRef.current += halfWidth;
    if (positionRef.current > 0) positionRef.current -= halfWidth;
    track.style.transform = `translate3d(${positionRef.current}px, 0, 0)`;
  }, []);

  // Mantem o autoplay somente enquanto a vitrine esta visivel na tela.
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = media.matches;
    documentHiddenRef.current = document.hidden;

    const stopAnimation = () => {
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      speedRef.current = 0;
      targetSpeedRef.current = 0;
    };

    const animate = () => {
      const hasInertia = Math.abs(inertiaVelocityRef.current) > 0.05;
      const canAutoplay = carouselVisibleRef.current && !documentHiddenRef.current && !reducedMotionRef.current;
      const shouldPause = pausedRef.current || draggingRef.current || !canAutoplay || hasInertia;
      targetSpeedRef.current = shouldPause ? 0 : autoplaySpeed;
      speedRef.current += (targetSpeedRef.current - speedRef.current) * 0.075;

      if (!draggingRef.current && hasInertia) {
        positionRef.current += inertiaVelocityRef.current;
        inertiaVelocityRef.current *= inertiaFriction;
        if (Math.abs(inertiaVelocityRef.current) <= 0.05) {
          inertiaVelocityRef.current = 0;
        }
      } else if (!draggingRef.current) {
        positionRef.current -= speedRef.current;
      }

      applyTrackPosition();

      if (carouselVisibleRef.current && !documentHiddenRef.current && !reducedMotionRef.current) {
        animationFrameRef.current = window.requestAnimationFrame(animate);
      } else {
        stopAnimation();
      }
    };

    const startAnimation = () => {
      if (animationFrameRef.current || !carouselVisibleRef.current || documentHiddenRef.current || reducedMotionRef.current) {
        return;
      }
      animationFrameRef.current = window.requestAnimationFrame(animate);
    };

    const syncMotionPreference = () => {
      reducedMotionRef.current = media.matches;
      targetSpeedRef.current = media.matches ? 0 : autoplaySpeed;
      if (media.matches) {
        stopAnimation();
      } else {
        startAnimation();
      }
    };
    const syncVisibility = () => {
      documentHiddenRef.current = document.hidden;
      if (document.hidden) {
        stopAnimation();
        return;
      }
      startAnimation();
    };

    syncMotionPreference();
    const observer = new IntersectionObserver(
      ([entry]) => {
        carouselVisibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          startAnimation();
        } else {
          stopAnimation();
        }
      },
      { threshold: 0.01, rootMargin: "120px 0px" }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    media.addEventListener("change", syncMotionPreference);
    document.addEventListener("visibilitychange", syncVisibility);

    return () => {
      observer.disconnect();
      media.removeEventListener("change", syncMotionPreference);
      document.removeEventListener("visibilitychange", syncVisibility);
      stopAnimation();
      if (resumeTimeoutRef.current) window.clearTimeout(resumeTimeoutRef.current);
    };
  }, [applyTrackPosition]);

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
    pressedProductRef.current = products.find(
      (product) => product.id === event.target.closest("[data-carousel-product-id]")?.dataset.carouselProductId
    ) || null;
    dragStartXRef.current = event.clientX;
    dragStartYRef.current = event.clientY;
    dragLastXRef.current = event.clientX;
    dragLastTimeRef.current = event.timeStamp;
    dragStartTimeRef.current = event.timeStamp;
    inertiaVelocityRef.current = 0;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!draggingRef.current) return;

    const delta = event.clientX - dragLastXRef.current;
    const elapsed = Math.max(event.timeStamp - dragLastTimeRef.current, 16);
    const totalX = event.clientX - dragStartXRef.current;
    const totalY = event.clientY - dragStartYRef.current;
    dragLastXRef.current = event.clientX;
    dragLastTimeRef.current = event.timeStamp;

    if (Math.hypot(totalX, totalY) > dragThreshold) {
      dragMovedRef.current = true;
    }

    if (!dragMovedRef.current) return;

    positionRef.current += delta;
    applyTrackPosition();
    inertiaVelocityRef.current = reducedMotionRef.current
      ? 0
      : Math.max(-maxDragVelocity, Math.min(maxDragVelocity, (delta / elapsed) * 16));
  };

  const handlePointerUp = (event, { cancelClick = false } = {}) => {
    const wasDragging = dragMovedRef.current;
    const pressedProduct = pressedProductRef.current;

    if (draggingRef.current && wasDragging) {
      onTrackInteraction?.({
        type: "click",
        label: "Arraste no carrossel de produtos",
        section: "Produtos em destaque",
        detail: "UsuÃ¡rio explorou produtos por drag/swipe",
      });
    }

    draggingRef.current = false;
    event?.currentTarget?.releasePointerCapture?.(event.pointerId);
    pressedProductRef.current = null;
    dragMovedRef.current = false;

    if (!wasDragging && !cancelClick && pressedProduct) {
      handleProductClick(pressedProduct);
    }

    if (!hoverPausedRef.current) {
      resumeCarousel();
    }
  };

  const handleProductClick = (product) => {
    if (!product.target?.hasDestination) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`Produto do carrossel sem destino configurado: ${product.name}`);
      }
      return;
    }

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
      detail: `Clique para orçar: ${product.name}`,
    });
    onSelectProduct?.({
      ...product,
      target: product.target,
    });
  };

  return (
    <section
      id="catalog-showcase"
      ref={sectionRef}
      className="relative overflow-hidden border-b border-white/[0.08] bg-[linear-gradient(180deg,rgba(6,16,29,0.92),rgba(7,19,33,0.82))] py-16 sm:py-20"
      aria-label="Carrossel de produtos do catálogo Imesul"
    >
      <div className="relative z-20 mx-auto max-w-[1480px] px-6 sm:px-8 lg:px-12">
        <header data-scroll-reveal className="max-w-4xl">
          <h2 className="font-display text-[clamp(2.8rem,4.6vw,5.2rem)] leading-[0.9] text-white">
            Produtos do catálogo <span className="imesul-title-word">IMESUL</span>
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-imesul-steel-light/72 sm:text-lg">
            Arraste para ver os itens e clique para montar uma solicitação.
          </p>
        </header>
      </div>

      <div
        className="relative z-20 mt-10 cursor-grab touch-pan-y overflow-hidden active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={(event) => handlePointerUp(event, { cancelClick: true })}
        onPointerEnter={pauseCarousel}
        onPointerLeave={() => {
          hoverPausedRef.current = false;
          if (draggingRef.current) {
            handlePointerUp(undefined, { cancelClick: true });
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
              data-carousel-product-id={product.id}
              aria-label={`Clique para orçar ${product.name}`}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleProductClick(product);
                }
              }}
              className="premium-soft-sheen group relative flex h-[285px] w-[235px] shrink-0 cursor-pointer flex-col overflow-hidden rounded-[10px] border border-white/[0.1] bg-[linear-gradient(145deg,rgba(10,24,41,0.94),rgba(4,11,20,0.98))] text-left shadow-[0_22px_62px_rgba(0,0,0,0.22)] transition-[border-color,box-shadow,transform] duration-300 will-change-transform hover:-translate-y-0.5 hover:scale-[1.01] hover:border-[#f0c776]/42 hover:shadow-[0_24px_70px_rgba(240,199,118,0.1),inset_0_1px_0_rgba(255,255,255,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0c776] focus-visible:ring-offset-2 focus-visible:ring-offset-[#06101d] sm:h-[315px] sm:w-[270px]"
            >
              <span className="relative h-40 overflow-hidden border-b border-white/[0.08] bg-[#eef1f4] sm:h-44">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  loading="lazy"
                  decoding="async"
                  sizes="(max-width: 640px) 235px, 270px"
                  className="object-contain p-4 transition-transform duration-700 group-hover:scale-[1.05]"
                />
              </span>
              <span className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#f0c776]">
                  {product.showcaseCategoryName}
                </span>
                <strong className="mt-3 line-clamp-2 font-condensed text-[1.35rem] font-semibold leading-none text-white">
                  {product.showcaseName}
                </strong>
                <span className="mt-auto inline-flex items-center gap-2 pt-5 font-condensed text-[11px] font-bold uppercase tracking-[0.14em] text-white">
                  Clique para orçar!
                  <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
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

