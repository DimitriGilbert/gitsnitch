import { readdir, readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";

import type { CountLinesOfCodeOptions, LineCountByLanguage, LineCountResult, LineCountSkippedFile } from "./types";

interface LanguageDefinition {
  readonly name: string;
  readonly lineCommentPrefixes: readonly string[];
  readonly blockCommentStart?: string;
  readonly blockCommentEnd?: string;
}

interface MutableLanguageStats {
  files: number;
  source: number;
  blank: number;
  comment: number;
  total: number;
}

interface FileLineStats {
  readonly source: number;
  readonly blank: number;
  readonly comment: number;
  readonly total: number;
}

const LANGUAGE_BY_EXTENSION = new Map<string, LanguageDefinition>([
  [".js", { name: "JavaScript", lineCommentPrefixes: ["//"], blockCommentStart: "/*", blockCommentEnd: "*/" }],
  [".jsx", { name: "JavaScript JSX", lineCommentPrefixes: ["//"], blockCommentStart: "/*", blockCommentEnd: "*/" }],
  [".ts", { name: "TypeScript", lineCommentPrefixes: ["//"], blockCommentStart: "/*", blockCommentEnd: "*/" }],
  [".tsx", { name: "TypeScript TSX", lineCommentPrefixes: ["//"], blockCommentStart: "/*", blockCommentEnd: "*/" }],
  [".py", { name: "Python", lineCommentPrefixes: ["#"] }],
  [".rb", { name: "Ruby", lineCommentPrefixes: ["#"] }],
  [".go", { name: "Go", lineCommentPrefixes: ["//"], blockCommentStart: "/*", blockCommentEnd: "*/" }],
  [".rs", { name: "Rust", lineCommentPrefixes: ["//"], blockCommentStart: "/*", blockCommentEnd: "*/" }],
  [".java", { name: "Java", lineCommentPrefixes: ["//"], blockCommentStart: "/*", blockCommentEnd: "*/" }],
  [".c", { name: "C", lineCommentPrefixes: ["//"], blockCommentStart: "/*", blockCommentEnd: "*/" }],
  [".cpp", { name: "C++", lineCommentPrefixes: ["//"], blockCommentStart: "/*", blockCommentEnd: "*/" }],
  [".cs", { name: "C#", lineCommentPrefixes: ["//"], blockCommentStart: "/*", blockCommentEnd: "*/" }],
  [".php", { name: "PHP", lineCommentPrefixes: ["//", "#"], blockCommentStart: "/*", blockCommentEnd: "*/" }],
]);

const DEFAULT_LOC_EXCLUDES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".turbo",
  ".next",
  "coverage",
  "vendor",
  "target",
  "out",
]);

export async function countLinesOfCode(repoPath: string, options: CountLinesOfCodeOptions = {}): Promise<LineCountResult> {
  const root = resolve(repoPath);
  const byLanguage = new Map<string, MutableLanguageStats>();
  const skippedFiles: LineCountSkippedFile[] = [];

  await walkFiles(root, root, options.exclude ?? [], async (filePath) => {
    const relativePath = relative(root, filePath);
    const language = LANGUAGE_BY_EXTENSION.get(extname(filePath));
    if (!language) {
      skippedFiles.push({ path: relativePath, reason: "unknown-language" });
      return;
    }

    try {
      const content = await readFile(filePath, "utf8");
      const stats = countContentLines(content, language);
      const existing = byLanguage.get(language.name) ?? { files: 0, source: 0, blank: 0, comment: 0, total: 0 };
      existing.files += 1;
      existing.source += stats.source;
      existing.blank += stats.blank;
      existing.comment += stats.comment;
      existing.total += stats.total;
      byLanguage.set(language.name, existing);
    } catch {
      skippedFiles.push({ path: relativePath, reason: "unreadable" });
    }
  });

  const languages = [...byLanguage.entries()]
    .map(([language, stats]): LineCountByLanguage => ({ language, ...stats }))
    .sort((left, right) => right.source - left.source || left.language.localeCompare(right.language));

  return {
    totalSource: languages.reduce((sum, item) => sum + item.source, 0),
    totalBlank: languages.reduce((sum, item) => sum + item.blank, 0),
    totalComment: languages.reduce((sum, item) => sum + item.comment, 0),
    totalLines: languages.reduce((sum, item) => sum + item.total, 0),
    byLanguage: languages,
    skippedFiles: skippedFiles.sort((left, right) => left.path.localeCompare(right.path)),
  };
}

async function walkFiles(
  root: string,
  current: string,
  userExcludes: readonly string[],
  onFile: (path: string) => Promise<void>,
): Promise<void> {
  const entries = await readDirectory(current);
  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = resolve(current, entry.name);
      if (entry.isDirectory()) {
        if (!isExcluded(root, entryPath, userExcludes)) {
          await walkFiles(root, entryPath, userExcludes, onFile);
        }
        return;
      }
      if (entry.isFile()) {
        await onFile(entryPath);
      }
    }),
  );
}

async function readDirectory(path: string) {
  try {
    return await readdir(path, { withFileTypes: true });
  } catch {
    return [];
  }
}

function countContentLines(content: string, language: LanguageDefinition): FileLineStats {
  const lines = content.split(/\r?\n/);
  let source = 0;
  let blank = 0;
  let comment = 0;
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      blank += 1;
    } else if (inBlockComment) {
      comment += 1;
      if (language.blockCommentEnd && trimmed.includes(language.blockCommentEnd)) {
        inBlockComment = false;
      }
    } else if (language.lineCommentPrefixes.some((prefix) => trimmed.startsWith(prefix))) {
      comment += 1;
    } else if (language.blockCommentStart && trimmed.startsWith(language.blockCommentStart)) {
      comment += 1;
      if (!trimmed.includes(language.blockCommentEnd ?? "")) {
        inBlockComment = true;
      }
    } else {
      source += 1;
    }
  }

  return { source, blank, comment, total: lines.length };
}

function isExcluded(root: string, directory: string, userExcludes: readonly string[]): boolean {
  const relativePath = relative(root, directory);
  const parts = relativePath.split(sep);
  const name = parts.at(-1) ?? relativePath;
  return DEFAULT_LOC_EXCLUDES.has(name) || userExcludes.includes(name) || userExcludes.includes(relativePath);
}
