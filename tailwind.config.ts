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
        // Primary blue palette
        primary: {
          900: "#0B3D91",
          800: "#14509E",
          700: "#1E5FCC",
          600: "#3474D4",
          500: "#4A90E2",
          400: "#6BA5EA",
          300: "#93BFF0",
          200: "#BDD7F6",
          100: "#EEF4FC",
        },
        // Ink (dark greys — used as backgrounds in dark theme)
        ink: {
          900: "#0A0A0A",
          800: "#141414",
          700: "#1F2933",
          600: "#3B4754",
          500: "#5A6775",
          400: "#7B8794",
          300: "#9AA5B1",
          200: "#CBD2D9",
          100: "#E4E7EB",
        },
        // Surface — light backgrounds (unused in dark theme but kept for parity)
        surface: {
          0: "#FFFFFF",
          1: "#F6F9FD",
          2: "#EDF1F7",
        },
        // Semantic
        success: {
          DEFAULT: "#0E7C3A",
          light: "#E6F4EC",
        },
        warning: {
          DEFAULT: "#B54708",
          light: "#FFF4E5",
        },
        danger: {
          DEFAULT: "#B42318",
          light: "#FEF3F2",
        },
        // Brand accent
        gold: {
          DEFAULT: "#C9A96E",
          light: "#F5EDE0",
          dark: "#8B6914",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1.5" }],
        sm: ["0.875rem", { lineHeight: "1.5" }],
        base: ["1rem", { lineHeight: "1.5" }],
        lg: ["1.125rem", { lineHeight: "1.4" }],
        xl: ["1.25rem", { lineHeight: "1.35" }],
        "2xl": ["1.5rem", { lineHeight: "1.3" }],
        "3xl": ["1.875rem", { lineHeight: "1.2" }],
        "4xl": ["2.25rem", { lineHeight: "1.15" }],
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
        full: "9999px",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(0,0,0,0.4)",
        sm: "0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.4)",
        md: "0 4px 6px -1px rgba(0,0,0,0.5), 0 2px 4px -2px rgba(0,0,0,0.4)",
        lg: "0 10px 15px -3px rgba(0,0,0,0.5), 0 4px 6px -4px rgba(0,0,0,0.3)",
        xl: "0 20px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.3)",
        glow: "0 0 20px rgba(30,95,204,0.25)",
      },
      transitionDuration: {
        micro: "120ms",
        standard: "200ms",
        emphatic: "320ms",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          "0%": { opacity: "0", transform: "translateX(-16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "toast-in": {
          "0%": { opacity: "0", transform: "translateX(100%)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "toast-out": {
          "0%": { opacity: "1", transform: "translateX(0)" },
          "100%": { opacity: "0", transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out forwards",
        "slide-in-left": "slide-in-left 0.3s ease-out forwards",
        "scale-in": "scale-in 0.2s ease-out forwards",
        shimmer: "shimmer 1.5s linear infinite",
        "toast-in": "toast-in 0.3s ease-out forwards",
        "toast-out": "toast-out 0.2s ease-in forwards",
      },
    },
  },
  plugins: [],
};

export default config;
