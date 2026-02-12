import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["pwa-icon.svg"],
      manifest: {
        name: "Drawing Companion",
        short_name: "DrawComp",
        description: "Compare real-life photos with your drawings.",
        theme_color: "#7b60ff",
        background_color: "#d9e7ff",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "pwa-icon.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "pwa-icon.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any"
          }
        ]
      },
      workbox: {
        navigateFallback: "/index.html",
        mode: "development",
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "document",
            handler: "NetworkFirst"
          },
          {
            urlPattern: ({ request }) =>
              ["script", "style", "worker"].includes(request.destination),
            handler: "StaleWhileRevalidate"
          }
        ]
      }
    })
  ]
});
