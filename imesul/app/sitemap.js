const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://grupoimesul.com.br").replace(/\/$/, "");

// Publica a homepage no formato de sitemap esperado pelo Next.js.
export default function sitemap() {
  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
