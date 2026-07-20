// Secao de apoio comercial abaixo do catalogo.
// Explica o pre-orcamento e oferece contato com a equipe pelo WhatsApp.
import Image from "next/image";
import {
  ClipboardList,
  Headphones,
  Layers3,
  MapPin,
  MessageCircle,
  PackageCheck,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { trackLocalEvent } from "../lib/localAnalytics";

const howItWorks = [
  {
    number: "1",
    icon: ClipboardList,
    title: "CONTE SEU PROJETO",
    description: "Informe o que está construindo ou qual material precisa.",
  },
  {
    number: "2",
    icon: PackageCheck,
    title: "VEJA MATERIAIS INDICADOS",
    description: "Escolha os itens indicados e avance para montar o pedido.",
  },
  {
    number: "3",
    icon: MessageCircle,
    title: "ENVIE NO WHATSAPP",
    description: "Medidas, estoque e valores são confirmados no atendimento.",
  },
];

const benefits = [
  {
    icon: Headphones,
    title: "Atendimento técnico",
    description: "Equipe preparada para ajudar na escolha dos materiais do pedido.",
  },
  {
    icon: Layers3,
    title: "Linha completa em aço",
    description: "Do básico ao específico para obra, serralheria e campo.",
  },
  {
    icon: MapPin,
    title: "Dourados e Campo Grande",
    description: "Dourados Matriz, Dourados Centro e Campo Grande.",
  },
  {
    icon: Timer,
    title: "Agilidade para orçamentos",
    description: "Envie a solicitação e continue o atendimento pelo WhatsApp.",
  },
  {
    icon: ShieldCheck,
    title: "+45 anos de experiência",
    description: "Atendimento para quem constrói, fabrica e trabalha com aço.",
  },
];

const whatsappUrl =
  "https://wa.me/556733125600?text=Ol%C3%A1%2C%20vim%20pela%20%C3%81rea%20de%20Vendas%20da%20IMESUL%20e%20preciso%20de%20ajuda%20de%20um%20especialista.";

// Complementa a home com orientacao comercial sem alterar os fluxos de orcamento.
export default function SalesGuidanceSection() {
  return (
    <section id="quote-steps" className="relative overflow-hidden border-t border-white/[0.08] bg-[#06101d]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(212,43,43,0.12),transparent_28%),radial-gradient(circle_at_82%_72%,rgba(43,94,151,0.16),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-imesul-red/50 to-transparent" />

      <div className="relative z-20 mx-auto max-w-[1480px] px-6 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28">
        <div data-scroll-reveal>
          <h2 className="font-display text-[clamp(2.8rem,5vw,5.4rem)] leading-[0.92] text-white">
            COMO FUNCIONA O PRÉ-ORÇAMENTO?
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-imesul-steel-light/72">
            Você monta sua solicitação em poucos passos. A equipe confirma medidas, estoque e valores pelo WhatsApp.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {howItWorks.map((item, index) => {
            const Icon = item.icon;
            return (
              <article
                key={item.number}
                data-scroll-reveal
                style={{ "--reveal-delay": `${index * 80}ms` }}
                className="group relative min-h-[158px] overflow-hidden rounded-[8px] border border-white/[0.1] bg-[#081625]/82 p-6 shadow-[0_18px_55px_rgba(0,0,0,0.18)] transition-all duration-300 hover:-translate-y-1 hover:border-imesul-red/45 hover:bg-[#0b1c30]/90"
              >
                <div className="flex items-start gap-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] bg-imesul-red font-mono text-sm font-bold text-white shadow-[0_10px_26px_rgba(212,43,43,0.24)]">
                    {item.number}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-condensed text-xl font-bold uppercase tracking-[0.08em] text-white">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-imesul-steel-light/68">
                      {item.description}
                    </p>
                  </div>
                  <Icon
                    size={35}
                    strokeWidth={1.5}
                    className="ml-auto hidden shrink-0 text-imesul-steel/50 transition-colors duration-300 group-hover:text-imesul-red sm:block"
                    aria-hidden="true"
                  />
                </div>
              </article>
            );
          })}
        </div>

        <div data-scroll-reveal className="mt-20">
          <h2 className="max-w-5xl font-display text-[clamp(3rem,5.7vw,6.2rem)] leading-[0.9] text-white">
            SOLUÇÕES PARA OBRA, SERRALHERIA, CAMPO E INDÚSTRIA
          </h2>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-[1fr_0.78fr]">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <article
                  key={benefit.title}
                  data-scroll-reveal
                  style={{ "--reveal-delay": `${index * 70}ms` }}
                  className="rounded-[8px] border border-white/[0.1] bg-white/[0.035] p-5 transition-all duration-300 hover:border-imesul-red/40 hover:bg-white/[0.055]"
                >
                  <Icon size={28} strokeWidth={1.6} className="text-imesul-red" aria-hidden="true" />
                  <h3 className="mt-5 font-condensed text-xl font-bold leading-tight text-white">
                    {benefit.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-imesul-steel-light/68">
                    {benefit.description}
                  </p>
                </article>
              );
            })}
          </div>

          <aside
            data-scroll-reveal
            style={{ "--reveal-delay": "160ms" }}
            className="group/help-card relative min-h-[360px] overflow-visible rounded-[8px] border border-imesul-red/25 bg-[linear-gradient(145deg,rgba(212,43,43,0.12),rgba(8,22,37,0.96)_42%)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] transition-all duration-500 hover:border-imesul-red/45 hover:shadow-[0_30px_90px_rgba(212,43,43,0.16)] sm:p-8"
          >
            <div className="relative z-10 max-w-[310px]">
              <span className="flex h-11 w-11 items-center justify-center rounded-[6px] border border-white/10 bg-white/[0.05] text-imesul-steel-light">
                <svg
                  width="23"
                  height="23"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M8.5 10.5a3.5 3.5 0 0 1 7 0v1.2a3.5 3.5 0 0 1-7 0v-1.2Z" />
                  <path d="M5.5 11.2a6.5 6.5 0 0 1 13 0" />
                  <path d="M5.5 11.2v2.1a1.7 1.7 0 0 0 1.7 1.7h.3v-4.2h-.3a1.7 1.7 0 0 0-1.7 1.7" />
                  <path d="M18.5 11.2v2.1a1.7 1.7 0 0 1-1.7 1.7h-.3v-4.2h.3a1.7 1.7 0 0 1 1.7 1.7" />
                  <path d="M14.8 15.4c-.6.5-1.6.8-2.8.8" />
                  <path d="M18.5 13.5v1.2c0 1.6-1.2 2.8-3.7 2.8" />
                  <path d="M7.2 20c.9-1.8 2.6-2.8 4.8-2.8s3.9 1 4.8 2.8" />
                </svg>
              </span>
              <h3 className="mt-6 font-display text-5xl leading-none text-white">
                Precisa de ajuda?
              </h3>
              <p className="mt-4 text-sm leading-6 text-imesul-steel-light/72">
                Não sabe qual medida pedir? Fale com a equipe IMESUL e envie sua dúvida pelo WhatsApp.
              </p>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackLocalEvent({
                  type: "whatsapp",
                  label: "Falar com a equipe",
                  section: "Precisa de ajuda",
                  detail: "Card do mascote",
                  isLoggedIn: false,
                })}
                className="mt-7 inline-flex min-h-12 items-center justify-center rounded-[8px] bg-imesul-red px-5 py-3 font-condensed text-xs font-bold uppercase tracking-[0.13em] text-white shadow-[0_14px_40px_rgba(212,43,43,0.24)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#ef3434] hover:shadow-[0_18px_52px_rgba(212,43,43,0.34)]"
              >
                FALAR COM A EQUIPE
              </a>
            </div>

            {/* Mascote e balao ficam no mesmo grupo para manter o alinhamento responsivo. */}
            <div className="pointer-events-none absolute bottom-0 right-[-18px] h-[78%] w-[58%] max-w-[310px] sm:right-0 sm:h-[86%]">
              <div className="mascot-balloon absolute -top-16 left-1/2 z-20 h-24 w-40 -translate-x-1/2 sm:-top-20 sm:h-28 sm:w-48">
                <Image
                  src="/images/vendas/fala-comigo.png"
                  alt="Fala comigo"
                  fill
                  sizes="(max-width: 640px) 160px, 192px"
                  className="object-contain saturate-[0.82]"
                />
              </div>

              <div className="relative h-full w-full transition-transform duration-500 ease-out group-hover/help-card:-translate-y-2 group-hover/help-card:scale-[1.05]">
                <Image
                  src="/images/vendas/mascote-atendente.png"
                  alt="Mascote de atendimento Imesul"
                  fill
                  sizes="(max-width: 640px) 45vw, 310px"
                  className="object-contain object-bottom saturate-[0.82] drop-shadow-[0_26px_54px_rgba(0,0,0,0.52)]"
                />
              </div>
            </div>
            <span className="pointer-events-none absolute bottom-0 right-0 h-40 w-64 bg-[radial-gradient(circle,rgba(212,43,43,0.2),transparent_68%)]" />
          </aside>
        </div>
      </div>
    </section>
  );
}
