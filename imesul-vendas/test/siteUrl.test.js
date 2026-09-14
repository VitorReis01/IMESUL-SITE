import { afterEach, describe, expect, it } from "vitest";
import { getInstitutionalSiteUrl, getRobotsPolicy, getSalesSiteUrl } from "../lib/siteUrl";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("lib/siteUrl - política de indexação", () => {
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
});

describe("lib/siteUrl - sem fallback para hospedagem antiga", () => {
  it("getSalesSiteUrl: em desenvolvimento, sem configuração, cai no localhost do próprio site", () => {
    delete process.env.SALES_SITE_URL;
    delete process.env.NEXT_PUBLIC_SALES_SITE_URL;
    process.env.NODE_ENV = "development";
    expect(getSalesSiteUrl()).toBe("http://localhost:3000");
  });

  it("getSalesSiteUrl: em produção, sem configuração, falha alto e claro", () => {
    delete process.env.SALES_SITE_URL;
    delete process.env.NEXT_PUBLIC_SALES_SITE_URL;
    process.env.NODE_ENV = "production";
    expect(() => getSalesSiteUrl()).toThrow(/SALES_SITE_URL/);
  });

  it("getInstitutionalSiteUrl: em desenvolvimento, sem configuração, cai no localhost do institucional", () => {
    delete process.env.NEXT_PUBLIC_INSTITUTIONAL_SITE_URL;
    delete process.env.NEXT_PUBLIC_INSTITUTIONAL_URL;
    process.env.NODE_ENV = "development";
    expect(getInstitutionalSiteUrl()).toBe("http://localhost:3000");
  });

  it("getInstitutionalSiteUrl: em produção, sem configuração, falha alto e claro", () => {
    delete process.env.NEXT_PUBLIC_INSTITUTIONAL_SITE_URL;
    delete process.env.NEXT_PUBLIC_INSTITUTIONAL_URL;
    process.env.NODE_ENV = "production";
    expect(() => getInstitutionalSiteUrl()).toThrow(/NEXT_PUBLIC_INSTITUTIONAL_SITE_URL/);
  });

  it("nenhuma das duas retorna um domínio vercel.app em nenhum cenário", () => {
    delete process.env.SALES_SITE_URL;
    delete process.env.NEXT_PUBLIC_SALES_SITE_URL;
    delete process.env.NEXT_PUBLIC_INSTITUTIONAL_SITE_URL;
    delete process.env.NEXT_PUBLIC_INSTITUTIONAL_URL;
    process.env.NODE_ENV = "development";
    expect(getSalesSiteUrl()).not.toMatch(/vercel\.app/);
    expect(getInstitutionalSiteUrl()).not.toMatch(/vercel\.app/);
  });
});
