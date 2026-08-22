"use client";

const consentStorageKey = "imesul_institucional_privacy_consent";
export const consentVersion = 1;
const consentEventName = "imesul-institucional-consent-updated";
const openPreferencesEventName = "imesul-institucional-privacy-preferences-open";
const bannerOpenEventName = "imesul-institucional-consent-banner-open-changed";
const sharedConsentCookieName = "imesul_privacy_consent";
export const consentQueryParam = "im_consent";
const issueEndpoint = "/api/consent-sync/issue";
const importEndpoint = "/api/consent-sync/import";

const canUseBrowserStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const canUseDocumentCookie = () => typeof document !== "undefined" && typeof document.cookie === "string";

const isGrupoImesulHost = (hostname = "") =>
  hostname === "grupoimesul.com.br" || hostname.endsWith(".grupoimesul.com.br");

const encodeConsentState = (consent) => {
  const parsed = consent?.consentVersion ? consent : parseStoredConsent(consent);
  if (!parsed) return "";
  return `v${consentVersion}-a${parsed.analytics ? "1" : "0"}-l${parsed.location ? "1" : "0"}`;
};

export const parseConsentState = (value) => {
  if (typeof value !== "string") return null;
  const match = value.match(/^v1-a([01])-l([01])$/);
  if (!match) return null;
  return {
    consentVersion,
    necessary: true,
    analytics: match[1] === "1",
    location: match[2] === "1",
    decidedAt: null,
  };
};

const isLikelySignedToken = (value = "") => /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);

const buildConsentRecord = ({ analytics, location, decidedAt }) => ({
  consentVersion,
  necessary: true,
  analytics: Boolean(analytics),
  location: Boolean(location),
  decidedAt: decidedAt || new Date().toISOString(),
});

export const parseStoredConsent = (raw) => {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.consentVersion !== consentVersion) return null;

    return {
      consentVersion,
      necessary: true,
      analytics: Boolean(parsed.analytics),
      location: Boolean(parsed.location),
      decidedAt: parsed.decidedAt || null,
    };
  } catch {
    return null;
  }
};

const readSharedConsentCookie = () => {
  if (!canUseDocumentCookie()) return null;
  const cookie = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${sharedConsentCookieName}=`));
  if (!cookie) return null;
  return parseConsentState(decodeURIComponent(cookie.split("=").slice(1).join("=")));
};

const writeSharedConsentCookie = (record) => {
  if (!canUseDocumentCookie() || !isGrupoImesulHost(window.location.hostname)) return;
  const encoded = encodeConsentState(record);
  if (!encoded) return;
  document.cookie = `${sharedConsentCookieName}=${encodeURIComponent(encoded)}; Max-Age=31536000; Path=/; Domain=.grupoimesul.com.br; SameSite=Lax; Secure`;
};

const persistConsentRecord = (record) => {
  if (!canUseBrowserStorage()) return null;
  const next = buildConsentRecord(record);
  const current = parseStoredConsent(window.localStorage.getItem(consentStorageKey) || "");
  const unchanged = current && current.analytics === next.analytics && current.location === next.location;
  if (unchanged) {
    writeSharedConsentCookie(current);
    return current;
  }
  window.localStorage.setItem(consentStorageKey, JSON.stringify(next));
  writeSharedConsentCookie(next);
  window.dispatchEvent(new CustomEvent(consentEventName));
  return next;
};

const removeConsentQueryParam = () => {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(consentQueryParam)) return;
  url.searchParams.delete(consentQueryParam);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
};

export const syncConsentFromUrl = () => {
  if (!canUseBrowserStorage() || typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const token = url.searchParams.get(consentQueryParam) || "";
  if (!token || isLikelySignedToken(token)) return null;
  return null;
};

export const hasPendingConsentSync = () => {
  if (typeof window === "undefined") return false;
  return isLikelySignedToken(new URL(window.location.href).searchParams.get(consentQueryParam) || "");
};

export const importConsentFromUrl = async () => {
  if (!canUseBrowserStorage() || typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const token = url.searchParams.get(consentQueryParam) || "";
  if (!isLikelySignedToken(token)) return null;

  try {
    const response = await fetch(importEndpoint, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await response.json();
    if (!response.ok || !data?.ok) return null;
    const imported = persistConsentRecord(data.consent);

if (imported) {
  window.dispatchEvent(new CustomEvent(consentEventName));
}

return imported;
  } catch {
    return null;
  } finally {
    removeConsentQueryParam();
  }
};

export const syncSharedConsent = () => {
  if (!canUseBrowserStorage() || typeof window === "undefined") return null;
  const fromUrl = syncConsentFromUrl();
  if (fromUrl) return fromUrl;
  if (!isGrupoImesulHost(window.location.hostname)) return null;
  const fromCookie = readSharedConsentCookie();
  if (!fromCookie) return null;
  return persistConsentRecord(fromCookie);
};

export const getStoredConsentRaw = () =>
  canUseBrowserStorage()
    ? (() => {
        const consent = syncSharedConsent() || parseStoredConsent(window.localStorage.getItem(consentStorageKey) || "");
        return consent ? JSON.stringify(consent) : "";
      })()
    : "";

export const getServerConsentRaw = () => "";

export const subscribeToConsent = (callback) => {
  if (!canUseBrowserStorage()) return () => {};
  window.addEventListener(consentEventName, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(consentEventName, callback);
    window.removeEventListener("storage", callback);
  };
};

export const readConsent = () => parseStoredConsent(getStoredConsentRaw());

export const saveConsent = ({ analytics, location }) => {
  if (!canUseBrowserStorage()) return null;
  return persistConsentRecord({ analytics, location });
};

export const getConsentSyncUrl = async (href) => {
  const current = readConsent();
  if (!current) return href;

  try {
    const response = await fetch(issueEndpoint, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analytics: current.analytics, location: current.location }),
    });
    const data = await response.json();
    if (!response.ok || !data?.ok || !isLikelySignedToken(data.token)) return href;
    const url = new URL(href, typeof window !== "undefined" ? window.location.href : "https://grupoimesul.com.br");
    url.searchParams.set(consentQueryParam, data.token);
    return url.toString();
  } catch {
    return href;
  }
};

export const navigateWithConsent = async (event, href, beforeNavigate) => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  beforeNavigate?.();
  window.location.href = await getConsentSyncUrl(href);
};

export const hasAnalyticsConsent = () => Boolean(readConsent()?.analytics);

export const requestOpenPrivacyPreferences = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(openPreferencesEventName));
};

export const subscribeToOpenPrivacyPreferences = (callback) => {
  if (!canUseBrowserStorage()) return () => {};
  window.addEventListener(openPreferencesEventName, callback);
  return () => window.removeEventListener(openPreferencesEventName, callback);
};

// Sinal efemero (nao persistido, nao e uma segunda decisao de consentimento) de "o banner esta
// visivel agora". Quem publica e so o CookieConsentBanner, a partir da mesma logica que ja usa
// para decidir se renderiza (forceOpen/consent salvo) - o WhatsApp flutuante le por aqui para
// ceder espaco ao banner em telas pequenas, sem duplicar a logica de consentimento.
let consentBannerOpenState = false;

export const setConsentBannerOpen = (open) => {
  if (typeof window === "undefined" || consentBannerOpenState === open) return;
  consentBannerOpenState = open;
  window.dispatchEvent(new CustomEvent(bannerOpenEventName));
};

export const getConsentBannerOpen = () => consentBannerOpenState;
export const getServerConsentBannerOpen = () => false;

export const subscribeToConsentBannerOpen = (callback) => {
  if (!canUseBrowserStorage()) return () => {};
  window.addEventListener(bannerOpenEventName, callback);
  return () => window.removeEventListener(bannerOpenEventName, callback);
};

// --- Geolocalização: no máximo uma chamada por decisão, sempre disparada por ação explícita ---
// Usada apenas pelo botão "Usar minha localização" do seletor de unidade (UnitPickerModal),
// nunca automaticamente. Não há reverse geocoding externo (ver lib/regionResolver.js e o
// relatório desta fase): a coordenada só é usada para uma estimativa local, sem enviar a
// nenhum serviço de terceiros.
const geolocationOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 };

export const requestDeviceLocationOnce = () =>
  new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      resolve({ status: "unsupported" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          status: "granted",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        const status =
          error.code === error.TIMEOUT ? "timeout" : error.code === error.PERMISSION_DENIED ? "denied" : "unavailable";
        resolve({ status });
      },
      geolocationOptions
    );
  });
