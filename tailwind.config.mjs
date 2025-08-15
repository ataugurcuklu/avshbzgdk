/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        "law-primary": "#1B2A41",
        "law-secondary": "#3A506B",
        "law-accent": "#F4A261",
      },
      fontFamily: {
        serif: ["Crimson Pro", "serif"],
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
