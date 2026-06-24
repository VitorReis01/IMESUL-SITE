const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://grupoimesul.com.br").replace(/\/$/, "");

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
