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
          900: "#0a0d12",
          800: "#10141b",
          700: "#161c26",
          600: "#1d2530",
          500: "#26303e",
          400: "#344052",
        },
        // legacy accent keys collapsed to the restrained palette
        ember: { DEFAULT: "#c8f23f", soft: "#d6f56b", deep: "#a8d420", glow: "#c8f23f" },
        cyan: { DEFAULT: "#5ed4f0", soft: "#8de2f5", deep: "#3eb8d8" },
        gold: { DEFAULT: "#e8c463", deep: "#cda83f" },
        mint: "#5fd49a",
        rose: "#f0697a",
        accent: "#c8f23f",
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
