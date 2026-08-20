"use client";

// Consentimento de cookies/privacidade (LGPD) do site INSTITUCIONAL. Independente do site de
// vendas: domínios separados, cada um com seu próprio storage - nunca compartilhar localStorage
// entre eles (ver relatório desta fase). Decisão binária apenas: ACEITAR/REJEITAR (sem categorias
// granulares - ver CookieConsentBanner.jsx).
const consentStorageKey = "imesul_institucional_privacy_consent";
export const consentVersion = 1;
const consentEventName = "imesul-institucional-consent-updated";
const openPreferencesEventName = "imesul-institucional-privacy-preferences-open";

const canUseBrowserStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

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

export const getStoredConsentRaw = () =>
  canUseBrowserStorage() ? window.localStorage.getItem(consentStorageKey) || "" : "";

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

  const record = {
    consentVersion,
    necessary: true,
    analytics: Boolean(analytics),
    location: Boolean(location),
    decidedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(consentStorageKey, JSON.stringify(record));
  window.dispatchEvent(new CustomEvent(consentEventName));
  return record;
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
