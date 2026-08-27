import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import CompanyStory from "../components/CompanyStory";
import WhyChoose from "../components/WhyChoose";
import MaterialsShowreel from "../components/MaterialsShowreel";
import ProductScrollExperience from "../components/ProductScrollExperience";
import MoreMaterialsMorph from "../components/MoreMaterialsMorph";
import GoogleReviews from "../components/GoogleReviews";
import FinalCTA from "../components/FinalCTA";
import Footer from "../components/Footer";
import MotionProvider from "../components/MotionProvider";
import SmoothScroll from "../components/SmoothScroll";
import CompatibilityProvider from "../components/CompatibilityProvider";

// Monta a homepage na ordem em que as secoes aparecem durante a rolagem.
// A pagina fica no servidor; apenas interacoes isoladas sao hidratadas.
export default function Home() {
  return (
    <main className="min-h-screen bg-imesul-blue text-white">
      <CompatibilityProvider>
        <MotionProvider>
          <Navbar />
          <Hero />
          <CompanyStory />
          <WhyChoose />
          <MaterialsShowreel />
          <ProductScrollExperience />
          <MoreMaterialsMorph />
          <GoogleReviews />
          <FinalCTA />
          {/* Ancora usada pelo menu ("UNIDADES") para levar direto as informacoes das unidades
              (Campo Grande, Dourados Centro, Dourados Loja de Fabrica) na home. */}
          <div id="unidades">
            <Footer />
          </div>
          <SmoothScroll />
        </MotionProvider>
      </CompatibilityProvider>
    </main>
  );
}
