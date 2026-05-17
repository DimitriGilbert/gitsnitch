import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

import { createInlineHtmlPlugin } from "./src/inline-plugin";

const packageDirectory = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: "./",
  build: {
    assetsInlineLimit: 0,
    cssCodeSplit: false,
    emptyOutDir: true,
    modulePreload: false,
    outDir: "dist/template",
    rollupOptions: {
      input: fileURLToPath(new URL("./report-template.html", import.meta.url)),
      output: {
        entryFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
  plugins: [tailwindcss(), viteReact(), createInlineHtmlPlugin()],
  resolve: {
    alias: {
      "@git-snitch/renderer": fileURLToPath(new URL("./src", import.meta.url)),
    },
    tsconfigPaths: true,
  },
  root: packageDirectory,
});
