import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: "#a8823c",
        ink: "#12233f",
        green: "#2f6f52",
        red: "#9b3b3b",
      },
    },
  },
  plugins: [],
};
export default config;
