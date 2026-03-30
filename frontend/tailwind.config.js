/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        accent: "var(--tg-theme-button-color, #007AFF)",
      },
    },
  },
  plugins: [],
};
