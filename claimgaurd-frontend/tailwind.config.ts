import type { Config } from "tailwindcss";
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}","./components/**/*.{ts,tsx}","./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { primary: "#1e3a5f", secondary: "#2563eb", accent: "#0ea5e9" },
        risk: { low: "#16a34a", medium: "#ca8a04", high: "#ea580c", critical: "#dc2626" },
        status: {
          approved: "#16a34a", declined: "#dc2626", in_review: "#7c3aed",
          auto_approved: "#0ea5e9", auto_rejected: "#f97316", received: "#6b7280",
          processing: "#2563eb", closed: "#374151"
        }
      }
    }
  },
  plugins: []
};
export default config;