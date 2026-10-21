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
          800: "#2d3333",
          900: "#262b2b",
          950: "#161919",
        },
        accent: {
          purple: "#7c3aed",
          indigo: "#4f46e5",
          pink: "#ec4899",
          emerald: "#10b981",
        }
      },
      borderRadius: {
        lg: "var(--radius, 0.5rem)",
        md: "calc(var(--radius, 0.5rem) - 2px)",
        sm: "calc(var(--radius, 0.5rem) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
