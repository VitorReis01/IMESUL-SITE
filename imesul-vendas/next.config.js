/** @type {import('next').NextConfig} */
const { withSentryConfig } = require("@sentry/nextjs");

const isDevelopment = process.env.NODE_ENV !== "production";
// Define as origens permitidas para scripts, fontes, imagens e conexoes da aplicacao.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://accounts.google.com https://accounts.gstatic.com https://www.googletagmanager.com https://connect.facebook.net${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob:",
  // Antes era "https:" (qualquer origem HTTPS) - reduzido para a allowlist real usada por GA4
  // (gtag/collect), Meta Pixel, Google Identity e Sentry (ver components/TrackingScripts.jsx e
  // sentry.*.config.js). Não verificado com tracking ligado de verdade neste ambiente
  // (NEXT_PUBLIC_TRACKING_ENABLED=false por padrão) - conferir em preview com tracking habilitado
  // antes de considerar validado (ver relatório de hardening, seção CSP).
  `connect-src 'self' blob: https://accounts.google.com https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://www.google.com https://stats.g.doubleclick.net https://www.googletagmanager.com https://connect.facebook.net https://www.facebook.com https://d3-36c34dc0877246a0b32c4f4e24be6ce8.ecs.us-east-1.on.aws https://bded8a3c6ae-1-1053047382554.us-central1.run.app https://*.sentry.io https://*.ingest.sentry.io${isDevelopment ? " ws: wss:" : ""}`,
  "frame-src 'self' https://accounts.google.com https://www.facebook.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://www.facebook.com",
  "object-src 'none'",
].join("; ");

const nextConfig = {
  // Gera um bundle server.js autocontido em .next/standalone (traced deps + server minimo) -
  // necessario para rodar em cPanel/Passenger, que nao usa a infraestrutura serverless da Vercel.
  // Nao copia public/ nem .next/static automaticamente (comportamento documentado do Next.js) -
  // ver scripts/prepare-standalone.mjs, que copia os dois apos o build.
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  // Evita que o Turbopack use o projeto vizinho como raiz do build.
  turbopack: {
    root: __dirname,
  },
  // A hospedagem cPanel (npm run build:cpanel, com --webpack) bloqueava os workers padrao do
  // Next (EAGAIN ao tentar abrir ~31 processos) - limitar a 1 evita o erro nesse ambiente.
  // Nao afeta o build normal (Vercel/local), que roda com Turbopack.
  experimental: {
    cpus: 1,
  },
  // Os headers valem para a pagina, rotas de erro e assets servidos pelo Next.js.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            // Geolocalização só pela própria origem; câmera, microfone e pagamento bloqueados.
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), payment=()",
          },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Documentos/RSC nunca cacheados entre deploys - troca de standalone apaga os chunks do
          // build anterior (ver scripts/prepare-standalone.mjs), e um HTML/manifest antigo em cache
          // navegando contra o build novo produz "TypeError: l[e] is not a function" ao buscar um
          // chunk que nao existe mais. Assets com hash em /_next/static ficam imutaveis (regra abaixo).
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
      {
        // Nome do arquivo ja inclui hash de conteudo - pode ficar cacheado pelo tempo maximo.
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
  // Preserva a rota antiga apos renomear "Consumiveis" para "Eletrodo".
  async redirects() {
    return [
      {
        source: "/materiais/acessorios/consumiveis",
        destination: "/materiais/acessorios/eletrodo",
        permanent: true,
      },
    ];
  },
};

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  dryRun: !process.env.SENTRY_AUTH_TOKEN,
  hideSourceMaps: true,
});
