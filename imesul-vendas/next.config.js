/** @type {import('next').NextConfig} */
const isDevelopment = process.env.NODE_ENV !== "production";
// Define as origens permitidas para scripts, fontes, imagens e conexoes da aplicacao.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://accounts.google.com https://accounts.gstatic.com${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob:",
  `connect-src 'self' blob: https://accounts.google.com https:${isDevelopment ? " ws: wss:" : ""}`,
  "frame-src 'self' https://accounts.google.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  // Evita que o Turbopack use o projeto vizinho como raiz do build.
  turbopack: {
    root: __dirname,
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
            // Geolocalizacao do dispositivo (Fase 2) so pode ser solicitada pela propria origem,
            // nunca por terceiros embutidos. Camera/microfone/pagamento continuam bloqueados.
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

module.exports = nextConfig;
