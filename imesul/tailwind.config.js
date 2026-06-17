/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./app/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        imesul: {
          red: "#D42B2B",
          "red-dark": "#A81E1E",
          "red-light": "#FF3B3B",
          blue: "#0A1628",
          "blue-mid": "#0D1F3C",
          "blue-light": "#112649",
          steel: "#8BA0B4",
          "steel-light": "#C8D8E8",
          white: "#F0F4F8",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        "noise": "url('/noise.png')",
        "steel-gradient": "linear-gradient(135deg, #0A1628 0%, #0D1F3C 50%, #0A1628 100%)",
        "red-glow": "radial-gradient(ellipse at center, rgba(212,43,43,0.15) 0%, transparent 70%)",
      },
      animation: {
        "pulse-red": "pulseRed 3s ease-in-out infinite",
        "scan": "scan 4s linear infinite",
        "flicker": "flicker 6s ease-in-out infinite",
      },
      keyframes: {
        pulseRed: {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "92%": { opacity: "1" },
          "93%": { opacity: "0.8" },
          "94%": { opacity: "1" },
          "96%": { opacity: "0.9" },
          "97%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
