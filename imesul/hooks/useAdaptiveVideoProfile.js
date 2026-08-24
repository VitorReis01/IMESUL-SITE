"use client";

import { useSyncExternalStore } from "react";
import { VIDEO_DISABLED_PROFILE } from "../data/videoAssets";

const HIGH_QUALITY_QUERY = "(min-width: 768px)";

// Le as preferencias atuais sem iniciar um segundo ciclo de renderizacao.
function getVideoProfile() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  if (connection?.saveData) return VIDEO_DISABLED_PROFILE;
  return window.matchMedia(HIGH_QUALITY_QUERY).matches ? "desktop" : "mobile";
}

// Acompanha mudancas de tela e economia de dados com cleanup centralizado.
function subscribeToVideoProfile(notify) {
  const highQualityViewport = window.matchMedia(HIGH_QUALITY_QUERY);
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  highQualityViewport.addEventListener("change", notify);
  connection?.addEventListener?.("change", notify);

  return () => {
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
