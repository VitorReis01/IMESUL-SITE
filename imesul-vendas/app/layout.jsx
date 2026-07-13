import "./globals.css";

// Define o titulo e a descricao usados em compartilhamento e mecanismos de busca.
export const metadata = {
  title: "Área de Vendas | IMESUL Distribuição",
  description:
    "Encontre materiais recomendados para seu projeto e prepare sua solicitação de orçamento com a IMESUL.",
};

// Entrega a estrutura minima do App Router; a interacao fica no seletor principal.
export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
