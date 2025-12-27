import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Only load Replit plugins in development/Replit environment
const replitPlugins = process.env.NODE_ENV !== "production" && process.env.REPL_ID
  ? await Promise.all([
      import("@replit/vite-plugin-runtime-error-modal").then(m => m.default()),
      import("@replit/vite-plugin-cartographer").then(m => m.cartographer())
    ]).catch(() => [])
  : [];

export default defineConfig({
  plugins: [
    react(),
    ...replitPlugins
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
