"use client";

import dynamic from "next/dynamic";

const IntroParticles = dynamic(() => import("./IntroParticles"), {
  ssr: false,
});

// Monta a intro somente no cliente para impedir que canvas e APIs do navegador afetem o SSR.
export default function IntroParticlesMount() {
  return <IntroParticles />;
}
