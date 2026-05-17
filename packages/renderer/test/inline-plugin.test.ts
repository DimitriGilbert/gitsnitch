import { describe, expect, it } from "vitest";

import { inlineHtmlAssets } from "../src/inline-plugin";

describe("inline HTML asset behavior", () => {
  it("inlines scripts and stylesheets and removes module preload references", () => {
    const html = [
      "<html><head>",
      '<link rel="modulepreload" href="./assets/index.js">',
      '<link rel="stylesheet" href="./assets/index.css">',
      "</head><body>",
      '<script type="module" crossorigin src="./assets/index.js"></script>',
      "</body></html>",
    ].join("");

    const result = inlineHtmlAssets(html, [
      { fileName: "assets/index.css", kind: "style", source: "body{color:red}" },
      { fileName: "assets/index.js", kind: "script", source: "window.reportLoaded=true;" },
    ]);

    expect(result.html).toContain("<style>\nbody{color:red}\n</style>");
    expect(result.html).toContain('<script type="module">\nwindow.reportLoaded=true;\n</script>');
    expect(result.html).not.toContain("modulepreload");
    expect(result.html).not.toContain("src=");
    expect(result.html).not.toContain("href=");
    expect(result.inlinedFileNames).toEqual(["assets/index.js", "assets/index.css"]);
  });
});
