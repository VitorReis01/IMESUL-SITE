"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getServerConsentRaw, getStoredConsentRaw, parseStoredConsent, subscribeToConsent } from "../lib/consent";

const trackingEnabled = process.env.NEXT_PUBLIC_TRACKING_ENABLED === "true";
const gaCampoGrandeId = process.env.NEXT_PUBLIC_GA_CAMPO_GRANDE_ID || "";
const gaDouradosId = process.env.NEXT_PUBLIC_GA_DOURADOS_ID || "";
const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";

export default function TrackingScripts() {
  const pathname = usePathname() || "/";
  const [googleReady, setGoogleReady] = useState(false);
  const [metaReady, setMetaReady] = useState(false);
  const consentRaw = useSyncExternalStore(subscribeToConsent, getStoredConsentRaw, getServerConsentRaw);
  const consent = parseStoredConsent(consentRaw);
  const googleTagId = pathname === "/dourados" || pathname.startsWith("/dourados/") ? gaDouradosId : gaCampoGrandeId;
  const canTrack = trackingEnabled && Boolean(consent?.analytics);

  useEffect(() => {
    if (!canTrack || !googleReady || !googleTagId || typeof window.gtag !== "function") return;
    window.gtag("config", googleTagId, { anonymize_ip: true, page_path: pathname });
  }, [canTrack, googleReady, googleTagId, pathname]);

  useEffect(() => {
    if (!canTrack || !metaReady || typeof window.fbq !== "function") return;
    window.fbq("track", "PageView");
  }, [canTrack, metaReady, pathname]);

  if (!canTrack) return null;

  return (
    <>
      {googleTagId ? (
        <>
          <Script id="google-tag-loader" src={`https://www.googletagmanager.com/gtag/js?id=${googleTagId}`} strategy="afterInteractive" />
          <Script id="google-tag-init" strategy="afterInteractive" onReady={() => setGoogleReady(true)}>
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = window.gtag || gtag;
              gtag('js', new Date());
            `}
          </Script>
        </>
      ) : null}

      {metaPixelId ? (
        <Script id="meta-pixel-init" strategy="afterInteractive" onReady={() => setMetaReady(true)}>
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${metaPixelId}');
          `}
        </Script>
      ) : null}
    </>
  );
}
