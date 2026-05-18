import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

import type { WorklogResult } from "./types.js";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderWorklogHtml(result: WorklogResult): string {
  const rawBody = marked.parse(result.markdown) as string;
  const body = sanitizeHtml(rawBody, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt", "title", "width", "height"],
      a: ["href", "title", "target", "rel"],
    },
  });

  const safeGeneratedAt = escapeHtml(result.generatedAt);
  const safeHarness = escapeHtml(result.harness);
  const safeModel = escapeHtml(result.model);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>git-snitch worklog</title>
<style>
*, ::before, ::after { box-sizing: border-box; }
body {
  margin: 0;
  padding: 2rem;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
  font-size: 16px;
  line-height: 1.6;
  color: #24292f;
  background-color: #fff;
}
header {
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #d0d7de;
}
header h1 { margin: 0 0 0.5rem; font-size: 1.5rem; }
header p { margin: 0; color: #656d76; font-size: 0.875rem; }
.markdown-body {
  max-width: 980px;
  margin: 0 auto;
  color: #24292f;
}
.markdown-body h1 { margin: 1.5rem 0 1rem; font-size: 1.5rem; padding-bottom: 0.3rem; border-bottom: 1px solid #d0d7de; }
.markdown-body h2 { margin: 1.5rem 0 0.75rem; font-size: 1.25rem; padding-bottom: 0.3rem; border-bottom: 1px solid #d0d7de; }
.markdown-body h3 { margin: 1.25rem 0 0.5rem; font-size: 1.1rem; }
.markdown-body h4 { margin: 1rem 0 0.5rem; font-size: 1rem; }
.markdown-body h5, .markdown-body h6 { margin: 1rem 0 0.5rem; font-size: 0.875rem; }
.markdown-body p { margin: 0 0 1rem; }
.markdown-body ul, .markdown-body ol { margin: 0 0 1rem; padding-left: 2rem; }
.markdown-body li { margin: 0.25rem 0; }
.markdown-body blockquote { margin: 0 0 1rem; padding: 0.5rem 1rem; border-left: 0.25rem solid #d0d7de; color: #656d76; }
.markdown-body code { padding: 0.2em 0.4em; margin: 0; font-size: 85%; background-color: rgba(175, 184, 193, 0.2); border-radius: 6px; }
.markdown-body pre { margin: 0 0 1rem; padding: 1rem; overflow: auto; font-size: 85%; line-height: 1.45; background-color: #f6f8fa; border-radius: 6px; }
.markdown-body pre code { padding: 0; margin: 0; font-size: 100%; background-color: transparent; border-radius: 0; }
.markdown-body table { margin: 0 0 1rem; border-collapse: collapse; width: 100%; overflow: auto; }
.markdown-body th, .markdown-body td { padding: 6px 13px; border: 1px solid #d0d7de; }
.markdown-body th { font-weight: 600; background-color: #f6f8fa; }
.markdown-body tr { background-color: #fff; border-top: 1px solid #d0d7de; }
.markdown-body tr:nth-child(2n) { background-color: #f6f8fa; }
.markdown-body hr { margin: 1.5rem 0; border: 0; border-top: 1px solid #d0d7de; }
.markdown-body a { color: #0969da; text-decoration: none; }
.markdown-body a:hover { text-decoration: underline; }
.markdown-body img { max-width: 100%; box-sizing: content-box; }
</style>
</head>
<body>
<header>
<h1>Worklog</h1>
<p>Generated ${safeGeneratedAt} using ${safeHarness}/${safeModel}</p>
</header>
<main class="markdown-body">
${body}
</main>
</body>
</html>`;
}
