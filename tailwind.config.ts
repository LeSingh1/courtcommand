import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // neutral surfaces aligned to the CSS variables
        ink: {
          900: "#0e0d0b",
          800: "#15130f",
          700: "#1c1915",
          600: "#242019",
          500: "#2e2920",
          400: "#3c352a",
        },
        // legacy accent keys collapsed to the restrained palette
        ember: { DEFAULT: "#e9a23b", soft: "#f0b765", deep: "#c9831f", glow: "#e9a23b" },
        cyan: { DEFAULT: "#9fb6c4", soft: "#b8cad5", deep: "#829aa9" },
        gold: { DEFAULT: "#cbb280", deep: "#b09659" },
        mint: "#a3b79a",
        rose: "#c98a78",
        accent: "#e9a23b",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
