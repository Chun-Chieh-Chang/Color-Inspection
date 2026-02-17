/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "art-bg": "#0f172a", // Slate 900
        "art-card": "rgba(30, 41, 59, 0.7)", // Slate 800 with opacity
        "art-accent": "#38bdf8", // Sky 400
        "art-success": "#4ade80", // Green 400
        "art-fail": "#f87171", // Red 400
        "art-text": "#f8fafc", // Slate 50
        "art-muted": "#94a3b8", // Slate 400
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};
