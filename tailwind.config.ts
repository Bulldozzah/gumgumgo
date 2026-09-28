import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#1DBF73",
          dark: "#19A463",
          darker: "#148A52",
          tint: "#E8F7F0",
        },
        ink: {
          DEFAULT: "#404145",
          heading: "#222325",
          muted: "#62646A",
          faint: "#95979D",
        },
        line: "#E4E5E7",
        canvas: "#FAFAFA",
        star: "#FFB33E",
      },
      fontFamily: {
        sans: [
          "Inter",
          "Macan",
          "Helvetica Neue",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 2px 8px rgba(0,0,0,0.06)",
        pop: "0 8px 24px rgba(0,0,0,0.12)",
      },
    },
  },
  plugins: [],
} satisfies Config;
