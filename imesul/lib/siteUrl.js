const fallbackProductionUrl = "https://imesul-site.vercel.app";
const fallbackDevelopmentUrl = "http://localhost:3000";

export const getSiteUrl = () => {
  const configured = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  const fallback = process.env.NODE_ENV === "production" ? fallbackProductionUrl : fallbackDevelopmentUrl;
  return (configured || fallback).replace(/\/$/, "");
};

// Postura SEGURA por padrao: so libera indexacao com prova POSITIVA de Production
// (VERCEL_ENV === "production"). Qualquer outra coisa - Preview, dev local, ou VERCEL_ENV
// ausente/nao exposto ao runtime deste projeto - cai em noindex. Antes a logica era o inverso
// ("preview so se VERCEL_ENV === 'preview'"), o que deixou robots.txt liberar indexacao numa
// Preview real quando VERCEL_ENV nao chegou como esperado (achado da auditoria
// FULL-SCOPE/remediacao - ver relatorio). NEXT_PUBLIC_NOINDEX=true continua disponivel como
// reforco explicito adicional (ver .env.example) - nunca reverte noindex, so pode confirmar.
export const isPreviewEnvironment = () => process.env.VERCEL_ENV !== "production";

export const getRobotsPolicy = () => {
  const index = !isPreviewEnvironment() && process.env.NEXT_PUBLIC_NOINDEX !== "true";
  return { index, follow: index };
};

// Sem SITE_LASTMOD configurada, omite lastModified em vez de inventar uma data fixa - um valor
// de fallback estático ficaria desatualizado silenciosamente a cada mudança real do site.
export const getLastModifiedDate = () =>
  process.env.SITE_LASTMOD ? new Date(process.env.SITE_LASTMOD) : undefined;
