import type { Plugin } from "vite";

export interface InlineHtmlAsset {
  readonly fileName: string;
  readonly source: string;
  readonly kind: "script" | "style";
}

export interface InlineHtmlResult {
  readonly html: string;
  readonly inlinedFileNames: readonly string[];
}

function normalizeAssetReference(reference: string): string {
  return reference.replace(/^\.\//, "").replace(/^\//, "");
}

function findInlineAsset(assets: readonly InlineHtmlAsset[], reference: string, kind: InlineHtmlAsset["kind"]): InlineHtmlAsset | undefined {
  const normalizedReference = normalizeAssetReference(reference);

  return assets.find((asset) => asset.kind === kind && asset.fileName === normalizedReference);
}

export function inlineHtmlAssets(html: string, assets: readonly InlineHtmlAsset[]): InlineHtmlResult {
  const inlined = new Set<string>();
  let output = html.replace(/<link\s+[^>]*rel=["']modulepreload["'][^>]*>/g, "");

  output = output.replace(/<script\s+([^>]*?)src=["']([^"']+)["']([^>]*)><\/script>/g, (tag, beforeAttributes, source, afterAttributes) => {
    const asset = findInlineAsset(assets, source, "script");

    if (!asset) {
      return tag;
    }

    inlined.add(asset.fileName);
    const attributes = `${beforeAttributes} ${afterAttributes}`.replace(/\s*crossorigin(?:=["'][^"']*["'])?/, "").trim();
    const attributeText = attributes.length > 0 ? ` ${attributes}` : "";

    return `<script${attributeText}>\n${asset.source}\n</script>`;
  });

  output = output.replace(/<link\s+([^>]*?)rel=["']stylesheet["']([^>]*?)href=["']([^"']+)["']([^>]*)>/g, (tag, beforeAttributes, middleAttributes, href) => {
    const asset = findInlineAsset(assets, href, "style");

    if (!asset) {
      return tag;
    }

    inlined.add(asset.fileName);
    const mediaMatch = `${beforeAttributes} ${middleAttributes}`.match(/\smedia=["']([^"']+)["']/);
    const mediaAttribute = mediaMatch ? ` media="${mediaMatch[1]}"` : "";

    return `<style${mediaAttribute}>\n${asset.source}\n</style>`;
  });

  output = output.replace(/<link\s+([^>]*?)href=["']([^"']+)["']([^>]*?)rel=["']stylesheet["']([^>]*)>/g, (tag, beforeAttributes, href, middleAttributes) => {
    const asset = findInlineAsset(assets, href, "style");

    if (!asset) {
      return tag;
    }

    inlined.add(asset.fileName);
    const mediaMatch = `${beforeAttributes} ${middleAttributes}`.match(/\smedia=["']([^"']+)["']/);
    const mediaAttribute = mediaMatch ? ` media="${mediaMatch[1]}"` : "";

    return `<style${mediaAttribute}>\n${asset.source}\n</style>`;
  });

  return { html: output, inlinedFileNames: [...inlined] };
}

function sourceToString(source: string | Uint8Array): string {
  return typeof source === "string" ? source : new TextDecoder().decode(source);
}

export function createInlineHtmlPlugin(): Plugin {
  return {
    name: "git-snitch-inline-html",
    enforce: "post",
    generateBundle(_options, bundle) {
      type BundleAsset = Extract<(typeof bundle)[string], { type: "asset" }>;

      const htmlEntries: { readonly fileName: string; readonly asset: BundleAsset }[] = [];
      const assets: InlineHtmlAsset[] = [];

      for (const [fileName, entry] of Object.entries(bundle)) {
        if (entry.type === "chunk") {
          assets.push({ fileName: entry.fileName, source: entry.code, kind: "script" });
        }

        if (entry.type === "asset" && entry.fileName.endsWith(".css")) {
          assets.push({ fileName: entry.fileName, source: sourceToString(entry.source), kind: "style" });
        }

        if (entry.type === "asset" && entry.fileName.endsWith(".html")) {
          htmlEntries.push({ fileName, asset: entry });
        }
      }

      if (htmlEntries.length !== 1) {
        throw new Error(`Expected exactly one HTML asset to inline, found ${htmlEntries.length}.`);
      }

      const htmlEntry = htmlEntries[0];

      if (!htmlEntry) {
        throw new Error("Expected one HTML asset to inline, but none was available after validation.");
      }

      const result = inlineHtmlAssets(sourceToString(htmlEntry.asset.source), assets);
      htmlEntry.asset.source = result.html;

      for (const fileName of result.inlinedFileNames) {
        delete bundle[fileName];
      }

      if (htmlEntry.fileName !== "report-template.html") {
        throw new Error(`Expected Vite to emit report-template.html, received ${htmlEntry.fileName}.`);
      }
    },
  };
}
