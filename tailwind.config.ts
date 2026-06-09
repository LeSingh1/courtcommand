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
          900: "#0b0b0c",
          800: "#121214",
          700: "#17171a",
          600: "#1d1d20",
          500: "#26262a",
          400: "#34343a",
        },
        // legacy accent keys collapsed to the restrained palette
        ember: { DEFAULT: "#e0561f", soft: "#e0561f", deep: "#c2470f", glow: "#e0561f" },
        cyan: { DEFAULT: "#7e8ca0", soft: "#7e8ca0", deep: "#6a7688" },
        gold: { DEFAULT: "#c9a14a", deep: "#b08a32" },
        mint: "#5fa97e",
        rose: "#bf5b4e",
        accent: "#e0561f",
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
