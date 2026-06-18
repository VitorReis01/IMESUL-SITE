import "./globals.css";

export const metadata = {
  title: "Área de Vendas | IMESUL Distribuição",
  description:
    "Encontre materiais recomendados para seu projeto e prepare sua solicitação de orçamento com a IMESUL.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
