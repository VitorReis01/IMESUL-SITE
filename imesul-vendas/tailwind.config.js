/** @type {import('tailwindcss').Config} */
module.exports = {
  // Inclui dados porque alguns modulos mantem classes associadas ao catalogo.
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}", "./data/**/*.{js,jsx}"],
  theme: {
    extend: {
      // Mantem a Area de Vendas na mesma identidade do site institucional.
      colors: {
        imesul: {
          red: "#D42B2B",
          "red-dark": "#A81E1E",
          blue: "#07101D",
          "blue-mid": "#0B192B",
          steel: "#8BA0B4",
          "steel-light": "#C8D8E8",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        condensed: ["var(--font-condensed)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
