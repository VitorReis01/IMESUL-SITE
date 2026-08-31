const fallbackProductionUrl = "https://imesul-vendas.vercel.app";
const fallbackDevelopmentUrl = "http://localhost:3000";
const fallbackInstitutionalUrl = "https://imesul-site.vercel.app";

export const getSalesSiteUrl = () => {
  const configured = process.env.SALES_SITE_URL || process.env.NEXT_PUBLIC_SALES_SITE_URL;
  const fallback = process.env.NODE_ENV === "production" ? fallbackProductionUrl : fallbackDevelopmentUrl;
  return (configured || fallback).replace(/\/$/, "");
};

export const isPreviewEnvironment = () =>
  process.env.VERCEL_ENV === "preview" || process.env.NEXT_PUBLIC_NOINDEX === "true";

export const getRobotsPolicy = () => ({
  index: !isPreviewEnvironment(),
  follow: !isPreviewEnvironment(),
});

export const getInstitutionalSiteUrl = () => {
  const configured = process.env.NEXT_PUBLIC_INSTITUTIONAL_SITE_URL || process.env.NEXT_PUBLIC_INSTITUTIONAL_URL;
  return (configured || fallbackInstitutionalUrl).replace(/\/$/, "");
};
