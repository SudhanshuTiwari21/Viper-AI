/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./ui/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        v: {
          bg: "var(--v-bg)",
          bg2: "var(--v-bg2)",
          text: "var(--v-text)",
          text2: "var(--v-text2)",
          text3: "var(--v-text3)",
          accent: "var(--v-accent)",
          success: "var(--v-success)",
          error: "var(--v-error)",
          warning: "var(--v-warning)",
          border: "var(--v-border)",
        },
        viper: {
          bg: "#0E0F11",
          panel: "#15171A",
          border: "rgba(255,255,255,0.06)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      fontSize: {
        "2xs": ["10px", "14px"],
        xs: ["12px", "16px"],
        sm: ["13px", "18px"],
        base: ["14px", "20px"],
        input: ["16px", "24px"],
      },
      animation: {
        "v-thinking": "v-thinking-dot 1.4s infinite ease-in-out both",
        "v-blink": "v-blink-cursor 1s step-end infinite",
        "v-fade-in": "v-fade-in 150ms ease-out forwards",
        "v-spin": "v-spin 1s linear infinite",
      },
      transitionTimingFunction: {
        "v-ease": "cubic-bezier(0.25, 0.1, 0.25, 1)",
      },
    },
  },
  plugins: [],
};
