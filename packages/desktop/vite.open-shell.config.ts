import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "vendor/open-claude-desktop/app");

export default defineConfig({
  root,
  configFile: resolve(root, "vite.config.js"),
  base: "./",
  resolve: {
    preserveSymlinks: false,
    alias: {},
  },
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
  build: { outDir: resolve(root, "dist"), emptyOutDir: false },
});
