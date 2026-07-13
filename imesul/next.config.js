/** @type {import('next').NextConfig} */
const isDevelopment = process.env.NODE_ENV !== "production";
// Restringe os recursos que a pagina pode carregar e fica mais permissiva apenas no desenvolvimento.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  `connect-src 'self' https:${isDevelopment ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig = {
  // Libera os recursos internos do Next.js quando o site e aberto pelo celular na rede local.
  allowedDevOrigins: [
    "192.168.1.117",
    "http://192.168.1.117:3000",
  ],
  productionBrowserSourceMaps: false,
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
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
