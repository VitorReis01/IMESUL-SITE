const fallbackDevelopmentUrl = "http://localhost:3000";
const fallbackInstitutionalDevelopmentUrl = "http://localhost:3000";

// Em producao, a URL do proprio site SEMPRE precisa vir de configuracao explicita - nunca cai
// num host antigo/generico. Falha alto e claro (build/render quebra) em vez de servir
// metadata/canonical errado silenciosamente para quem visita o site. Em desenvolvimento, cai no
// localhost padrao deste projeto.
export const getSalesSiteUrl = () => {
  const configured = process.env.SALES_SITE_URL || process.env.NEXT_PUBLIC_SALES_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SALES_SITE_URL (ou NEXT_PUBLIC_SALES_SITE_URL) nao configurada em producao - configure a URL real do site de vendas antes do deploy."
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

export const getRobotsPolicy = () => ({
  index: !isPreviewEnvironment(),
  follow: !isPreviewEnvironment(),
});

// Mesma postura da funcao acima: em producao exige configuracao explicita da URL institucional -
// nunca cai num host antigo. Em desenvolvimento, cai no localhost padrao do site institucional
// (projeto irmao).
export const getInstitutionalSiteUrl = () => {
  const configured = process.env.NEXT_PUBLIC_INSTITUTIONAL_SITE_URL || process.env.NEXT_PUBLIC_INSTITUTIONAL_URL;
  if (configured) return configured.replace(/\/$/, "");

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_INSTITUTIONAL_SITE_URL (ou NEXT_PUBLIC_INSTITUTIONAL_URL) nao configurada em producao - configure a URL real do site institucional antes do deploy."
    );
  }

  return fallbackInstitutionalDevelopmentUrl;
};
