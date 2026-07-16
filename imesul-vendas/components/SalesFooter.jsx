// Rodape da area de vendas.
// Reune unidades, catalogo, site institucional e caminhos principais do atendimento.
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

const institutionalUrl =
  process.env.NEXT_PUBLIC_INSTITUTIONAL_SITE_URL || "/";

const navigationLinks = [
  { label: "Projetos", href: "#project-path" },
  { label: "Materiais", href: "#material-path" },
  { label: "Catálogo", href: "/catalogo/catalogo-imesul.pdf", external: true },
  { label: "Site Institucional", href: institutionalUrl, external: true },
];

const units = [
  {
    name: "Dourados — Matriz",
    address: "Rua Pedro Rigotti, 258 – Jardim São Pedro, Dourados/MS",
    phone: "(67) 3427-5700",
    phoneHref: "tel:+556734275700",
    mapsHref: "https://maps.app.goo.gl/vse5FAdajRYdK2HA9",
  },
  {
    name: "Dourados Centro",
    address: "Av. Marcelino Pires, 10.155 – Dourados/MS",
    phone: "(67) 3411-5700",
    phoneHref: "tel:+556734115700",
    mapsHref: "https://maps.app.goo.gl/mQS2dtnM3ZWVFUnP7",
  },
  {
    name: "Campo Grande",
    address: "Av. Cel. Antonino, 1692 – Vila Lucinda, Campo Grande/MS",
    phone: "(67) 3312-5600",
    phoneHref: "tel:+556733125600",
    mapsHref: "https://maps.app.goo.gl/raaCtPNwUQMGVEQi6",
  },
];

const socialLinks = [
  {
    label: "Instagram Dourados",
    href: "https://www.instagram.com/imesul_dourados",
  },
  {
    label: "Instagram Campo Grande",
    href: "https://www.instagram.com/imesul_campogrande",
  },
  {
    label: "Facebook Dourados",
    href: "https://web.facebook.com/imesuldouradosms?_rdc=1&_rdr#",
  },
  {
    label: "Facebook Campo Grande",
    href: "https://web.facebook.com/imesulcampograndems?_rdc=1&_rdr#",
  },
];

// Rodapé comercial com os mesmos contatos oficiais usados no site institucional.
export default function SalesFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative border-t border-slate-200 bg-white">
      <div className="h-px bg-gradient-to-r from-transparent via-imesul-red/35 to-transparent" />

      <div className="mx-auto max-w-[1480px] px-6 py-14 sm:px-8 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_0.7fr_1.35fr_0.72fr]">
          <div data-scroll-reveal>
            {/* Base branca em degradê destaca a marca no rodapé escuro sem alterar os demais blocos. */}
            <div className="inline-flex">
              <Image
                src="/images/logo-imesul-oficial.png"
              alt="IMESUL Distribuição"
                width={1600}
                height={477}
                className="h-auto w-[150px] object-contain"
              />
            </div>
            <p className="mt-6 max-w-[370px] text-sm leading-7 text-slate-700">
              Distribuidora de materiais em aço para construção, serralheria,
              indústria e campo em Mato Grosso do Sul.
            </p>
          </div>

          <div data-scroll-reveal style={{ "--reveal-delay": "50ms" }}>
            <h2 className="mb-6 flex items-center gap-3 font-condensed text-xs font-semibold uppercase tracking-[0.28em] text-slate-900">
              <span className="h-px w-4 bg-imesul-red" />
              Navegação
            </h2>
            <ul className="flex flex-col gap-3">
              {navigationLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className="group inline-flex items-center gap-2 font-condensed text-sm font-semibold uppercase tracking-[0.13em] text-slate-700 transition-colors hover:text-imesul-red"
                  >
                    {link.label}
                    {link.external && (
                      <ArrowUpRight
                        size={13}
                        className="text-imesul-red transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div data-scroll-reveal style={{ "--reveal-delay": "100ms" }}>
            <h2 className="mb-6 flex items-center gap-3 font-condensed text-xs font-semibold uppercase tracking-[0.28em] text-slate-900">
              <span className="h-px w-4 bg-imesul-red" />
              Unidades
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
              {units.map((unit) => (
                <div key={unit.name}>
                  <p className="font-condensed text-base font-semibold uppercase tracking-[0.12em] text-slate-900">
                    {unit.name}
                  </p>
                  <a
                    href={unit.mapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 block max-w-[420px] text-sm leading-6 text-slate-700 underline decoration-transparent underline-offset-4 transition-[color,text-decoration-color] hover:text-imesul-red hover:decoration-imesul-red/60"
                  >
                    {unit.address}
                  </a>
                  <a
                    href={unit.phoneHref}
                    className="mt-1.5 inline-block font-mono text-[11px] tracking-[0.12em] text-slate-600 transition-colors hover:text-imesul-red"
                  >
                    Telefone: {unit.phone}
                  </a>
                </div>
              ))}
            </div>
          </div>

          <div data-scroll-reveal style={{ "--reveal-delay": "150ms" }}>
            <h2 className="mb-6 flex items-center gap-3 font-condensed text-xs font-semibold uppercase tracking-[0.28em] text-slate-900">
              <span className="h-px w-4 bg-imesul-red" />
              Links úteis
            </h2>
            <ul className="flex flex-col gap-3">
              {socialLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-2 text-sm text-slate-700 transition-colors hover:text-imesul-red"
                  >
                    {link.label}
                    <ArrowUpRight
                      size={13}
                      className="text-imesul-red transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div data-scroll-reveal style={{ "--reveal-delay": "180ms" }} className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-7 sm:flex-row">
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-600">
            © {year} IMESUL Distribuição. Todos os direitos reservados.
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-600">
            Dourados Matriz, Dourados Centro e Campo Grande
          </span>
        </div>
      </div>
    </footer>
  );
}
