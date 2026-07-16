"use client";

// Showroom institucional dos produtos principais.
// Usa dados de products.js e direciona o cliente para a area de vendas.
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { products, salesSiteUrl } from "../data/products";

// Mantem o tratamento visual das imagens consistente nos cards e no palco desktop.
function ProductImage({ product, compact = false }) {
  const isAccessoryShowroom = product.id === "acessorios-serralheria";

  return (
    <div
      className={`relative flex items-center justify-center ${
        compact ? "h-56 w-full sm:h-64" : "h-full w-full translate-x-[2%]"
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
  return (
    <a
      href={salesSiteUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`group/link inline-flex min-h-12 items-center justify-between gap-5 border border-imesul-red bg-imesul-red font-condensed font-bold text-white uppercase transition duration-300 hover:-translate-y-0.5 hover:bg-[#ef3434] hover:shadow-[0_16px_34px_rgba(212,43,43,0.25)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-imesul-red ${
        compact
          ? "mt-auto w-full px-5 py-3 text-xs tracking-[0.12em]"
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
              ? "text-3xl sm:text-[2.65rem]"
              : "text-[2.65rem] sm:text-5xl"
            : longTitle
              ? "text-[3.4rem] xl:text-[4rem]"
              : "text-[4.25rem] xl:text-[5rem]"
        }`}
      >
        {product.name}
      </h3>

      <p className="mt-3 font-condensed text-xs font-semibold tracking-[0.17em] text-imesul-red uppercase sm:text-sm">
        {product.subtitle}
      </p>
      <p className="mt-4 max-w-[560px] text-sm leading-6 text-imesul-steel-light/75 sm:text-[15px] sm:leading-7">
        {product.description}
      </p>

      <dl className={`mt-6 grid gap-5 border-t border-white/10 pt-5 ${compact ? "mb-7" : "max-w-[570px] sm:grid-cols-[1.08fr_0.92fr]"}`}>
        <div>
          <dt className="font-mono text-[9px] tracking-[0.24em] text-imesul-steel/55">
            PRINCIPAIS VARIAÇÕES
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

        <div className={compact ? "border-t border-white/10 pt-5" : "border-l border-white/10 pl-5"}>
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

// Exibe cards no mobile e um showroom fixado, controlado por scroll, no desktop.
export default function ProductScrollExperience() {
  const sectionRef = useRef(null);
  const visualRefs = useRef([]);
  const progressRef = useRef(null);
  const [active, setActive] = useState(0);

  // No desktop, transforma o progresso da secao em trocas de produto com foco e escala.
  // O matchMedia desativa o efeito no mobile e respeita movimento reduzido.
  useEffect(() => {
    let media;
    let cancelled = false;

    const setup = async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      media = gsap.matchMedia();

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
                setActive(next);
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

        return () => context.revert();
      });
    };

    setup();

    // Encerra timelines e ScrollTriggers quando o breakpoint ou a pagina muda.
    return () => {
      cancelled = true;
      media?.revert();
    };
  }, []);

  const activeProduct = products[active];

  return (
    <section id="produtos" ref={sectionRef} className="relative overflow-hidden bg-[#050b14]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_36%,rgba(212,43,43,0.12),transparent_29%),radial-gradient(circle_at_52%_72%,rgba(48,107,180,0.13),transparent_38%),linear-gradient(180deg,#0A1628_0%,#050b14_100%)]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(90deg,rgba(255,255,255,0.09)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:86px_86px]" />

      <div className="relative z-10 px-5 pb-20 pt-28 sm:px-8 sm:pb-24 sm:pt-32 lg:hidden">
        <header className="mx-auto max-w-5xl">
          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] tracking-[0.34em] text-imesul-red">
              SHOWROOM IMESUL
            </span>
            <span className="h-px w-14 bg-imesul-red" />
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

      <div className="relative z-10 hidden h-screen lg:block">
        <div className="mx-auto grid h-full max-w-[1600px] grid-cols-[0.94fr_1.06fr] items-start gap-12 px-12 pb-8 pt-24 xl:px-16">
          <div className="relative z-20 min-h-[640px] xl:min-h-[690px]">
            <div className="mb-7 flex items-center gap-4">
              <span className="font-mono text-[10px] tracking-[0.36em] text-imesul-red">
                SHOWROOM IMESUL
              </span>
              <span className="h-px w-14 bg-imesul-red" />
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
