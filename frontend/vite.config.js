import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** У Telegram WebView часто кешують index.html; унікальний ?v= змушує завантажити новий JS/CSS. */
function cacheBustAssets() {
  const v = process.env.BUILD_ID || Date.now().toString(36);
  return {
    name: "html-cache-bust",
    transformIndexHtml(html) {
      return html.replace(/(src|href)="(\/assets\/[^"]+)"/g, `$1="$2?v=${v}"`);
    },
  };
}

export default defineConfig({
  plugins: [react(), cacheBustAssets()],
  base: "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
