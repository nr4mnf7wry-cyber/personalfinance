import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          200: "#b3ccff",
          300: "#82abff",
          400: "#5586ff",
          500: "#3563e9",
          600: "#2547c0",
          700: "#1d3899",
          800: "#1c2f78",
          900: "#1b2a5f",
        },
        income: "#2f9e6b",
        expense: "#d1495b",
        savings: "#3563e9",
        variable: "#e0a12b",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
