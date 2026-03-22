import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sand: "#f5efe3",
        clay: "#c96841",
        loam: "#73594a",
        moss: "#6f845d",
        pine: "#305847",
        cream: "#fffdf8"
      },
      boxShadow: {
        soft: "0 18px 45px rgba(42, 56, 41, 0.12)"
      },
      borderRadius: {
        "4xl": "2rem"
      },
      fontFamily: {
        display: ['"Palatino Linotype"', '"Book Antiqua"', "Georgia", "serif"],
        body: ['"Trebuchet MS"', '"Segoe UI"', "sans-serif"]
      }
    }
  },
  plugins: []
} satisfies Config;
