"use client";

// Showroom institucional dos produtos principais.
// Usa dados de products.js e direciona o cliente para a area de vendas.
import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { products, salesSiteUrl } from "../data/products";
import useCompatibility from "../hooks/useCompatibility";
import { navigateWithConsent } from "../lib/consent";
import { getServerUnitRaw, getStoredUnitRaw, subscribeToUnit } from "../lib/unitPreference";

// Mantem o tratamento visual das imagens consistente nos cards e no palco desktop.
function ProductImage({ product, compact = false }) {
  const isAccessoryShowroom = product.id === "acessorios-serralheria";

  return (
    <div
      className={`relative flex items-center justify-center ${
        compact
          ? "h-[clamp(8rem,24svh,13rem)] w-full sm:h-[clamp(9rem,23svh,14rem)] [@media(max-height:700px)]:h-[clamp(6rem,20svh,8rem)] [@media(max-height:480px)]:h-[clamp(5rem,44svh,9rem)]"
          : "h-full w-full translate-x-[2%]"
      }`}
    >
      <Image
        src={product.image}
        alt={`${product.name} da linha IMESUL`}
        width={1536}
        height={1024}
        sizes={compact ? "(max-width: 767px) 92vw, 46vw" : "56vw"}
        className={`object-contain ${
          compact
            ? isAccessoryShowroom
              ? "h-[78%] w-[78%]"
              : "h-full w-full p-5 sm:p-6"
            : isAccessoryShowroom
              ? "h-[84%] max-h-[580px] w-[84%] max-w-[880px]"
              : "h-[108%] max-h-[740px] w-[108%] max-w-[1120px]"
        }`}
        draggable="false"
        style={{
          filter:
            "drop-shadow(0 34px 52px rgba(0,0,0,0.52)) drop-shadow(0 0 18px rgba(226,238,249,0.16))",
        }}
      />
    </div>
  );
}

// Leva a selecao para o site comercial sem simular compra no institucional.
function SalesLink({ compact = false }) {
  // useSyncExternalStore evita tanto o mismatch de hidratacao quanto setState dentro de efeito
  // (mesmo padrão de FinalCTA.jsx e imesul-vendas/lib/consent.js).
  const unit = useSyncExternalStore(subscribeToUnit, getStoredUnitRaw, getServerUnitRaw);
  const href = unit ? `${salesSiteUrl}?unidade=${unit}` : salesSiteUrl;

  return (
    <a
      href={href}
      onClick={(event) => navigateWithConsent(event, href)}
      className={`group/link inline-flex min-h-12 items-center justify-between gap-5 border border-imesul-red bg-imesul-red font-condensed font-bold text-white uppercase transition duration-300 hover:-translate-y-0.5 hover:bg-[#ef3434] hover:shadow-[0_16px_34px_rgba(212,43,43,0.25)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-imesul-red ${
        compact
          ? "mt-4 w-full px-4 py-2.5 text-[10px] tracking-[0.1em] sm:px-5 sm:py-3 sm:text-xs [@media(max-height:700px)]:mt-2 [@media(max-height:700px)]:py-2"
          : "mt-7 w-fit min-w-[310px] px-6 py-3 text-sm tracking-[0.14em]"
      }`}
    >
      <span>Ver opções na Área de Vendas</span>
      <span
        aria-hidden="true"
        className="text-lg leading-none transition-transform duration-300 group-hover/link:translate-x-1"
      >
        →
      </span>
    </a>
  );
}

// Compartilha textos, variacoes e uso principal entre os dois layouts responsivos.
function ProductInformation({ product, compact = false }) {
  const longTitle = product.name.length > 22;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] tracking-[0.3em] text-imesul-red">
          {product.number}
        </span>
        <span className="h-px w-8 bg-imesul-red/80" />
        <span className="font-mono text-[9px] tracking-[0.26em] text-imesul-steel/55">
          {product.tag}
        </span>
      </div>

      <h3
        className={`mt-4 max-w-[620px] font-display leading-[0.92] text-white ${
          compact
            ? longTitle
              ? "text-[clamp(1.55rem,7vw,2.15rem)] [@media(max-height:700px)]:text-[clamp(1.25rem,6vw,1.65rem)]"
              : "text-[clamp(1.9rem,8vw,2.6rem)] [@media(max-height:700px)]:text-[clamp(1.45rem,7vw,2rem)]"
            : longTitle
              ? "text-[3.4rem] xl:text-[4rem]"
              : "text-[4.25rem] xl:text-[5rem]"
        }`}
      >
        {product.name}
      </h3>

      <p className={`font-condensed text-xs font-semibold tracking-[0.17em] text-imesul-red uppercase sm:text-sm ${compact ? "mt-2 [@media(max-height:480px)]:hidden" : "mt-3"}`}>
        {product.subtitle}
      </p>
      <p
        className={`max-w-[560px] text-imesul-steel-light/75 ${
          compact
            ? "mt-3 overflow-hidden text-xs leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] sm:text-sm [@media(max-height:700px)]:mt-2 [@media(max-height:700px)]:[-webkit-line-clamp:1] [@media(max-height:480px)]:hidden"
            : "mt-4 text-sm leading-6 sm:text-[15px] sm:leading-7"
        }`}
      >
        {product.description}
      </p>

      <dl
        className={`grid border-t border-white/10 ${
          compact
            ? "mt-4 gap-3 pt-4 [@media(max-height:700px)]:mt-2 [@media(max-height:700px)]:gap-2 [@media(max-height:700px)]:pt-2"
            : "mt-6 gap-5 pt-5 max-w-[570px] sm:grid-cols-[1.08fr_0.92fr]"
        }`}
      >
        <div>
          <dt className="font-mono text-[9px] tracking-[0.24em] text-imesul-steel/55">
            PRINCIPAIS VARIAÇÕES
          </dt>
          <dd className={`flex flex-wrap gap-x-4 gap-y-2 ${compact ? "mt-2 [@media(max-height:700px)]:gap-y-1" : "mt-3"}`}>
            {product.variations.map((variation) => (
              <span
                key={variation}
                className={`relative pl-3 font-condensed font-medium text-imesul-steel before:absolute before:left-0 before:top-[0.58em] before:h-1 before:w-1 before:bg-imesul-red ${
                  compact ? "text-xs" : "text-sm"
                }`}
              >
                {variation}
              </span>
            ))}
          </dd>
        </div>

        <div className={compact ? "hidden" : "border-l border-white/10 pl-5"}>
          <dt className="font-mono text-[9px] tracking-[0.24em] text-imesul-red">
            USO PRINCIPAL
          </dt>
          <dd className="mt-3 text-sm leading-6 text-white/80">{product.principalUse}</dd>
        </div>
      </dl>

      <SalesLink compact={compact} />
    </div>
  );
}

function CompatibilityProductCard({ product, index, fallback = false }) {
  return (
    <article className="grid gap-5 border border-white/10 bg-[#091524]/92 p-4 shadow-[0_18px_52px_rgba(0,0,0,0.24)] sm:p-6 md:grid-cols-[0.9fr_1.1fr] md:items-center">
      <div className="relative flex h-52 items-center justify-center overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_62%_44%,rgba(212,43,43,0.1),transparent_38%),linear-gradient(145deg,#101f31,#07101c)] sm:h-64 md:h-72">
        <span className="absolute left-4 top-4 z-10 font-mono text-[9px] tracking-[0.2em] text-white/35">
          {String(index + 1).padStart(2, "0")}/{String(products.length).padStart(2, "0")}
        </span>
        <Image
          src={product.image}
          alt={`${product.name} da linha IMESUL`}
          width={1536}
          height={1024}
          sizes="(max-width: 767px) 92vw, 42vw"
          className="h-full w-full object-contain p-5"
          draggable="false"
          priority={index === 0 && !fallback}
        />
      </div>

      <div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] tracking-[0.28em] text-imesul-red">
            {product.number}
          </span>
          <span className="font-mono text-[10px] tracking-[0.22em] text-imesul-steel/55">
            {product.tag}
          </span>
        </div>
        <h3 className="mt-4 font-display text-[clamp(2.2rem,10vw,4.5rem)] uppercase leading-[0.92] text-white md:text-[clamp(3.4rem,6vw,5.4rem)]">
          {product.name}
        </h3>
        <p className="mt-3 font-condensed text-xs font-semibold uppercase tracking-[0.17em] text-imesul-red sm:text-sm">
          {product.subtitle}
        </p>
        <p className="mt-4 max-w-xl text-sm leading-6 text-imesul-steel-light/76 sm:text-base sm:leading-7">
          {product.description}
        </p>

        <dl className="mt-5 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-[1.05fr_0.95fr]">
          <div>
            <dt className="font-mono text-[9px] tracking-[0.24em] text-imesul-steel/55">
              PRINCIPAIS VARIAÃ‡Ã•ES
            </dt>
            <dd className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              {product.variations.map((variation) => (
                <span
                  key={variation}
                  className="relative pl-3 font-condensed text-sm font-medium text-imesul-steel before:absolute before:left-0 before:top-[0.58em] before:h-1 before:w-1 before:bg-imesul-red"
                >
                  {variation}
                </span>
              ))}
            </dd>
          </div>

          <div className="sm:border-l sm:border-white/10 sm:pl-5">
            <dt className="font-mono text-[9px] tracking-[0.24em] text-imesul-red">
              USO PRINCIPAL
            </dt>
            <dd className="mt-3 text-sm leading-6 text-white/80">{product.principalUse}</dd>
          </div>
        </dl>

        <SalesLink />
      </div>
    </article>
  );
}

function CompatibilityProductExperience({ fallback = false }) {
  // Palco desktop de reduced-motion: mostra 1 produto por vez, sem GSAP/pin/parallax/fade -
  // troca de produto e so um re-render do React (nao ha nada para animar). Reaproveita
  // ProductImage/ProductInformation/products - os mesmos usados no showroom "full" animado, que
  // esta funcao nao altera. Mobile/tablet continuam com a lista vertical de sempre (ver lg:hidden
  // abaixo); este palco so aparece em lg+.
  const [desktopActive, setDesktopActive] = useState(0);
  const desktopProduct = products[desktopActive];

  const goToPreviousProduct = () => {
    setDesktopActive((current) => (current - 1 + products.length) % products.length);
  };

  const goToNextProduct = () => {
    setDesktopActive((current) => (current + 1) % products.length);
  };

  return (
    <section id="produtos" className="relative overflow-hidden bg-[#050b14] py-20 sm:py-24">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_36%,rgba(212,43,43,0.1),transparent_29%),radial-gradient(circle_at_52%_72%,rgba(48,107,180,0.1),transparent_38%),linear-gradient(180deg,#0A1628_0%,#050b14_100%)]" />
      <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:86px_86px]" />

      <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-8">
        <header className="max-w-4xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[10px] tracking-[0.34em] text-imesul-red">
              SHOWROOM IMESUL
            </span>
            {!fallback && (
              <span className="font-mono text-[10px] tracking-[0.22em] text-imesul-steel/50">
                {String(products.length).padStart(2, "0")} LINHAS
              </span>
            )}
          </div>
          <h2 className="mt-5 max-w-3xl font-display text-[clamp(2.6rem,11vw,5.4rem)] leading-[0.92] text-white">
            SOLUÃ‡Ã•ES PARA QUEM CONSTRÃ“I E TRANSFORMA
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-imesul-steel-light/70 sm:text-base sm:leading-7">
            ConheÃ§a as principais linhas da IMESUL e encontre o material adequado para sua obra,
            indÃºstria ou serralheria.
          </p>
        </header>

        <div className="mt-10 grid gap-6 lg:hidden">
          {products.map((product, index) => (
            <CompatibilityProductCard
              key={product.id}
              product={product}
              index={index}
              fallback={fallback}
            />
          ))}
        </div>
      </div>

      <div className="relative z-10 hidden lg:block">
        <div className="mx-auto grid max-w-[1600px] grid-cols-[0.94fr_1.06fr] items-center gap-12 px-12 pb-4 pt-10 xl:px-16">
          <div className="relative z-20">
            <div className="w-full max-w-[650px] border-l-2 border-imesul-red bg-[#07111f]/78 px-8 py-7 shadow-[0_30px_90px_rgba(0,0,0,0.25)] backdrop-blur-sm">
              <ProductInformation product={desktopProduct} />
            </div>

            <div className="mt-8 flex items-center gap-5">
              <button
                type="button"
                onClick={goToPreviousProduct}
                aria-label="Produto anterior"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-white hover:border-imesul-red hover:text-imesul-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-imesul-red"
              >
                <span aria-hidden="true">←</span>
              </button>

              <div className="flex items-center gap-1">
                {products.map((product, index) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setDesktopActive(index)}
                    aria-label={`Ver ${product.name}`}
                    aria-current={index === desktopActive ? "true" : undefined}
                    className="p-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-imesul-red"
                  >
                    <span
                      aria-hidden="true"
                      className={`block h-1.5 w-1.5 rounded-full ${
                        index === desktopActive ? "scale-150 bg-imesul-red" : "bg-white/20"
                      }`}
                    />
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={goToNextProduct}
                aria-label="Próximo produto"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-white hover:border-imesul-red hover:text-imesul-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-imesul-red"
              >
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>

          <div className="relative h-[78vh] min-h-[540px]">
            <div className="absolute inset-[7%] rounded-full bg-imesul-red/[0.055] blur-[90px]" />
            <div className="absolute inset-x-[5%] bottom-[9%] h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            <ProductImage product={desktopProduct} />
          </div>
        </div>
      </div>
    </section>
  );
}

// Exibe cards no mobile e um showroom fixado, controlado por scroll, no desktop.
export default function ProductScrollExperience() {
  const { mode, ready } = useCompatibility();
  const sectionRef = useRef(null);
  const visualRefs = useRef([]);
  const mobileVisualRefs = useRef([]);
  const mobileInfoRefs = useRef([]);
  const progressRef = useRef(null);
  const mobileProgressRef = useRef(null);
  const activeRef = useRef(0);
  const activeMobileRef = useRef(0);
  const [active, setActive] = useState(0);
  const [activeMobile, setActiveMobile] = useState(0);
  const [animationFailed, setAnimationFailed] = useState(false);
  const isFullMode = ready && mode === "full" && !animationFailed;

  // No desktop, transforma o progresso da secao em trocas de produto com foco e escala.
  // O matchMedia desativa o efeito no mobile e respeita movimento reduzido.
  useEffect(() => {
    if (!isFullMode) return undefined;

    let media;
    let cancelled = false;
    let refreshFrame = 0;
    let refreshProductScroll;

    const setup = async () => {
      try {
        const [{ gsap }, { ScrollTrigger }] = await Promise.all([
          import("gsap"),
          import("gsap/ScrollTrigger"),
        ]);
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger);
        media = gsap.matchMedia();
        refreshProductScroll = () => {
          if (refreshFrame) return;
          refreshFrame = window.requestAnimationFrame(() => {
            refreshFrame = 0;
            ScrollTrigger.refresh();
          });
        };

        media.add("(max-width: 1023px) and (prefers-reduced-motion: no-preference)", () => {
        const context = gsap.context(() => {
          const mobileVisualItems = mobileVisualRefs.current.filter(Boolean);
          const mobileInfoItems = mobileInfoRefs.current.filter(Boolean);

          gsap.set(mobileVisualItems, { autoAlpha: 0, scale: 0.94, y: 24 });
          gsap.set(mobileInfoItems, { autoAlpha: 0, y: 18 });
          gsap.set([mobileVisualItems[0], mobileInfoItems[0]], {
            autoAlpha: 1,
            scale: 1,
            y: 0,
          });

          // Mobile troca um produto por vez em um pin curto por item, sem blur pesado nem scroll artificial.
          const timeline = gsap.timeline({
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top top",
              end: () => {
                const landscape = window.innerWidth > window.innerHeight;
                const compactHeight = window.innerHeight < 700;
                const perProduct = landscape
                  ? Math.min(window.innerHeight * 0.22, 150)
                  : compactHeight
                    ? Math.min(window.innerHeight * 0.26, 175)
                    : Math.min(window.innerHeight * 0.32, 240);
                return `+=${products.length * perProduct}`;
              },
              pin: true,
              scrub: 0.55,
              anticipatePin: 0.5,
              invalidateOnRefresh: true,
              onUpdate: ({ progress }) => {
                const next = Math.min(products.length - 1, Math.floor(progress * products.length));
                if (activeMobileRef.current !== next) {
                  activeMobileRef.current = next;
                  setActiveMobile(next);
                }
                gsap.set(mobileProgressRef.current, { scaleX: progress });
              },
            },
          });

          products.forEach((product, index) => {
            const at = index * 1;

            timeline
              .to(
                mobileVisualRefs.current[index],
                { autoAlpha: 1, scale: 1, y: 0, duration: 0.2, ease: "power2.out" },
                at
              )
              .to(
                mobileInfoRefs.current[index],
                { autoAlpha: 1, y: 0, duration: 0.2, ease: "power2.out" },
                at
              )
              .to(
                mobileVisualRefs.current[index],
                { scale: 1.035, y: -8, duration: 0.58, ease: "none" },
                at + 0.18
              );

            if (index < products.length - 1) {
              timeline
                .to(
                  mobileVisualRefs.current[index],
                  { autoAlpha: 0, scale: 0.97, y: -18, duration: 0.22, ease: "power2.inOut" },
                  at + 0.78
                )
                .to(
                  mobileInfoRefs.current[index],
                  { autoAlpha: 0, y: -12, duration: 0.2, ease: "power2.inOut" },
                  at + 0.8
                );
            }
          });
        }, sectionRef);

        refreshProductScroll();
        window.addEventListener("load", refreshProductScroll, { once: true });
        window.addEventListener("resize", refreshProductScroll);

        return () => context.revert();
      });

        media.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        const context = gsap.context(() => {
          const visualItems = visualRefs.current.filter(Boolean);

          gsap.set(visualItems, {
            autoAlpha: 0,
            scale: 0.9,
            y: 36,
            filter: "blur(14px)",
          });
          gsap.set(visualItems[0], {
            autoAlpha: 1,
            scale: 1,
            y: 0,
            filter: "blur(0px)",
          });

          const timeline = gsap.timeline({
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top top",
              end: `+=${products.length * 680}`,
              pin: true,
              scrub: 0.75,
              invalidateOnRefresh: true,
              onUpdate: ({ progress }) => {
                const next = Math.min(products.length - 1, Math.floor(progress * products.length));
                if (activeRef.current !== next) {
                  activeRef.current = next;
                  setActive(next);
                }
                gsap.set(progressRef.current, { scaleY: progress });
              },
            },
          });

          products.forEach((product, index) => {
            const at = index * 1.1;

            timeline
              .to(
                visualRefs.current[index],
                {
                  autoAlpha: 1,
                  scale: 1,
                  y: 0,
                  filter: "blur(0px)",
                  duration: 0.42,
                  ease: "power2.out",
                },
                at
              )
              .to(
                visualRefs.current[index],
                { scale: 1.045, y: -18, duration: 0.62, ease: "none" },
                at + 0.34
              );

            if (index < products.length - 1) {
              timeline.to(
                visualRefs.current[index],
                {
                  autoAlpha: 0,
                  scale: 1.1,
                  y: -46,
                  filter: "blur(14px)",
                  duration: 0.3,
                },
                at + 0.84
              );
            }
          });
        }, sectionRef);

        refreshProductScroll();
        window.addEventListener("load", refreshProductScroll, { once: true });
        window.addEventListener("resize", refreshProductScroll);

        return () => context.revert();
        });
      } catch {
        if (!cancelled) setAnimationFailed(true);
      }
    };

    setup();

    // Encerra timelines e ScrollTriggers quando o breakpoint ou a pagina muda.
    return () => {
      cancelled = true;
      if (refreshFrame) window.cancelAnimationFrame(refreshFrame);
      if (refreshProductScroll) {
        window.removeEventListener("load", refreshProductScroll);
        window.removeEventListener("resize", refreshProductScroll);
      }
      media?.revert();
    };
  }, [isFullMode]);

  const activeProduct = products[active];
  const activeMobileProduct = products[activeMobile];

  if (ready && (mode !== "full" || animationFailed)) {
    return <CompatibilityProductExperience fallback={mode === "fallback"} />;
  }

  return (
    <section id="produtos" ref={sectionRef} className="relative overflow-hidden bg-[#050b14]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_36%,rgba(212,43,43,0.12),transparent_29%),radial-gradient(circle_at_52%_72%,rgba(48,107,180,0.13),transparent_38%),linear-gradient(180deg,#0A1628_0%,#050b14_100%)]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(90deg,rgba(255,255,255,0.09)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:86px_86px]" />
      <div data-mobile-gradient="bottom" aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-32 bg-gradient-to-b from-transparent via-[#050b14]/76 to-[#050b14] lg:hidden" />

      <div className="relative z-10 flex min-h-[100svh] flex-col px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-12 motion-reduce:hidden sm:px-6 sm:pt-14 lg:hidden [@media(max-height:700px)]:pt-9">
        <header className="mx-auto w-full max-w-3xl">
          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] tracking-[0.34em] text-imesul-red">
              SHOWROOM IMESUL
            </span>
            <span className="font-mono text-[10px] tracking-[0.22em] text-imesul-steel/50">
              {activeMobileProduct.number}/{String(products.length).padStart(2, "0")}
            </span>
          </div>
          <h2 className="mt-4 max-w-2xl font-display text-[clamp(1.9rem,9vw,3.2rem)] leading-[0.92] text-white sm:text-[clamp(2.2rem,8vw,3.8rem)] [@media(max-height:700px)]:text-[clamp(1.65rem,8vw,2.45rem)]">
            SOLUÇÕES PARA QUEM CONSTRÓI E TRANSFORMA
          </h2>
          <p className="mt-3 max-w-xl text-xs leading-5 text-imesul-steel-light/68 sm:text-sm sm:leading-6 [@media(max-height:700px)]:hidden">
            Conheça as principais linhas da IMESUL e encontre o material adequado para sua obra,
            indústria ou serralheria.
          </p>
        </header>

        <div className="relative mx-auto mt-4 flex min-h-0 w-full max-w-3xl flex-1 flex-col justify-center gap-3 [@media(max-height:700px)]:mt-3 [@media(max-height:700px)]:gap-2 [@media(max-height:480px)]:grid [@media(max-height:480px)]:grid-cols-[0.82fr_1.18fr] [@media(max-height:480px)]:items-center">
          <div className="relative h-[clamp(9rem,28svh,15rem)] overflow-hidden rounded-[16px] border border-white/10 bg-[radial-gradient(circle_at_62%_44%,rgba(212,43,43,0.12),transparent_38%),linear-gradient(145deg,#101f31,#07101c)] shadow-[0_20px_58px_rgba(0,0,0,0.3)] [@media(max-height:700px)]:h-[clamp(6.75rem,21svh,8.5rem)] [@media(max-height:480px)]:h-[clamp(8rem,62svh,13rem)]">
            {products.map((product, index) => (
              <div
                key={product.id}
                ref={(element) => {
                  mobileVisualRefs.current[index] = element;
                }}
                className={`absolute inset-0 flex items-center justify-center ${
                  index === 0 ? "opacity-100" : "opacity-0"
                }`}
              >
                <ProductImage product={product} compact />
              </div>
            ))}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#07101c] to-transparent" />
          </div>

          <div className="relative z-10 h-[clamp(17.5rem,42svh,23rem)] [@media(max-height:700px)]:h-[clamp(15.5rem,45svh,18rem)] [@media(max-height:480px)]:h-[clamp(12.5rem,72svh,16rem)]">
            {products.map((product, index) => (
              <article
                key={product.id}
                ref={(element) => {
                  mobileInfoRefs.current[index] = element;
                }}
                aria-hidden={index !== activeMobile}
                className={`absolute inset-x-0 top-0 rounded-[14px] border border-white/10 bg-[#07111f]/88 p-4 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur-sm sm:p-5 ${
                  index === 0 ? "opacity-100" : "opacity-0"
                }`}
              >
                <ProductInformation product={product} compact />
              </article>
            ))}
          </div>

          <div data-mobile-progress className="relative z-0 mt-3 h-px w-full overflow-hidden bg-white/10 [@media(max-height:700px)]:mt-2 [@media(max-height:480px)]:col-span-2">
            <span ref={mobileProgressRef} className="block h-full origin-left scale-x-0 bg-imesul-red" />
          </div>
        </div>
      </div>

      <div className="relative z-10 hidden px-5 pb-20 pt-28 motion-reduce:block sm:px-8 sm:pb-24 sm:pt-32">
        <header className="mx-auto max-w-5xl">
          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] tracking-[0.34em] text-imesul-red">
              SHOWROOM IMESUL
            </span>
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-[1.1fr_0.9fr] md:items-end">
            <h2 className="max-w-3xl font-display text-5xl leading-[0.94] text-white sm:text-6xl">
              SOLUÇÕES PARA QUEM CONSTRÓI E TRANSFORMA
            </h2>
            <p className="max-w-xl text-sm leading-7 text-imesul-steel-light/70 sm:text-base">
              Conheça as principais linhas da IMESUL e encontre o material adequado para sua obra,
              indústria ou serralheria.
            </p>
          </div>
        </header>

        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-5 md:grid-cols-2">
          {products.map((product, index) => (
            <article
              key={product.id}
              className="group flex min-h-full flex-col overflow-hidden border border-white/10 bg-[#091524]/92 shadow-[0_22px_60px_rgba(0,0,0,0.24)] transition duration-300 hover:-translate-y-1 hover:border-imesul-red/45 hover:shadow-[0_28px_72px_rgba(0,0,0,0.34)]"
            >
              <div className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_62%_48%,rgba(212,43,43,0.12),transparent_38%),linear-gradient(145deg,#101f31,#07101c)]">
                <span className="absolute left-5 top-5 z-10 font-mono text-[9px] tracking-[0.2em] text-white/35">
                  LINHA {product.number}
                </span>
                <ProductImage product={product} compact />
              </div>
              <div className="flex flex-1 flex-col p-6 sm:p-7">
                <ProductInformation product={product} compact />
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="relative z-10 hidden h-screen lg:block lg:motion-reduce:hidden">
        <div className="mx-auto grid h-full max-w-[1600px] grid-cols-[0.94fr_1.06fr] items-start gap-12 px-12 pb-8 pt-24 xl:px-16">
          <div className="relative z-20 min-h-[640px] xl:min-h-[690px]">
            <div className="mb-7 flex items-center gap-4">
              <span className="font-mono text-[10px] tracking-[0.36em] text-imesul-red">
                SHOWROOM IMESUL
              </span>
              <span className="font-mono text-[10px] tracking-[0.23em] text-imesul-steel/50">
                {activeProduct.number}/{String(products.length).padStart(2, "0")}
              </span>
            </div>

            {products.map((product, index) => (
              <article
                key={product.id}
                aria-hidden={index !== active}
                className={`absolute left-0 top-14 w-full max-w-[650px] border-l-2 border-imesul-red bg-[#07111f]/78 px-8 py-7 shadow-[0_30px_90px_rgba(0,0,0,0.25)] backdrop-blur-sm transition-[opacity,transform] duration-500 ${
                  index === active
                    ? "pointer-events-auto translate-y-0 opacity-100"
                    : "pointer-events-none translate-y-6 opacity-0"
                }`}
              >
                <ProductInformation product={product} />
              </article>
            ))}
          </div>

          <div className="relative h-[78vh] min-h-[540px]">
            <div className="absolute inset-[7%] rounded-full bg-imesul-red/[0.055] blur-[90px]" />
            <div className="absolute inset-x-[5%] bottom-[9%] h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            {products.map((product, index) => (
              // Mantem apenas um produto visivel antes do GSAP inicializar para evitar sobreposicao no build publicado.
              <div
                key={product.id}
                ref={(element) => {
                  visualRefs.current[index] = element;
                }}
                className={`absolute inset-0 flex items-center justify-center will-change-transform ${
                  index === active ? "visible opacity-100" : "invisible opacity-0"
                }`}
              >
                <ProductImage product={product} />
              </div>
            ))}
          </div>
        </div>

        <div className="absolute right-5 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-center gap-4 xl:flex">
          <span className="max-h-44 overflow-hidden font-mono text-[9px] tracking-[0.2em] text-imesul-steel/45 [writing-mode:vertical-rl]">
            {activeProduct.name}
          </span>
          <div className="relative h-52 w-px bg-white/10">
            <div
              ref={progressRef}
              className="absolute left-0 top-0 h-full w-px origin-top scale-y-0 bg-imesul-red"
            />
          </div>
          <div className="flex flex-col gap-2">
            {products.map((product, index) => (
              <span
                key={product.id}
                className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                  index === active ? "scale-150 bg-imesul-red" : "bg-white/20"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
