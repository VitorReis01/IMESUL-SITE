import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import CompanyStory from "../components/CompanyStory";
import WhyChoose from "../components/WhyChoose";
import ProductScrollExperience from "../components/ProductScrollExperience";
import FinalCTA from "../components/FinalCTA";
import Footer from "../components/Footer";
import WhatsAppFloat from "../components/WhatsAppFloat";
import MotionProvider from "../components/MotionProvider";
import SmoothScroll from "../components/SmoothScroll";
import IntroParticlesMount from "../components/IntroParticlesMount";

// Monta a homepage na ordem em que as secoes aparecem durante a rolagem.
// A pagina fica no servidor; apenas interacoes isoladas sao hidratadas.
export default function Home() {
  return (
    <main className="min-h-screen bg-imesul-blue text-white">
      <MotionProvider>
        <IntroParticlesMount />
        <Navbar />
        <Hero />
        <CompanyStory />
        <WhyChoose />
        <ProductScrollExperience />
        <FinalCTA />
        {/* Ancora usada pela Navbar para levar direto as unidades de Dourados na home. */}
        <div id="dourados">
          <Footer />
        </div>
        <WhatsAppFloat />
        <SmoothScroll />
      </MotionProvider>
    </main>
  );
}
