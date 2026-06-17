"use client";

import { useEffect } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { gsap } from "gsap";
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import WhyChoose from "../components/WhyChoose";
import ProductScrollExperience from "../components/ProductScrollExperience";
import FinalCTA from "../components/FinalCTA";
import Footer from "../components/Footer";

export default function Home() {
  useEffect(() => {
    let lenis;

    const initSmoothScroll = async () => {
      const Lenis = (await import("lenis")).default;
      gsap.registerPlugin(ScrollTrigger);

      lenis = new Lenis({
        duration: 1.12,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        syncTouch: false,
      });

      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((time) => lenis?.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    };

    initSmoothScroll();

    return () => {
      lenis?.destroy();
    };
  }, []);

  return (
    <main className="min-h-screen bg-imesul-blue text-white">
      <Navbar />
      <Hero />
      <WhyChoose />
      <ProductScrollExperience />
      <FinalCTA />
      <Footer />
    </main>
  );
}
