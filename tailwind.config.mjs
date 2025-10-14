/** @type {import('tailwindcss').Config} */
import forms from "@tailwindcss/forms";
import typography from "@tailwindcss/typography";

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
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: '#374151',
            h1: {
              color: '#1B2A41',
            },
            h2: {
              color: '#1B2A41',
            },
            h3: {
              color: '#1B2A41',
            },
            h4: {
              color: '#1B2A41',
            },
            strong: {
              color: '#1B2A41',
            },
            a: {
              color: '#F4A261',
              '&:hover': {
                color: '#e89441',
              },
            },
            blockquote: {
              borderLeftColor: '#F4A261',
              color: '#374151',
            },
            code: {
              color: '#1B2A41',
              backgroundColor: '#f3f4f6',
            },
          },
        },
      },
    },
  },
  plugins: [
    forms,
    typography,
  ],
};
