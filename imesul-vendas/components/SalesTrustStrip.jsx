import { Building2, Clock3, Headphones, Ruler } from "lucide-react";

const trustItems = [
  {
    icon: Clock3,
    text: <>Mais de 45 anos de atuação no mercado</>,
  },
  {
    icon: Building2,
    text: <>Unidades em Dourados Matriz, Dourados Centro e Campo Grande</>,
  },
  {
    icon: Headphones,
    text: <>Atendimento <span className="imesul-brand-word">IMESUL</span> para construção, serralheria, indústria e campo</>,
  },
  {
    icon: Ruler,
    text: <>Medidas, estoque e valores confirmados pela equipe <span className="imesul-brand-word">IMESUL</span></>,
  },
];

// Faixa institucional curta antes da orientação comercial e sem interferir no fluxo.
export default function SalesTrustStrip() {
  return (
    <section className="relative border-y border-white/[0.08] bg-[#050d19]/92">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_30%,rgba(212,43,43,0.08),transparent_28%),radial-gradient(circle_at_88%_58%,rgba(42,92,151,0.1),transparent_34%)]" />

      <div className="relative z-20 mx-auto grid max-w-[1480px] gap-8 px-6 py-10 sm:px-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-center lg:px-12">
        <div data-scroll-reveal>
          <h2 className="font-display text-[clamp(2.25rem,3.6vw,4.25rem)] leading-[0.92] text-white">
            Compra de <span className="steel-word">aço</span> com atendimento de verdade
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {trustItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <article
                key={index}
                data-scroll-reveal
                style={{ "--reveal-delay": `${index * 45}ms` }}
                className="flex min-h-16 items-center gap-3 rounded-[8px] border border-white/[0.08] bg-white/[0.035] px-4 py-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] border border-imesul-red/30 bg-imesul-red/[0.08] text-imesul-red">
                  <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <p className="text-sm leading-5 text-imesul-steel-light/76">
                  {item.text}
                </p>
              </article>
            );
          })}
        </div>

      </div>
    </section>
  );
}

