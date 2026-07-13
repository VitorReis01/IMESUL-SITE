import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import WhatsAppFloat from "../../components/WhatsAppFloat";
import MotionProvider from "../../components/MotionProvider";
import { officialSocialLinks, officialUnits } from "../../data/products";

export const metadata = {
  title: "Links Oficiais IMESUL",
  description: "Links oficiais, redes sociais e enderecos das unidades IMESUL.",
};

const douradosUnits = officialUnits.filter((unit) => unit.id.startsWith("dourados"));
const campoGrandeUnit = officialUnits.find((unit) => unit.id === "campo-grande");

// Abre os destinos oficiais em outra aba sem expor a pagina de origem.
function ExternalLink({ href, children, className = "" }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

// Card compartilhado entre redes sociais e enderecos das unidades.
function LinkCard({ eyebrow, title, href, children }) {
  return (
    <ExternalLink
      href={href}
      className="group block border border-white/10 bg-white/[0.035] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-imesul-red/50 hover:bg-white/[0.06] hover:shadow-[0_18px_50px_rgba(229,24,35,0.14)]"
    >
      <span className="font-mono text-[10px] tracking-[0.25em] text-imesul-red uppercase">
        {eyebrow}
      </span>
      <h2 className="mt-3 font-condensed text-2xl font-bold tracking-[0.08em] text-white uppercase">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-imesul-steel/80 transition-colors duration-300 group-hover:text-white">
        {children}
      </p>
    </ExternalLink>
  );
}

// Organiza os links oficiais por unidade sem depender de Linktree externo.
export default function OfficialLinksPage() {
  return (
    <main className="min-h-screen bg-[#040811] text-white">
      <MotionProvider>
        <Navbar />

        <section className="relative overflow-hidden px-6 pb-20 pt-32 sm:px-8 lg:px-16 lg:pb-28 lg:pt-40">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(229,24,35,0.18),transparent_34%),radial-gradient(circle_at_80%_10%,rgba(64,110,170,0.16),transparent_30%)]" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-imesul-red/60 to-transparent" />
          {/* Marca d'agua decorativa da pagina de links fica centralizada atras do conteudo. */}
          <div className="imesul-logo-watermark" aria-hidden="true" />

          <div className="relative z-10 mx-auto max-w-[1300px]">
            <div className="max-w-3xl">
              <span className="font-mono text-[11px] tracking-[0.45em] text-imesul-red uppercase">
                Central oficial
              </span>
              <h1 className="mt-5 font-display text-[clamp(3.2rem,8vw,8rem)] leading-[0.9] tracking-normal text-white">
                LINKS OFICIAIS IMESUL
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-imesul-steel/85 sm:text-lg">
                Acesse os canais oficiais e encontre as unidades IMESUL em Dourados e Campo Grande.
              </p>
            </div>

            <div className="mt-14 grid gap-6 lg:grid-cols-2">
              <section className="border border-white/10 bg-[#07101f]/82 p-6 shadow-[0_26px_80px_rgba(0,0,0,0.28)] sm:p-8">
                <div className="mb-8 flex items-center gap-4">
                  <span className="h-px w-10 bg-imesul-red" />
                  <h2 className="font-condensed text-3xl font-bold tracking-[0.16em] text-white uppercase">
                    Dourados
                  </h2>
                </div>

                <div className="grid gap-4">
                  <LinkCard eyebrow="Facebook" title="IMESUL Dourados" href={officialSocialLinks.dourados.facebook}>
                    Página oficial da unidade Dourados no Facebook.
                  </LinkCard>
                  <LinkCard eyebrow="Instagram" title="@imesul_dourados" href={officialSocialLinks.dourados.instagram}>
                    Perfil oficial da IMESUL Dourados no Instagram.
                  </LinkCard>
                  {douradosUnits.map((unit) => (
                    <LinkCard key={unit.id} eyebrow="Google Maps" title={unit.name} href={unit.mapsHref}>
                      {unit.address}
                      <br />
                      Telefone: {unit.phone}
                    </LinkCard>
                  ))}
                </div>
              </section>

              <section className="border border-white/10 bg-[#07101f]/82 p-6 shadow-[0_26px_80px_rgba(0,0,0,0.28)] sm:p-8">
                <div className="mb-8 flex items-center gap-4">
                  <span className="h-px w-10 bg-imesul-red" />
                  <h2 className="font-condensed text-3xl font-bold tracking-[0.16em] text-white uppercase">
                    Campo Grande
                  </h2>
                </div>

                <div className="grid gap-4">
                  <LinkCard
                    eyebrow="Facebook"
                    title="IMESUL Campo Grande"
                    href={officialSocialLinks.campoGrande.facebook}
                  >
                    Página oficial da unidade Campo Grande no Facebook.
                  </LinkCard>
                  <LinkCard
                    eyebrow="Instagram"
                    title="@imesul_campogrande"
                    href={officialSocialLinks.campoGrande.instagram}
                  >
                    Perfil oficial da IMESUL Campo Grande no Instagram.
                  </LinkCard>
                  {campoGrandeUnit ? (
                    <LinkCard eyebrow="Google Maps" title={campoGrandeUnit.name} href={campoGrandeUnit.mapsHref}>
                      {campoGrandeUnit.address}
                      <br />
                      Telefone: {campoGrandeUnit.phone}
                    </LinkCard>
                  ) : null}
                </div>
              </section>
            </div>
          </div>
        </section>

        <Footer />
        <WhatsAppFloat />
      </MotionProvider>
    </main>
  );
}
