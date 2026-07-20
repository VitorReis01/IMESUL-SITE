import "./globals.css";

// Define o titulo e a descricao usados em compartilhamento e mecanismos de busca.
export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SALES_SITE_URL || "https://imesul.com.br"),
  title: "Imesul Vendas | Materiais em aço para orçamento",
  description:
    "Escolha tubos, chapas, perfis, telhas, barras e acessórios. Envie sua solicitação para a equipe Imesul confirmar medida, disponibilidade e valor pelo WhatsApp.",
  keywords: [
    "tubos metálicos",
    "metalon",
    "perfis",
    "chapas",
    "telhas metálicas",
    "barras",
    "serralheria",
    "aço",
    "Imesul",
    "Dourados",
    "Campo Grande",
  ],
  openGraph: {
    title: "Imesul Vendas | Materiais em aço para orçamento",
    description:
      "Escolha materiais em aço e envie uma solicitação para confirmação de medida, disponibilidade e valor pelo WhatsApp.",
    images: [
      {
        url: "/logo/imesul-logo-completa.png",
        width: 707,
        height: 353,
        alt: "Imesul Distribuição",
      },
    ],
    locale: "pt_BR",
    type: "website",
  },
};

// Entrega a estrutura minima do App Router; a interacao fica no seletor principal.
export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="noise-overlay" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
