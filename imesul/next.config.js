/** @type {import('next').NextConfig} */
const { withSentryConfig } = require("@sentry/nextjs");

const isDevelopment = process.env.NODE_ENV !== "production";

// Configura o build do site institucional e os headers aplicados em produção.
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Origem do site de vendas (mesma fonte usada por data/products.js#salesSiteUrl) - o CSP precisa
// liberar exatamente essa origem no connect-src, senao o fetch cross-origin de
// lib/leadClient.js#createLead (usado por TODOS os CTAs "Falar no WhatsApp" do institucional)
// e bloqueado pelo proprio navegador antes de sair da pagina. Achado na homologacao final da
// Preview: nenhum teste anterior tinha exercitado esse fetch por um navegador real (curl/Node
// fetch nao aplicam CSP), entao o gap ficou invisivel desde a rodada de hardening que reduziu
// connect-src de "https:" para uma allowlist explicita.
const salesSiteOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SALES_URL || "https://imesul-vendas.vercel.app/").origin;
  } catch {
    return "https://imesul-vendas.vercel.app";
  }
})();

// Restringe os recursos que a pagina pode carregar e fica mais permissiva apenas no desenvolvimento.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://connect.facebook.net${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https://www.facebook.com https://www.google-analytics.com",
  "media-src 'self' blob:",
  `connect-src 'self' ${salesSiteOrigin} https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://connect.facebook.net https://www.facebook.com https://*.sentry.io https://*.ingest.sentry.io${isDevelopment ? " ws: wss:" : ""}`,
  "frame-src 'self' https://www.facebook.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://www.facebook.com",
  "object-src 'none'",
].join("; ");

const nextConfig = {
  // Permite informar origens locais de desenvolvimento sem versionar IP da rede.
  allowedDevOrigins,
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  // Mantem o Turbopack limitado a este projeto dentro do repositorio compartilhado.
  turbopack: {
    root: __dirname,
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Aplica a mesma protecao basica a todas as rotas publicas.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            // geolocation=(self): permite o botão "Usar minha localização" do UnitPickerModal
            // (sempre por clique explícito do usuário, nunca automático - ver lib/consent.js).
            // Continua bloqueado para qualquer terceiro/iframe (não é "*").
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), payment=()",
          },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  dryRun: !process.env.SENTRY_AUTH_TOKEN,
  hideSourceMaps: true,
});
