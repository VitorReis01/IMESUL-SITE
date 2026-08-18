// Consentimento de cookies/privacidade (LGPD) do IMESUL Vendas.
// A decisao fica somente no navegador (localStorage) - nunca ha verificacao no servidor aqui.
// Mudar consentVersion invalida decisoes antigas automaticamente (o banner volta a aparecer).
"use client";

const consentStorageKey = "imesul_privacy_consent";
export const consentVersion = 1;
const consentEventName = "imesul-consent-updated";
const openPreferencesEventName = "imesul-privacy-preferences-open";

const canUseBrowserStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

// Exportada para uso direto por quem le o snapshot via useSyncExternalStore (ex.:
// CookieConsentBanner) - unica fonte de verdade para validar consentVersion, nunca duplicar essa
// checagem em outro arquivo.
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

// Retorna a string crua (valor primitivo, estavel) para uso com useSyncExternalStore - um objeto
// novo a cada chamada quebraria a garantia de snapshot estavel do React e causaria loop de render.
export const getStoredConsentRaw = () =>
  canUseBrowserStorage() ? window.localStorage.getItem(consentStorageKey) || "" : "";

// Snapshot do servidor e sempre vazio: garante que a primeira renderizacao no client (antes de
// hidratar) bate com o HTML gerado no servidor, sem flash de conteudo nem mismatch de hidratacao.
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
export const hasLocationConsent = () => Boolean(readConsent()?.location);

// Permite que qualquer componente (ex.: link "Preferencias de privacidade" no rodape) reabra o
// banner sem depender de import direto/prop drilling ate a raiz do layout.
export const requestOpenPrivacyPreferences = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(openPreferencesEventName));
};

export const subscribeToOpenPrivacyPreferences = (callback) => {
  if (!canUseBrowserStorage()) return () => {};
  window.addEventListener(openPreferencesEventName, callback);
  return () => window.removeEventListener(openPreferencesEventName, callback);
};

// --- Geolocalizacao: no maximo uma chamada por decisao, sempre disparada por acao explicita ---

const geolocationOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 };

const getCurrentPositionOnce = () =>
  new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          status: "granted",
          deviceLocation: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            capturedAt: new Date().toISOString(),
          },
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

// So deve ser chamada a partir de um handler de clique (banner de consentimento). Consulta a
// Permissions API quando disponivel para nunca reabrir um prompt ja respondido: "granted" usa a
// permissao existente (getCurrentPosition nao exibe popup quando ja concedida), "denied" nem
// tenta. Sem Permissions API, cai direto no getCurrentPosition - ainda assim so roda porque o
// usuario acabou de agir no banner, nunca de forma automatica. Nunca usa watchPosition.
export const requestDeviceLocationOnce = async () => {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return { status: "unsupported" };
  }

  if (navigator.permissions?.query) {
    try {
      const permission = await navigator.permissions.query({ name: "geolocation" });
      if (permission.state === "denied") return { status: "denied" };
    } catch {
      // Permissions API presente mas indisponivel para "geolocation" em algum navegador -
      // segue pelo fallback getCurrentPosition, que ainda assim so roda por acao explicita.
    }
  }

  return getCurrentPositionOnce();
};
