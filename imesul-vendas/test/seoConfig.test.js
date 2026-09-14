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

  it("em desenvolvimento, sem SITE_URL configurada, cai no localhost do próprio site", () => {
    delete process.env.SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NODE_ENV = "development";
    expect(getSiteUrl()).toBe("http://localhost:3000");
  });

  it("em produção, sem SITE_URL configurada, falha alto e claro em vez de cair num host antigo", () => {
    delete process.env.SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NODE_ENV = "production";
    expect(() => getSiteUrl()).toThrow(/SITE_URL/);
  });

  it("nunca retorna um domínio vercel.app em nenhum cenário", () => {
    delete process.env.SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NODE_ENV = "development";
    expect(getSiteUrl()).not.toMatch(/vercel\.app/);
  });

  it("não indexa preview/homologação", () => {
    process.env.SITE_ENV = "preview";
    expect(getRobotsPolicy()).toEqual({ index: false, follow: false });
  });

  it("sem SITE_ENV configurada, cai em noindex por padrão (postura segura)", () => {
    delete process.env.SITE_ENV;
    expect(getRobotsPolicy()).toEqual({ index: false, follow: false });
  });

  it("mantém produção indexável só com SITE_ENV=production explícito", () => {
    process.env.SITE_ENV = "production";
    expect(getRobotsPolicy()).toEqual({ index: true, follow: true });
  });

  it("NEXT_PUBLIC_NOINDEX=true força noindex mesmo com SITE_ENV=production", () => {
    process.env.SITE_ENV = "production";
    process.env.NEXT_PUBLIC_NOINDEX = "true";
    expect(getRobotsPolicy()).toEqual({ index: false, follow: false });
  });

  it("gera sitemap com URL central e lastmod estável", () => {
    process.env.SITE_URL = "https://www.exemplo.com.br";
    process.env.SITE_LASTMOD = "2026-08-20";
    const [entry] = sitemap();

    expect(entry.url).toBe("https://www.exemplo.com.br");
    expect(entry.lastModified.toISOString()).toBe("2026-08-20T00:00:00.000Z");
  });

  it("robots aponta para o sitemap centralizado e não emite Host", () => {
    process.env.SITE_URL = "https://www.exemplo.com.br";
    process.env.SITE_ENV = "production";
    const result = robots();

    expect(result.rules).toEqual({ userAgent: "*", allow: "/", disallow: undefined });
    expect(result.sitemap).toBe("https://www.exemplo.com.br/sitemap.xml");
    expect(result.host).toBeUndefined();
  });

  it("omite lastModified em vez de usar uma data fixa quando SITE_LASTMOD não está definida", () => {
    delete process.env.SITE_LASTMOD;
    expect(getLastModifiedDate()).toBeUndefined();

    process.env.SITE_URL = "https://www.exemplo.com.br";
    const [entry] = sitemap();
    expect(entry.lastModified).toBeUndefined();
    expect(Object.hasOwn(entry, "lastModified")).toBe(false);
  });
});
