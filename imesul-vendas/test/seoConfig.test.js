import { afterEach, describe, expect, it } from "vitest";
import robots from "../../imesul/app/robots";
import sitemap from "../../imesul/app/sitemap";
import {
  getLastModifiedDate,
  getRobotsPolicy,
  getSiteUrl,
} from "../../imesul/lib/siteUrl";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("SEO institucional", () => {
  it("usa SITE_URL como fonte central da URL pública", () => {
    process.env.SITE_URL = "https://www.grupoimesul.com.br/";
    expect(getSiteUrl()).toBe("https://www.grupoimesul.com.br");
  });

  it("mantém o domínio atual de produção sem apontar canonical cedo demais para o domínio futuro", () => {
    delete process.env.SITE_URL;
    process.env.NODE_ENV = "production";
    expect(getSiteUrl()).toBe("https://imesul-site.vercel.app");
  });

  it("não indexa preview", () => {
    process.env.VERCEL_ENV = "preview";
    expect(getRobotsPolicy()).toEqual({ index: false, follow: false });
  });

  it("mantém produção indexável", () => {
    process.env.VERCEL_ENV = "production";
    expect(getRobotsPolicy()).toEqual({ index: true, follow: true });
  });

  it("gera sitemap com URL central e lastmod estável", () => {
    process.env.SITE_URL = "https://imesul-site.vercel.app";
    process.env.SITE_LASTMOD = "2026-08-20";
    const [entry] = sitemap();

    expect(entry.url).toBe("https://imesul-site.vercel.app");
    expect(entry.lastModified.toISOString()).toBe("2026-08-20T00:00:00.000Z");
  });

  it("robots aponta para o sitemap centralizado e não emite Host", () => {
    process.env.SITE_URL = "https://imesul-site.vercel.app";
    process.env.VERCEL_ENV = "production";
    const result = robots();

    expect(result.rules).toEqual({ userAgent: "*", allow: "/", disallow: undefined });
    expect(result.sitemap).toBe("https://imesul-site.vercel.app/sitemap.xml");
    expect(result.host).toBeUndefined();
  });

  it("omite lastModified em vez de usar uma data fixa quando SITE_LASTMOD não está definida", () => {
    delete process.env.SITE_LASTMOD;
    expect(getLastModifiedDate()).toBeUndefined();

    process.env.SITE_URL = "https://imesul-site.vercel.app";
    const [entry] = sitemap();
    expect(entry.lastModified).toBeUndefined();
    expect(Object.hasOwn(entry, "lastModified")).toBe(false);
  });
});
