export const VIDEO_DISABLED_PROFILE = "poster";

// Centraliza o poster e todas as fontes validas usadas pelos videos institucionais.
export const institutionalVideo = {
  poster: "/videos/fabrica-dourados-poster.webp",
  desktop: {
    mp4: "/videos/fabrica-dourados-hero-desktop.mp4",
    webm: "/videos/fabrica-dourados-hero-desktop.webm",
  },
  mobile: {
    mp4: "/videos/fabrica-dourados-hero.mp4",
    webm: "/videos/fabrica-dourados-hero.webm",
  },
  fallback: {
    mp4: "/videos/fabrica-dourados-hero.mp4",
    webm: "/videos/fabrica-dourados-hero.webm",
  },
};

// Omite fontes somente no perfil desabilitado; qualquer perfil inesperado usa o fallback.
export function getInstitutionalVideoSources(profile) {
  if (profile === VIDEO_DISABLED_PROFILE) return null;

  const sources = institutionalVideo[profile] || institutionalVideo.fallback;
  return {
    mp4: sources.mp4,
    webm: sources.webm,
  };
}
