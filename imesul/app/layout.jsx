import "./globals.css";

export const metadata = {
  title: "IMESUL Distribuição | Soluções em Aço",
  description:
    "Distribuidora de aço com grande estoque de tubos, chapas, telhas, perfis, cantoneiras, metalon, bobininhas, solventes e acessórios. Campo Grande e Dourados.",
  keywords:
    "distribuição de aço, tubos, chapas, telhas, perfis, cantoneiras, metalon, Campo Grande, Dourados",
  openGraph: {
    title: "IMESUL Distribuição | Soluções em Aço",
    description:
      "Soluções completas em aço para construção, indústria e serralheria.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <div className="noise-overlay" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
