"use client";

import dynamic from "next/dynamic";

const IntroVideo = dynamic(() => import("./IntroVideo"), {
  ssr: false,
});

// Monta a intro em video somente no cliente para impedir que APIs do navegador afetem o SSR.
export default function IntroVideoMount() {
  return <IntroVideo />;
}
