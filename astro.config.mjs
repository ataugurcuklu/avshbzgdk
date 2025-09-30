// @ts-check
import { defineConfig } from "astro/config";

import node from "@astrojs/node";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";
import preact from "@astrojs/preact";

// https://astro.build/config
export default defineConfig({
  base: "/",
  site: "https://sahbazgedik.av.tr", // Set the production site URL
  integrations: [tailwind(), mdx(), preact()],
  output: "server",
  adapter: node({
    mode: "middleware",
  }),
  server: {
    host: "0.0.0.0", // Bind to all interfaces
    port: 4321,
  },
  vite: {
    server: {
      cors: {
        origin: [
          "http://localhost:4321",
          "http://localhost:3000",
          "https://sahbazgedik.av.tr",
          "http://sahbazgedik.av.tr",
          "https://www.sahbazgedik.av.tr",
          "http://www.sahbazgedik.av.tr"
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
      },
    },
    build: {
      rollupOptions: {
        external: ['bun:sqlite']
      }
    }
  },
  // Security configuration for reverse proxy
  security: {
    checkOrigin: false, // Disable origin checking for reverse proxy setups
  }
});