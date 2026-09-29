"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getServerConsentRaw, getStoredConsentRaw, parseStoredConsent, subscribeToConsent } from "../lib/consent";
import { COMMERCIAL_UNITS } from "../lib/leadFlow";
import {
  getSessionAnalyticsUnit,
  getAnalyticsUnitForPath,
  purgeLegacyAnalyticsUnit,
  resolveAnalyticsUnit,
  setSessionAnalyticsUnit,
  subscribeToAnalyticsUnit,
} from "../lib/analyticsUnit";

const trackingEnabled = process.env.NEXT_PUBLIC_TRACKING_ENABLED === "true";
const gaCampoGrandeId = process.env.NEXT_PUBLIC_GA_CAMPO_GRANDE_ID || "";
const gaDouradosId = process.env.NEXT_PUBLIC_GA_DOURADOS_ID || "";
// Dois Pixels Meta ativos ao mesmo tempo (principal + remarketing IMESUL CAMPO GRANDE / ABA SITE) -
// confirmado pelo marketing. Cada NEXT_PUBLIC_* precisa ser lido por nome literal para o Next
// embutir o valor no build. Ids repetidos/vazios/nao numericos sao descartados.
const metaPixelIds = [
  ...new Set(
    [process.env.NEXT_PUBLIC_META_PIXEL_ID, process.env.NEXT_PUBLIC_META_PIXEL_ID_REMARKETING].filter((id) =>
      /^\d+$/.test(id || "")
    )
  ),
];

export const canSendTracking = ({ enabled, consent }) => enabled === true && Boolean(consent?.analytics);

export default function TrackingScripts() {
  const pathname = usePathname() || "/";
  const lastGoogleConfigKey = useRef("");
  const initializedGoogleId = useRef("");
  const lastMetaPageViewPath = useRef("");
  const [googleReady, setGoogleReady] = useState(false);
  const [metaReady, setMetaReady] = useState(false);
  const consentRaw = useSyncExternalStore(subscribeToConsent, getStoredConsentRaw, getServerConsentRaw);
  const sessionUnit = useSyncExternalStore(subscribeToAnalyticsUnit, getSessionAnalyticsUnit, () => "");
  const consent = parseStoredConsent(consentRaw);
  // Propriedade GA4 (ver lib/analyticsUnit.js): "/" e "/campogrande" -> Campo Grande, "/dourados" ->
  // Dourados; a rota vence qualquer unidade guardada e nunca ha uma terceira tag. Independe do
  // consentimento (canTrack abaixo) e da regiao comercial (imesul_commercial_unit).
  const routeUnit = getAnalyticsUnitForPath(pathname);
  const googleTagId =
    resolveAnalyticsUnit(pathname, sessionUnit) === COMMERCIAL_UNITS.DOURADOS ? gaDouradosId : gaCampoGrandeId;
  const canTrack = canSendTracking({ enabled: trackingEnabled, consent });

  // Sobras de versoes anteriores (localStorage) nunca podem influenciar a tag.
  useEffect(() => {
    purgeLegacyAnalyticsUnit();
  }, []);

  // Entrar em uma rota de unidade a torna a unidade da sessao (sobrevive ao redirect /dourados -> /).
  // Declarado ANTES do efeito do GA4: se ele precisar recarregar a pagina, a unidade ja esta gravada.
  useEffect(() => {
    if (routeUnit) setSessionAnalyticsUnit(routeUnit);
  }, [routeUnit]);

  useEffect(() => {
    if (!canTrack || !googleReady || !googleTagId || typeof window.gtag !== "function") return;
    // Nunca dois GA4 no mesmo documento: o gtag.js ja carregado nao consegue "desligar" uma
    // propriedade sem derrubar as outras (ga-disable em um ID suprime todos), e eventos sem send_to
    // vao para todas as propriedades configuradas. Por isso, se a unidade mudar DEPOIS do GA4 iniciar
    // (ex.: navegar da home, Campo Grande, para /dourados), a navegacao que troca a unidade vira um
    // carregamento completo da pagina, que ja inicia so o GA4 da unidade nova.
    if (initializedGoogleId.current && initializedGoogleId.current !== googleTagId) {
      if (lastGoogleConfigKey.current !== `${initializedGoogleId.current}:${pathname}`) window.location.reload();
      return;
    }
    const configKey = `${googleTagId}:${pathname}`;
    if (lastGoogleConfigKey.current === configKey) return;
    window.gtag("config", googleTagId, { anonymize_ip: true, page_path: pathname });
    initializedGoogleId.current = googleTagId;
    lastGoogleConfigKey.current = configKey;
  }, [canTrack, googleReady, googleTagId, pathname]);

  useEffect(() => {
    if (!canTrack || !metaReady || typeof window.fbq !== "function") return;
    // Mesma guarda de idempotencia do GA4 acima - sem isso, alternar o consentimento (rejeitar/
    // aceitar de novo pelo banner) sem navegar refazia o efeito e disparava um PageView duplicado
    // no Meta para a mesma pagina. Um unico track("PageView") ja chega a todos os Pixels iniciados
    // (um evento por Pixel) - nunca chamar uma vez por Pixel, senao cada um receberia dois.
    if (lastMetaPageViewPath.current === pathname) return;
    window.fbq("track", "PageView");
    lastMetaPageViewPath.current = pathname;
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

      {metaPixelIds.length ? (
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
            ${metaPixelIds.map((id) => `fbq('init', '${id}');`).join(" ")}
          `}
        </Script>
      ) : null}
    </>
  );
}
