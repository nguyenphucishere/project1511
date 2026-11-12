import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    // Replace (not extend) colours so stray Tailwind palette classes like bg-red-500 don't exist.
    colors: {
      transparent: "transparent",
      current: "currentColor",
      "space-deep": token("space-deep"),
      "space-blue": token("space-blue"),
      "space-mist": token("space-mist"),
      "space-gold": token("space-gold"),
      "space-orange": token("space-orange"),
      background: token("background"),
      surface: token("surface"),
      foreground: token("foreground"),
      muted: token("muted"),
      primary: {
        DEFAULT: token("primary"),
        foreground: token("primary-foreground"),
      },
      warning: token("warning"),
      border: token("border"),
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      // Type scale after Bringhurst's classic sequence.
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.625rem" }],
        xl: ["1.3125rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.5rem", { lineHeight: "2rem" }],
        "3xl": ["2.25rem", { lineHeight: "2.5rem", letterSpacing: "-0.01em" }],
        "4xl": ["3rem", { lineHeight: "3.25rem", letterSpacing: "-0.02em" }],
        "5xl": ["4.5rem", { lineHeight: "4.5rem", letterSpacing: "-0.025em" }],
      },
      borderRadius: {
        DEFAULT: "0",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        // Countdown digit: arrives slightly large and settles (ease-out), once per second.
        "count-pop": { from: { transform: "scale(1.18)", opacity: "0.55" }, to: { transform: "scale(1)", opacity: "1" } },
        // Anomaly alarm: a single orange flash that fades back to nothing.
        "alarm-flash": { "0%": { opacity: "0" }, "15%": { opacity: "1" }, "100%": { opacity: "0" } },
      },
      animation: {
        "fade-in": "fade-in 200ms ease-out",
        "count-pop": "count-pop 320ms cubic-bezier(0.22, 1, 0.36, 1)",
        "alarm-flash": "alarm-flash 1100ms ease-out forwards",
      },
    },
  },
  plugins: [animate],
};

export default config;
