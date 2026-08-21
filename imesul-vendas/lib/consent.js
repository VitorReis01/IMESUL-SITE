// Consentimento de cookies/privacidade (LGPD) do IMESUL Vendas.
// A decisao fica no navegador e pode ser sincronizada entre os sites da IMESUL.
// Mudar consentVersion invalida decisoes antigas automaticamente (o banner volta a aparecer).
"use client";

const consentStorageKey = "imesul_privacy_consent";
export const consentVersion = 1;
const consentEventName = "imesul-consent-updated";
const openPreferencesEventName = "imesul-privacy-preferences-open";
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

// Retorna a string crua (valor primitivo, estavel) para uso com useSyncExternalStore - um objeto
// novo a cada chamada quebraria a garantia de snapshot estavel do React e causaria loop de render.
export const getStoredConsentRaw = () =>
  canUseBrowserStorage()
    ? (() => {
      const consent = syncSharedConsent() || parseStoredConsent(window.localStorage.getItem(consentStorageKey) || "");
      return consent ? JSON.stringify(consent) : "";
    })()
    : "";

// Snapshot do servidor e sempre vazio: garante que a primeira renderizacao no client (antes de
// hidratar) bate com o HTML gerado no servidor, sem flash de conteudo nem mismatch de hidratacao.
export const getServerConsentRaw = () => "";

export const subscribeToConsent = (callback) => {
  if (!canUseBrowserStorage()) return () => { };
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
export const hasLocationConsent = () => Boolean(readConsent()?.location);

// Permite que qualquer componente (ex.: link "Preferencias de privacidade" no rodape) reabra o
// banner sem depender de import direto/prop drilling ate a raiz do layout.
export const requestOpenPrivacyPreferences = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(openPreferencesEventName));
};

export const subscribeToOpenPrivacyPreferences = (callback) => {
  if (!canUseBrowserStorage()) return () => { };
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
