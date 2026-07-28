import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    // Vite blocks requests whose Host header isn't localhost or explicitly allowed, to
    // prevent DNS-rebinding attacks. ".ngrok-free.dev" (leading dot = wildcard) covers
    // any ngrok free-tier subdomain, so this doesn't need editing when the tunnel URL
    // changes on restart. Dev-only convenience -- not relevant once deployed for real.
    allowedHosts: [".ngrok-free.dev"],
    // Dev-only: forwards uploaded-media requests to the backend so BACKEND_URL can be
    // set to the same public ngrok URL as FRONTEND_URL. Facebook/Instagram's servers
    // fetch media_url directly -- "localhost:8000" means nothing to them, so without
    // this, uploaded images/videos are unreachable and publishing fails. In production,
    // BACKEND_URL is its own real domain (or STORAGE_BACKEND=r2) and this proxy is unused.
    proxy: {
      "/uploads": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
