"use client";

// Ponte OPCIONAL entre o carrinho local (lib/cart.js, sempre funcional) e o rastreio de
// abandono no servidor (Backend.js/cartStore.js). SÓ envia dados quando o visitante já
// consentiu com analytics (ver lib/consent.js) - sem consentimento, esta ponte nunca chama a
// rede, e o carrinho local continua funcionando normalmente (ver relatório desta fase, seção
// carrinho/privacidade). Debounce evita gastar o orçamento do rate limit em cada clique de
// quantidade - só sincroniza depois de o carrinho ficar parado por um tempo.
import { hasAnalyticsConsent } from "./consent";
import { getAnonymousVisitorId } from "./localAnalytics";
import { getStoredUnit } from "./unitPreference";

const cartTrackCodeKey = "imesul_cart_track_code";
const debounceMs = 4000;

let debounceTimer = null;
let lastSentSignature = "";

const canUseBrowserStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const getStoredCartTrackCode = () =>
  canUseBrowserStorage() ? window.localStorage.getItem(cartTrackCodeKey) || "" : "";

const setStoredCartTrackCode = (code) => {
  if (!canUseBrowserStorage() || !code) return;
  window.localStorage.setItem(cartTrackCodeKey, code);
};

const sendCartSync = async (items) => {
  if (!hasAnalyticsConsent()) return;

  const signature = JSON.stringify(items);
  if (signature === lastSentSignature) return;

  try {
    const response = await fetch("/api/cart/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cartCode: getStoredCartTrackCode(),
        visitorId: getAnonymousVisitorId(),
        unit: getStoredUnit(),
        origin: typeof window !== "undefined" ? window.location.pathname : "",
        source: "cart-widget",
        items,
      }),
    });

    if (!response.ok) return;
    const data = await response.json().catch(() => null);
    if (data?.cartCode) setStoredCartTrackCode(data.cartCode);
    lastSentSignature = signature;
  } catch {
    // Rastreio é best-effort: uma falha de rede aqui nunca deve afetar o carrinho funcional.
  }
};

// Chamar a cada mudança do carrinho (ex.: dentro do subscribeToCart do CartWidget). Faz debounce
// internamente - seguro chamar em toda alteração de quantidade sem se preocupar com volume.
export const scheduleCartTrackingSync = (items) => {
  if (!hasAnalyticsConsent()) return;

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    sendCartSync(items);
  }, debounceMs);
};

// Chamado quando o carrinho vira um Lead ID (checkout) - permite ao backend marcar a sessão
// como CONVERTED imediatamente, sem esperar o debounce.
export const getCurrentCartTrackCode = () => getStoredCartTrackCode();
