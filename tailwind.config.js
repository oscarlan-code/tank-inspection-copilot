/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17201e",
        panel: "#ffffff",
        field: "#f4f7f6",
        line: "#cbd8d4",
        teal: "#087f7a",
        tealDark: "#075f5c",
        mint: "#d9f2ea",
        caution: "#d28722",
        danger: "#c03a2b",
        repair: "#9168b7",
      },
      boxShadow: {
        soft: "0 14px 40px rgba(23, 32, 30, 0.08)",
      },
    },
  },
  plugins: [],
};
