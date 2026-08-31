import { getLastModifiedDate, getSiteUrl } from "../lib/siteUrl";

// Publica a homepage no formato de sitemap esperado pelo Next.js.
export default function sitemap() {
  const siteUrl = getSiteUrl();
  const lastModified = getLastModifiedDate();

  return [
    {
      url: siteUrl,
      ...(lastModified ? { lastModified } : {}),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
