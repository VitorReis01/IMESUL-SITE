const fallbackDevelopmentUrl = "http://localhost:3000";

// Em producao, a URL do site SEMPRE precisa vir de configuracao explicita - nunca cai num host
// antigo/generico. Falha alto e claro (build/render quebra) em vez de servir metadata/canonical
// errado silenciosamente para quem visita o site. Em desenvolvimento, cai no localhost padrao
// deste projeto.
export const getSiteUrl = () => {
  const configured = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SITE_URL (ou NEXT_PUBLIC_SITE_URL) nao configurada em producao - configure a URL real do site antes do deploy."
    );
  }

  return fallbackDevelopmentUrl;
};

// Postura SEGURA por padrao: so libera indexacao com prova POSITIVA de producao real
// (SITE_ENV === "production"). Qualquer outra coisa - SITE_ENV ausente, "preview", "development"
// ou qualquer valor nao reconhecido - cai em noindex. Deliberadamente NAO usa NODE_ENV como sinal
// de producao: o processo roda com NODE_ENV=production tanto em producao real quanto em uma copia
// de homologacao no mesmo tipo de hospedagem, entao NODE_ENV sozinho nao distingue os dois - so
// SITE_ENV, configurado explicitamente por ambiente, faz essa distincao. NEXT_PUBLIC_NOINDEX=true
// continua disponivel como reforco explicito adicional (ver .env.example) - nunca reverte
// noindex, so pode confirmar.
export const isPreviewEnvironment = () =>
  process.env.NEXT_PUBLIC_NOINDEX === "true" || process.env.SITE_ENV !== "production";

export const getRobotsPolicy = () => {
  const index = !isPreviewEnvironment() && process.env.NEXT_PUBLIC_NOINDEX !== "true";
  return { index, follow: index };
};

// Sem SITE_LASTMOD configurada, omite lastModified em vez de inventar uma data fixa - um valor
// de fallback estático ficaria desatualizado silenciosamente a cada mudança real do site.
export const getLastModifiedDate = () =>
  process.env.SITE_LASTMOD ? new Date(process.env.SITE_LASTMOD) : undefined;
