import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        brand: {
          DEFAULT: "#373E3E",
          50: "#f4f5f5",
          100: "#e5e7e7",
          200: "#ccd0d0",
          300: "#a9b1b1",
          400: "#7f8b8b",
          500: "#5d6a6a",
          600: "#485353",
          700: "#373E3E",
          800: "#232828",
          900: "#1a1e1e",
          950: "#111414",
        },
        slate: {
          850: "#141c2e",
          950: "#090d16",
        }
      },
      borderRadius: {
        lg: "var(--radius, 0.75rem)",
        md: "calc(var(--radius, 0.75rem) - 2px)",
        sm: "calc(var(--radius, 0.75rem) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;

