"use client";

import { useSyncExternalStore } from "react";
import { VIDEO_DISABLED_PROFILE } from "../data/videoAssets";

const HIGH_QUALITY_QUERY = "(min-width: 768px)";

// Le as preferencias atuais sem iniciar um segundo ciclo de renderizacao.
function getVideoProfile() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  if (reducedMotion.matches || connection?.saveData) return VIDEO_DISABLED_PROFILE;
  return window.matchMedia(HIGH_QUALITY_QUERY).matches ? "desktop" : "mobile";
}

// Acompanha mudancas de tela, economia de dados e movimento com cleanup centralizado.
function subscribeToVideoProfile(notify) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const highQualityViewport = window.matchMedia(HIGH_QUALITY_QUERY);
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  reducedMotion.addEventListener("change", notify);
  highQualityViewport.addEventListener("change", notify);
  connection?.addEventListener?.("change", notify);

  return () => {
    reducedMotion.removeEventListener("change", notify);
    highQualityViewport.removeEventListener("change", notify);
    connection?.removeEventListener?.("change", notify);
  };
}

// Usa um perfil seguro no SSR e nunca entrega um identificador indefinido aos componentes.
export default function useAdaptiveVideoProfile({ enabled = true } = {}) {
  const profile = useSyncExternalStore(
    subscribeToVideoProfile,
    getVideoProfile,
    () => VIDEO_DISABLED_PROFILE
  );
  return enabled ? profile : VIDEO_DISABLED_PROFILE;
}
