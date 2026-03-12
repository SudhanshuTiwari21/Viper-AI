/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./ui/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        viper: {
          bg: "#0d0d0d",
          panel: "#171717",
          border: "rgba(255,255,255,0.06)",
        },
      },
    },
  },
  plugins: [],
};
