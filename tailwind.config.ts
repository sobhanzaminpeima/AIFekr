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
        primary: "var(--primary)",
        "primary-dark": "var(--primary-dark)",
        accent: "var(--accent)",
        surface: { DEFAULT: "var(--surface-0)", panel: "var(--surface-1)", elevated: "var(--surface-2)" },
        content: { DEFAULT: "var(--text-primary)", secondary: "var(--text-secondary)", muted: "var(--text-muted)" },
        stroke: "var(--border)",
      },
      borderRadius: { control: "var(--radius-md)", panel: "var(--radius-lg)", dialog: "var(--radius-xl)" },
      boxShadow: { panel: "var(--shadow-panel)", overlay: "var(--shadow-overlay)" },
      transitionDuration: { ui: "var(--duration-normal)" },
      transitionTimingFunction: { ui: "var(--ease-standard)" },
      fontFamily: {
        sans: ["var(--font-body)"],
      },
    },
  },
  plugins: [],
};
export default config;
