import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        sidebar: "var(--sidebar)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        border: "var(--border)",
        hover: "var(--hover)",
        active: "var(--active)",
      },
    },
  },
  plugins: [],
  logLevel: "debug"
} satisfies Config;
