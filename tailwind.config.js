/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        gw: {
          red: "#C8102E",
          "red-dark": "#9A0E26",
          "red-light": "#E63946",
          navy: "#0F1B2D",
          "navy-mid": "#1F2D43",
          cream: "#FAF7F2",
          gold: "#D4A017",
        },
      },
    },
  },
  plugins: [],
};
