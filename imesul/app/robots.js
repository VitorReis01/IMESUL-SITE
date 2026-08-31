import { getRobotsPolicy, getSiteUrl } from "../lib/siteUrl";

// Autoriza indexacao publica e informa a localizacao canonica do sitemap.
export default function robots() {
  const siteUrl = getSiteUrl();
  const policy = getRobotsPolicy();

  return {
    rules: {
      userAgent: "*",
      allow: policy.index ? "/" : undefined,
      disallow: policy.index ? undefined : "/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
