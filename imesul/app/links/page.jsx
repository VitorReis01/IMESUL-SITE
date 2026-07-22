// Pagina interna com links oficiais, redes sociais e enderecos da IMESUL.
// A central de links por unidade fica em OfficialLinksPicker.jsx, que reaproveita os mesmos
// dados de unidades usados no footer (data/products.js) para evitar informacoes duplicadas.
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import WhatsAppFloat from "../../components/WhatsAppFloat";
import MotionProvider from "../../components/MotionProvider";
import OfficialLinksPicker from "../../components/OfficialLinksPicker";

export const metadata = {
  title: "Links Oficiais IMESUL",
  description: "Links oficiais, redes sociais e enderecos das unidades IMESUL.",
};

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

            <div className="mt-14">
              <OfficialLinksPicker />
            </div>
          </div>
        </section>

        <Footer />
        <WhatsAppFloat />
      </MotionProvider>
    </main>
  );
}
