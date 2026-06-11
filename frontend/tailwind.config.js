/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Exact palette from reference image
        base:    "#0b0c0d",   // deep space background
        surface: "#18191b",   // card bg
        raised:  "#202224",   // elevated card
        border:  "#272a2d",   // subtle border
        ring:    "#333333",   // focused ring
        // Accents
        lime:    "#b4f74d",   // intense neon lime
        orange:  "#ff8c00",   // neon orange
        // Text
        hi:      "#ffffff",
        mid:     "#a1a1aa",
        lo:      "#71717a",
        muted:   "#3f3f46",
        // Status aliases
        healthy: "#b4f74d",
        warning: "#ff8c00",
        danger:  "#ef4444",
        offline: "#52525b",
      },
      fontFamily: {
        sans:  ["'DM Sans'", "system-ui", "sans-serif"],
        mono:  ["'JetBrains Mono'", "monospace"],
        head:  ["'DM Sans'", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "20px",
        pill: "999px",
        btn:  "12px",
        icon: "50%",
      },
      boxShadow: {
        card: "0 0 0 1px rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.4)",
        lime: "0 0 20px rgba(168,230,61,0.25)",
        orange: "0 0 20px rgba(249,115,22,0.25)",
      },
      keyframes: {
        pulse2: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.4" } },
        fadeUp: { from: { opacity: "0", transform: "translateY(12px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        countUp: { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        shimmer: { from: { backgroundPosition: "-200% 0" }, to: { backgroundPosition: "200% 0" } },
      },
      animation: {
        pulse2: "pulse2 2s ease-in-out infinite",
        fadeUp: "fadeUp 0.4s ease-out forwards",
        countUp: "countUp 0.5s ease-out forwards",
        shimmer: "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [],
};
