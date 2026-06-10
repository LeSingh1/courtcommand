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
          900: "#0a0a0b",
          800: "#121214",
          700: "#18181b",
          600: "#1f1f23",
          500: "#28282d",
          400: "#34343a",
        },
        // legacy accent keys collapsed to the restrained palette
        ember: { DEFAULT: "#00e07f", soft: "#4deca3", deep: "#00b868", glow: "#00e07f" },
        cyan: { DEFAULT: "#41c7e0", soft: "#7fd9eb", deep: "#2aa4bb" },
        gold: { DEFAULT: "#d7bc6a", deep: "#b89c45" },
        mint: "#2bd68b",
        rose: "#f4647d",
        accent: "#00e07f",
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
