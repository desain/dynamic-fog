import { defineConfig } from "vite";
import { resolve } from "path";
import react from "@vitejs/plugin-react";
import mkcert from "vite-plugin-mkcert";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), mkcert()],
  server: {
      cors: true,
  },
  build: {
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        menu: resolve(__dirname, "menu.html"),
        background: resolve(__dirname, "background.html"),
      },
    },
  },
});
