const fallbackProductionUrl = "https://imesul-site.vercel.app";
const fallbackDevelopmentUrl = "http://localhost:3000";

export const getSiteUrl = () => {
  const configured = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  const fallback = process.env.NODE_ENV === "production" ? fallbackProductionUrl : fallbackDevelopmentUrl;
  return (configured || fallback).replace(/\/$/, "");
};

export const isPreviewEnvironment = () =>
  process.env.VERCEL_ENV === "preview" || process.env.NEXT_PUBLIC_NOINDEX === "true";

export const getRobotsPolicy = () => ({
  index: !isPreviewEnvironment(),
  follow: !isPreviewEnvironment(),
});

// Sem SITE_LASTMOD configurada, omite lastModified em vez de inventar uma data fixa - um valor
// de fallback estático ficaria desatualizado silenciosamente a cada mudança real do site.
export const getLastModifiedDate = () =>
  process.env.SITE_LASTMOD ? new Date(process.env.SITE_LASTMOD) : undefined;
