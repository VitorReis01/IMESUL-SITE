"use client";

import { useEffect } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { gsap } from "gsap";
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import CompanyStory from "../components/CompanyStory";
import WhyChoose from "../components/WhyChoose";
import ProductScrollExperience from "../components/ProductScrollExperience";
import FinalCTA from "../components/FinalCTA";
import Footer from "../components/Footer";
import WhatsAppFloat from "../components/WhatsAppFloat";

export default function Home() {
  useEffect(() => {
    let lenis;
    let tickerCallback;
    let idleId;
    let timeoutId;

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
      tickerCallback = (time) => lenis?.raf(time * 1000);
      gsap.ticker.add(tickerCallback);
      gsap.ticker.lagSmoothing(0);
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(initSmoothScroll, { timeout: 1500 });
    } else {
      timeoutId = window.setTimeout(initSmoothScroll, 800);
    }

    return () => {
      if (idleId) window.cancelIdleCallback(idleId);
      if (timeoutId) window.clearTimeout(timeoutId);
      if (tickerCallback) gsap.ticker.remove(tickerCallback);
      lenis?.destroy();
    };
  }, []);

  return (
    <main className="min-h-screen bg-imesul-blue text-white">
      <Navbar />
      <Hero />
      <CompanyStory />
      <WhyChoose />
      <ProductScrollExperience />
      <FinalCTA />
      <Footer />
      <WhatsAppFloat />
    </main>
  );
}
