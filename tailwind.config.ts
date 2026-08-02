import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: "#1971c2",
        green: "#2f9e44",
        red: "#e03131",
      },
    },
  },
  plugins: [],
};
export default config;
