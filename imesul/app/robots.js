const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://grupoimesul.com.br").replace(/\/$/, "");

// Autoriza indexacao publica e informa a localizacao canonica do sitemap.
export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
