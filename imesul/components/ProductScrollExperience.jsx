"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { products } from "../data/products";

const productImageAssets = {
  tubos: {
    src: "/products/tubos-removebg-preview.png",
    alt: "",
    width: 1536,
    height: 1024,
  },
  chapas: {
    src: "/products/chapas.png",
    alt: "",
    width: 1536,
    height: 1024,
  },
  telhas: {
    src: "/products/telhas.png",
    alt: "",
    width: 1536,
    height: 1024,
  },
  perfis: {
    src: "/products/perfis.png",
    alt: "",
    width: 1536,
    height: 1024,
  },
  cantoneiras: {
    src: "/products/cantoneiras.png",
    alt: "",
    width: 1536,
    height: 1024,
  },
  metalon: {
    src: "/products/metalon.png",
    alt: "",
    width: 1536,
    height: 1024,
  },
  bobininhas: {
    src: "/products/bobinas.png",
    alt: "",
    width: 1536,
    height: 1024,
  },
  "solventes-acessorios": {
    src: "/products/solventes-acessorios.png",
    alt: "",
    width: 1536,
    height: 1024,
  },
};

function ProductImageAsset({ asset }) {
  return (
    <div className="relative flex h-[118%] w-[118%] translate-x-[5%] items-center justify-center" aria-hidden="true">
      <Image
        src={asset.src}
        alt={asset.alt}
        width={asset.width}
        height={asset.height}
        priority
        className="h-full max-h-[740px] w-full max-w-[1160px] object-contain"
        draggable="false"
        style={{
          filter:
            "drop-shadow(0 34px 54px rgba(0,0,0,0.42)) drop-shadow(0 0 18px rgba(238,246,255,0.22)) drop-shadow(0 0 34px rgba(180,205,225,0.12))",
        }}
      />
    </div>
  );
}

function SteelProduct({ id }) {
  const imageAsset = productImageAssets[id];

  if (imageAsset) return <ProductImageAsset asset={imageAsset} />;

  const common = {
    fill: "url(#steel)",
    stroke: "rgba(255,255,255,0.28)",
    strokeWidth: 2,
  };

  return (
    <svg viewBox="0 0 720 560" className="h-full w-full overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id="steel" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="18%" stopColor="#7c91a3" />
          <stop offset="46%" stopColor="#d7e4ee" />
          <stop offset="72%" stopColor="#34465b" />
          <stop offset="100%" stopColor="#f8fdff" />
        </linearGradient>
        <linearGradient id="redEdge" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#D42B2B" />
          <stop offset="100%" stopColor="#FF5C5C" />
        </linearGradient>
        <filter id="metalGlow">
          <feGaussianBlur stdDeviation="10" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <ellipse cx="374" cy="430" rx="250" ry="54" fill="rgba(0,0,0,0.42)" />
      <ellipse cx="390" cy="298" rx="270" ry="160" fill="rgba(212,43,43,0.13)" filter="url(#metalGlow)" />

      {id === "tubos" && (
        <g transform="translate(82 90) rotate(-10 300 220)">
          {[0, 54, 108, 162].map((y, i) => (
            <g key={y} transform={`translate(${i * 34} ${y})`}>
              <rect x="76" y="74" width="470" height="66" rx="33" {...common} />
              <ellipse cx="77" cy="107" rx="34" ry="33" fill="#dce9f1" stroke="rgba(255,255,255,0.35)" />
              <ellipse cx="77" cy="107" rx="20" ry="19" fill="#07101f" />
              <path d="M118 86h390" stroke="white" strokeOpacity="0.38" strokeWidth="4" />
            </g>
          ))}
        </g>
      )}

      {id === "chapas" && (
        <g transform="translate(138 128) rotate(-14 260 190)">
          {[0, 28, 56, 84].map((o) => (
            <path key={o} d={`M${o} 0h386l72 72v210H72L${o} 210z`} {...common} opacity={0.5 + o / 130} />
          ))}
          <path d="M86 44h310M118 92h290M145 140h240" stroke="#fff" strokeOpacity="0.24" strokeWidth="3" />
        </g>
      )}

      {id === "telhas" && (
        <g transform="translate(86 145) rotate(-8 300 180)">
          <path d="M40 142C78 70 118 70 156 142s78 72 116 0 78-72 116 0 78 72 116 0 78-72 116 0v160H40z" {...common} />
          <path d="M40 142C78 70 118 70 156 142s78 72 116 0 78-72 116 0 78 72 116 0 78-72 116 0" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="5" />
          <path d="M40 244h580" stroke="#07101f" strokeOpacity="0.42" strokeWidth="6" />
        </g>
      )}

      {id === "perfis" && (
        <g transform="translate(150 86) rotate(12 250 240)">
          <path d="M40 70h450v82H314v250h176v82H40v-82h176V152H40z" {...common} />
          <path d="M72 98h386M226 170v214M74 430h384" stroke="#fff" strokeOpacity="0.34" strokeWidth="5" />
        </g>
      )}

      {id === "cantoneiras" && (
        <g transform="translate(150 92) rotate(-18 270 240)">
          <path d="M92 52h128v300h310v126H92z" {...common} />
          <path d="M134 94v340h352" fill="none" stroke="#07101f" strokeOpacity="0.34" strokeWidth="18" />
          <path d="M111 70h86M113 454h374" stroke="#fff" strokeOpacity="0.35" strokeWidth="4" />
        </g>
      )}

      {id === "metalon" && (
        <g transform="translate(118 105) rotate(-10 280 220)">
          {[0, 74, 148].map((y, i) => (
            <g key={y} transform={`translate(${i * 44} ${y})`}>
              <rect x="70" y="52" width="430" height="64" rx="8" {...common} />
              <rect x="88" y="68" width="42" height="32" fill="#07101f" opacity="0.82" />
              <path d="M148 66h315" stroke="white" strokeOpacity="0.36" strokeWidth="4" />
            </g>
          ))}
        </g>
      )}

      {id === "bobininhas" && (
        <g transform="translate(126 74) rotate(-7 280 250)">
          <ellipse cx="308" cy="260" rx="210" ry="170" {...common} />
          <ellipse cx="308" cy="260" rx="124" ry="102" fill="#9fb0bf" stroke="rgba(255,255,255,0.42)" strokeWidth="2" />
          <ellipse cx="308" cy="260" rx="62" ry="50" fill="#07101f" />
          <path d="M190 124c142 38 236 128 245 274" fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth="10" />
          <path d="M166 414h306" stroke="url(#redEdge)" strokeWidth="5" />
        </g>
      )}

      {id === "solventes-acessorios" && (
        <g transform="translate(150 90) rotate(-8 260 230)">
          <rect x="150" y="80" width="176" height="300" rx="18" {...common} />
          <rect x="174" y="128" width="128" height="90" fill="url(#redEdge)" opacity="0.9" />
          <rect x="184" y="44" width="108" height="48" rx="8" fill="#cbd9e3" />
          <path d="M372 154h92l42 58v178H372z" {...common} opacity="0.82" />
          <path d="M186 256h104M392 228h76" stroke="#07101f" strokeOpacity="0.35" strokeWidth="10" />
        </g>
      )}

      <path d="M96 500h500" stroke="url(#redEdge)" strokeWidth="2" strokeDasharray="28 18" opacity="0.78" />
    </svg>
  );
}

export default function ProductScrollExperience() {
  const sectionRef = useRef(null);
  const textRefs = useRef([]);
  const visualRefs = useRef([]);
  const progressRef = useRef(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      gsap.set(textRefs.current, { autoAlpha: 0, y: 42 });
      gsap.set(visualRefs.current, {
        autoAlpha: 0,
        scale: 0.78,
        y: 50,
        rotation: -8,
        filter: "blur(18px)",
      });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: `+=${products.length * 760}`,
          pin: true,
          scrub: 0.8,
          onUpdate: (self) => {
            const next = Math.min(products.length - 1, Math.floor(self.progress * products.length));
            setActive(next);
            gsap.set(progressRef.current, { scaleY: self.progress });
          },
        },
      });

      products.forEach((product, index) => {
        const at = index * 1.15;
        const direction = index % 2 === 0 ? -1 : 1;

        tl.to(textRefs.current[index], { autoAlpha: 1, y: 0, duration: 0.34, ease: "power2.out" }, at)
          .to(
            visualRefs.current[index],
            {
              autoAlpha: 1,
              scale: 1,
              y: 0,
              rotation: direction * 1.8,
              filter: "blur(0px)",
              duration: 0.45,
              ease: "power2.out",
            },
            at
          )
          .to(
            visualRefs.current[index],
            {
              scale: 1.08,
              y: -28,
              rotation: direction * -3,
              duration: 0.7,
              ease: "none",
            },
            at + 0.35
          );

        if (index < products.length - 1) {
          tl.to(textRefs.current[index], { autoAlpha: 0, y: -34, duration: 0.28 }, at + 0.88)
            .to(
              visualRefs.current[index],
              {
                autoAlpha: 0,
                scale: 1.18,
                y: -70,
                rotation: direction * 7,
                filter: "blur(18px)",
                duration: 0.32,
              },
              at + 0.88
            );
        }
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const activeProduct = products[active];

  return (
    <section id="produtos" ref={sectionRef} className="relative h-screen overflow-hidden bg-[#050b14]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_45%,rgba(212,43,43,0.16),transparent_30%),radial-gradient(circle_at_52%_70%,rgba(48,107,180,0.16),transparent_38%),linear-gradient(180deg,#0A1628_0%,#050b14_100%)]" />
      <div className="absolute inset-0 opacity-[0.1] [background-image:linear-gradient(90deg,rgba(255,255,255,0.09)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:86px_86px]" />

      <div className="relative z-10 mx-auto grid h-screen max-w-[1600px] grid-cols-1 items-center gap-8 px-6 py-24 sm:px-8 lg:grid-cols-[0.78fr_1.22fr] lg:px-16">
        <div className="relative z-20 min-h-[360px] lg:min-h-[520px]">
          <div className="mb-8 flex items-center gap-4">
            <span className="font-mono text-[10px] tracking-[0.42em] text-imesul-red">
              PRODUTOS
            </span>
            <span className="h-px w-14 bg-imesul-red" />
            <span className="font-mono text-[10px] tracking-[0.28em] text-imesul-steel/50">
              {activeProduct.number}/08
            </span>
          </div>

          {products.map((product, index) => (
            <article
              key={product.id}
              ref={(el) => (textRefs.current[index] = el)}
              className="absolute left-0 top-16 max-w-[560px]"
            >
              <p className="font-mono text-[10px] tracking-[0.4em] text-imesul-red">
                {product.number} / {product.tag}
              </p>
              <h2
                className="mt-5 font-display leading-[0.9] text-white"
                style={{ fontSize: "clamp(4rem, 10vw, 9.2rem)" }}
              >
                {product.name}
              </h2>
              <p className="mt-4 font-condensed text-sm font-semibold tracking-[0.3em] text-imesul-red uppercase">
                {product.subtitle}
              </p>
              <p className="mt-8 max-w-[500px] text-base leading-relaxed text-imesul-steel-light/74 lg:text-lg">
                {product.description}
              </p>
              <div className="mt-8 grid grid-cols-2 gap-2">
                {product.specs.map((spec) => (
                  <span
                    key={spec}
                    className="border border-white/10 bg-white/[0.025] px-3 py-2 font-condensed text-xs font-medium tracking-[0.14em] text-imesul-steel"
                  >
                    {spec}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="relative h-[46vh] min-h-[300px] lg:h-[78vh]">
          <div className="absolute inset-0 rounded-full bg-imesul-red/6 blur-[80px]" />
          {products.map((product, index) => (
            <div
              key={product.id}
              ref={(el) => (visualRefs.current[index] = el)}
              className="absolute inset-0 flex items-center justify-center will-change-transform"
            >
              <SteelProduct id={product.id} />
            </div>
          ))}
        </div>
      </div>

      <div className="absolute right-5 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-center gap-4 lg:flex">
        <span className="font-mono text-[10px] tracking-[0.28em] text-imesul-steel/45 [writing-mode:vertical-rl]">
          {activeProduct.name}
        </span>
        <div className="relative h-56 w-px bg-white/10">
          <div ref={progressRef} className="absolute left-0 top-0 h-full w-px origin-top scale-y-0 bg-imesul-red" />
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
    </section>
  );
}
