import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "localhost",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
        // keep path as-is (/api/... -> /api/...)
        rewrite: (path) => path,
        // harmless in dev; if Django ever sets Domain on cookies, rewrite to localhost
        cookieDomainRewrite: "localhost",
      },
      "/media": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
