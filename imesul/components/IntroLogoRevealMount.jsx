"use client";

import dynamic from "next/dynamic";

const IntroLogoReveal = dynamic(() => import("./IntroLogoReveal"), {
  ssr: false,
});

// Monta a intro somente no cliente para impedir que sessionStorage e matchMedia afetem o SSR.
export default function IntroLogoRevealMount() {
  return <IntroLogoReveal />;
}
