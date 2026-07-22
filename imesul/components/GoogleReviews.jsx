"use client";

// Prova social antes do CTA final. Inspirado visualmente em paineis de depoimentos com colunas
// verticais em movimento continuo (estilo "testimonial-v2"), mas reescrito do zero para a IMESUL:
// sem shadcn, sem TypeScript, sem fotos externas. Enquanto nao existem avaliacoes reais do Google
// integradas ao projeto, os dados vêm de imesul/data/googleReviews.js com placeholders seguros e
// texto neutro (ver comentario no topo daquele arquivo) — nenhum nome, nota ou foto é inventado.
// Desktop: 3 colunas com marquee vertical (framer-motion, y de 0% a -50% em loop, cada card
// duplicado uma vez para o loop ficar sem emenda). Mobile/tablet: carrossel horizontal nativo
// (scroll-snap), sem JS de animacao. prefers-reduced-motion: colunas viram grade estatica, sem
// duplicar cards e sem transform em loop.
import { m as motion, useReducedMotion } from "framer-motion";
import { reviews } from "../data/googleReviews";
import { whatsapp } from "../data/products";

const COLUMN_DEFS = [
  { rotate: 0, duration: 26 },
  { rotate: 2, duration: 32 },
  { rotate: 4, duration: 29 },
];

// Gira o array para cada coluna mostrar os cards em outra ordem, sem precisar de mais dados.
function rotate(list, n) {
  if (list.length === 0) return list;
  const offset = n % list.length;
  return [...list.slice(offset), ...list.slice(0, offset)];
}

function QuoteIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M7.17 6C4.87 8.1 3.7 10.62 3.7 13.5c0 2.2.76 3.9 2.28 5.1l1.44-1.9c-.9-.8-1.35-1.75-1.35-2.85 0-.45.1-.95.3-1.5h2.6V6H7.17zm9.13 0c-2.3 2.1-3.47 4.62-3.47 7.5 0 2.2.76 3.9 2.28 5.1l1.44-1.9c-.9-.8-1.35-1.75-1.35-2.85 0-.45.1-.95.3-1.5h2.6V6h-2.8z" />
    </svg>
  );
}

function ClientIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 19.2c1.2-3.4 4-5.2 7-5.2s5.8 1.8 7 5.2" />
    </svg>
  );
}

function StarIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
      <path
        d="M12 3.6l2.55 5.36 5.75.68-4.28 4.02 1.13 5.74L12 16.6l-5.15 2.8 1.13-5.74-4.28-4.02 5.75-.68z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// So renderiza estrelas quando existe uma nota real (rating numerico); nunca inventa avaliacao.
function RatingRow({ rating }) {
  if (typeof rating !== "number") {
    return (
      <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-imesul-steel-light/40">
        Avaliação em breve
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1 text-imesul-red" aria-label={`Avaliação: ${rating} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((position) => (
        <StarIcon key={position} filled={position <= rating} />
      ))}
    </div>
  );
}

function ReviewCard({ review, hiddenFromScreenReaders }) {
  return (
    <div
      aria-hidden={hiddenFromScreenReaders || undefined}
      className="min-h-[172px] w-full flex-shrink-0 rounded-[14px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)] transition-colors duration-300 lg:hover:border-imesul-red/25 lg:hover:shadow-[0_0_44px_rgba(212,43,43,0.12)]"
    >
      <QuoteIcon className="text-imesul-red/70" />
      <p
        className="mt-3 text-sm leading-relaxed text-imesul-steel-light/85"
        style={{
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {review.detail}
      </p>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/5 pt-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-white/15 text-imesul-steel-light/70">
            <ClientIcon />
          </span>
          <span className="font-condensed text-sm font-semibold tracking-wide text-white">
            {review.name}
          </span>
        </div>
        <RatingRow rating={review.rating} />
      </div>
    </div>
  );
}

function MarqueeColumn({ items, duration, offsetClassName, reduceMotion }) {
  if (reduceMotion) {
    return (
      <div className={`flex flex-col gap-6 ${offsetClassName || ""}`}>
        {items.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>
    );
  }

  const loopItems = [...items, ...items];

  return (
    <div
      className={`relative h-[560px] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_88%,transparent)] [-webkit-mask-image:linear-gradient(to_bottom,transparent,black_10%,black_88%,transparent)] ${
        offsetClassName || ""
      }`}
    >
      <motion.div
        className="flex flex-col gap-6"
        animate={{ y: ["0%", "-50%"] }}
        transition={{ duration, repeat: Infinity, ease: "linear" }}
      >
        {loopItems.map((review, i) => (
          <ReviewCard
            key={`${review.id}-${i}`}
            review={review}
            hiddenFromScreenReaders={i >= items.length}
          />
        ))}
      </motion.div>
    </div>
  );
}

export default function GoogleReviews() {
  const shouldReduceMotion = useReducedMotion();
  const waUrl = `https://wa.me/${whatsapp.number}?text=${encodeURIComponent(whatsapp.message)}`;
  const hasReviews = reviews.length > 0;

  return (
    <section className="relative overflow-hidden bg-[#050b14] py-24 lg:py-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(212,43,43,0.08),transparent_45%),linear-gradient(180deg,#050b14_0%,#07101c_100%)]" />
      <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(90deg,rgba(255,255,255,0.09)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:86px_86px]" />

      <div className="relative z-10 mx-auto max-w-[1400px] px-6 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center text-center"
        >
          <div className="flex items-center gap-4">
            <span className="h-px w-10 bg-imesul-red" />
            <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-imesul-red">
              Avaliações de clientes
            </span>
            <span className="h-px w-10 bg-imesul-red" />
          </div>

          <h2
            className="mt-6 font-display uppercase leading-[0.95] text-white [font-size:clamp(2.2rem,5vw,4.2rem)]"
          >
            Quem compra na <span className="text-imesul-red text-glow-red">Imesul</span> recomenda
          </h2>

          <p className="mt-5 max-w-xl text-sm leading-relaxed text-imesul-steel-light/72 sm:text-base">
            Atendimento, variedade e estrutura para entregar materiais com confiança em Mato
            Grosso do Sul.
          </p>
        </motion.div>

        <div className="mt-14">
          {!hasReviews ? (
            <div className="mx-auto max-w-md rounded-[14px] border border-white/10 bg-white/[0.03] px-8 py-12 text-center">
              <p className="font-condensed text-sm uppercase tracking-[0.18em] text-imesul-steel-light/60">
                Em breve, avaliações reais de clientes.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop: 3 colunas com marquee vertical. */}
              <div className="hidden gap-6 lg:grid lg:grid-cols-3">
                {COLUMN_DEFS.map((column, i) => (
                  <MarqueeColumn
                    key={column.rotate}
                    items={rotate(reviews, column.rotate)}
                    duration={column.duration}
                    offsetClassName={i === 1 ? "lg:mt-10" : ""}
                    reduceMotion={shouldReduceMotion === true}
                  />
                ))}
              </div>

              {/* Mobile/tablet: carrossel horizontal nativo, sem JS de animacao. */}
              <div className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 lg:hidden">
                {reviews.map((review) => (
                  <div key={review.id} className="w-[82vw] max-w-sm flex-shrink-0 snap-center">
                    <ReviewCard review={review} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-14 flex justify-center"
        >
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 border-b border-imesul-red/40 pb-1 font-condensed text-sm font-semibold uppercase tracking-[0.14em] text-imesul-steel-light transition-colors duration-300 hover:border-imesul-red hover:text-white"
          >
            Fale com a equipe e solicite seu orçamento
            <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
