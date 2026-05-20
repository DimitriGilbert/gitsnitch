import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { createRequire } from "node:module";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

import { createInlineHtmlPlugin } from "./src/inline-plugin";

const packageDirectory = fileURLToPath(new URL(".", import.meta.url));
const defaultTemplateModule = fileURLToPath(new URL("./src/custom-templates.ts", import.meta.url));
const customTemplateModule = process.env.GIT_SNITCH_TEMPLATE_MODULE;

const require = createRequire(import.meta.url);

function resolvePackageModule(specifier: string): string {
  const entry = require.resolve(specifier);
  return entry;
}

function resolvePackageRoot(pkgName: string): string {
  const entry = require.resolve(pkgName);
  let dir = dirname(entry);
  while (basename(dir) !== pkgName && dirname(dir) !== dir) {
    dir = dirname(dir);
  }
  return dir;
}

const reactRoot = resolvePackageRoot("react");
const reactDomRoot = resolvePackageRoot("react-dom");

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
      react: resolve(reactRoot),
      "react/jsx-dev-runtime": resolvePackageModule("react/jsx-dev-runtime"),
      "react/jsx-runtime": resolvePackageModule("react/jsx-runtime"),
      "react-dom": resolve(reactDomRoot),
      "virtual:git-snitch-custom-templates": customTemplateModule ?? defaultTemplateModule,
    },
    tsconfigPaths: true,
  },
  root: packageDirectory,
});
