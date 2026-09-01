/** @type {import('next').NextConfig} */
const { withSentryConfig } = require("@sentry/nextjs");

const isDevelopment = process.env.NODE_ENV !== "production";

// Configura o build do site institucional e os headers aplicados em produção.
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Restringe os recursos que a pagina pode carregar e fica mais permissiva apenas no desenvolvimento.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://connect.facebook.net${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https://www.facebook.com https://www.google-analytics.com",
  "media-src 'self' blob:",
  // Antes era "https:" (qualquer origem HTTPS) - reduzido para a allowlist real usada por GA4
  // (gtag/collect), Meta Pixel e Sentry (ver components/TrackingScripts.jsx e sentry.*.config.js).
  // Não verificado com tracking ligado de verdade neste ambiente (NEXT_PUBLIC_TRACKING_ENABLED=
  // false por padrão) - conferir em preview com tracking habilitado antes de considerar validado
  // (ver relatório de hardening, seção CSP).
  `connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://connect.facebook.net https://www.facebook.com https://*.sentry.io https://*.ingest.sentry.io${isDevelopment ? " ws: wss:" : ""}`,
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
