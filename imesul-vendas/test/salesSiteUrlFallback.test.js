import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// salesSiteUrl (imesul/data/products.js) alimenta lib/leadClient.js#createLead - é o destino real
// do POST de lead disparado por todos os CTAs "Falar no WhatsApp" do institucional. Por isso o
// valor é calculado no topo do módulo (não dentro de uma função), e o teste precisa resetar o
// registro de módulos + reimportar dinamicamente para cada cenário de env var (mesmo padrão já
// usado em test/handoffRouteHardening.test.js).
const originalEnv = { ...process.env };

describe("imesul/data/products.js#salesSiteUrl - sem fallback para hospedagem antiga", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("em desenvolvimento, sem NEXT_PUBLIC_SALES_URL, cai no localhost do site de vendas", async () => {
    delete process.env.NEXT_PUBLIC_SALES_URL;
    process.env.NODE_ENV = "development";
    const { salesSiteUrl } = await import("../../imesul/data/products.js");
    expect(salesSiteUrl).toBe("http://localhost:3001");
  });

  it("em produção, com NEXT_PUBLIC_SALES_URL configurada, usa exatamente o valor configurado", async () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_SALES_URL = "https://vendas.exemplo.com.br";
    const { salesSiteUrl } = await import("../../imesul/data/products.js");
    expect(salesSiteUrl).toBe("https://vendas.exemplo.com.br");
  });

  it("em produção, sem NEXT_PUBLIC_SALES_URL, falha alto e claro em vez de enviar lead para host desconhecido", async () => {
    delete process.env.NEXT_PUBLIC_SALES_URL;
    process.env.NODE_ENV = "production";
    await expect(import("../../imesul/data/products.js")).rejects.toThrow(/NEXT_PUBLIC_SALES_URL/);
  });

  it("nunca usa um domínio vercel.app como fallback em nenhum cenário", async () => {
    delete process.env.NEXT_PUBLIC_SALES_URL;
    process.env.NODE_ENV = "development";
    const { salesSiteUrl } = await import("../../imesul/data/products.js");
    expect(salesSiteUrl).not.toMatch(/vercel\.app/);
  });
});
