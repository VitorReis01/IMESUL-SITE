import "./globals.css";
import { Barlow, Barlow_Condensed, Bebas_Neue, JetBrains_Mono } from "next/font/google";

// Carrega somente os pesos usados e publica cada familia como variavel CSS.
const displayFont = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

const bodyFont = Barlow({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const condensedFont = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-condensed",
  display: "swap",
  preload: false,
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
  preload: false,
});

// Centraliza a URL publica usada por canonical, compartilhamento e dados estruturados.
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://grupoimesul.com.br").replace(/\/$/, "");

// Metadata compartilhada por todas as rotas do site institucional.
export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "IMESUL Distribuição | Soluções em Aço",
    template: "%s | IMESUL Distribuição",
  },
  description:
    "Distribuidora de aço com grande estoque de tubos, chapas, telhas, perfis, cantoneiras, metalon, bobininhas, solventes e acessórios. Campo Grande e Dourados.",
  keywords:
    "distribuição de aço, tubos, chapas, telhas, perfis, cantoneiras, metalon, Campo Grande, Dourados",
  openGraph: {
    title: "IMESUL Distribuição | Soluções em Aço",
    description:
      "Soluções completas em aço para construção, indústria e serralheria.",
    url: siteUrl,
    siteName: "IMESUL Distribuição",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: "/logo/imesul-logo-completa.webp",
        width: 707,
        height: 353,
        alt: "IMESUL Distribuição",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "IMESUL Distribuição | Soluções em Aço",
    description: "Soluções completas em aço para construção, indústria e serralheria.",
    images: ["/logo/imesul-logo-completa.webp"],
  },
  alternates: { canonical: siteUrl },
  icons: { icon: "/logo/imesul-logo-completa.webp" },
  robots: { index: true, follow: true },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0A1628",
};

// Descreve a empresa e suas unidades para mecanismos de busca.
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "IMESUL Distribuição",
      url: siteUrl,
      logo: `${siteUrl}/logo/imesul-logo-completa.webp`,
    },
    {
      "@type": "LocalBusiness",
      "@id": `${siteUrl}/#campo-grande`,
      name: "IMESUL Distribuição - Campo Grande",
      parentOrganization: { "@id": `${siteUrl}/#organization` },
      telephone: "+55 67 3312-5600",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Av. Cel. Antonino, 1692 - Vila Lucinda",
        addressLocality: "Campo Grande",
        addressRegion: "MS",
        addressCountry: "BR",
      },
    },
    {
      "@type": "LocalBusiness",
      "@id": `${siteUrl}/#dourados`,
      name: "IMESUL Distribuição - Dourados",
      parentOrganization: { "@id": `${siteUrl}/#organization` },
      telephone: "+55 67 3427-5700",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Rua Pedro Rigotti, 258 - Jardim São Pedro",
        addressLocality: "Dourados",
        addressRegion: "MS",
        addressCountry: "BR",
      },
    },
  ],
};

// Aplica fontes, estilos globais e JSON-LD ao documento do App Router.
export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Injeta JSON-LD controlado pelo projeto; o replace evita fechamento acidental de script. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        />
      </head>
      <body className={`${displayFont.variable} ${bodyFont.variable} ${condensedFont.variable} ${monoFont.variable}`}>
        <div className="noise-overlay" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
