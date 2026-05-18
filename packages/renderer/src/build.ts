import { mkdir, readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { ReportData } from "@git-snitch/core";

import { build as viteBuild } from "vite";

import { injectReportDataIntoHtml } from "./serialization.js";

export interface BuildReportHtmlOptions {
  readonly report: ReportData;
  readonly templatePath?: string;
}

const moduleDirectory = fileURLToPath(new URL(".", import.meta.url));

export async function buildStandaloneReportHtml(options: BuildReportHtmlOptions): Promise<string> {
  const templatePath = options.templatePath ? resolve(options.templatePath) : undefined;
  const templateHtmlPath = await buildRendererTemplate(templatePath);
  const templateHtml = await readFile(templateHtmlPath, "utf8");

  return injectReportDataIntoHtml(templateHtml, options.report);
}

async function buildRendererTemplate(templatePath: string | undefined): Promise<string> {
  const packageDirectory = resolve(moduleDirectory, "..");
  const outDir = resolve(packageDirectory, "dist", "template");
  const configFile = resolve(packageDirectory, "vite.config.ts");

  await mkdir(dirname(outDir), { recursive: true });
  await rm(outDir, { recursive: true, force: true });

  const previousTemplateModule = process.env.GIT_SNITCH_TEMPLATE_MODULE;

  try {
    if (templatePath) {
      process.env.GIT_SNITCH_TEMPLATE_MODULE = templatePath;
      await ensureTemplateReadable(templatePath);
    } else {
      delete process.env.GIT_SNITCH_TEMPLATE_MODULE;
    }

    await viteBuild({ configFile, root: packageDirectory, logLevel: "silent" });
  } catch (error) {
    throw new Error(`Unable to compile report renderer${templatePath ? ` with template ${templatePath}` : ""}: ${errorMessage(error)}`);
  } finally {
    if (previousTemplateModule === undefined) {
      delete process.env.GIT_SNITCH_TEMPLATE_MODULE;
    } else {
      process.env.GIT_SNITCH_TEMPLATE_MODULE = previousTemplateModule;
    }
  }

  return resolve(outDir, "report-template.html");
}

async function ensureTemplateReadable(templatePath: string): Promise<void> {
  try {
    await readFile(templatePath, "utf8");
  } catch (error) {
    throw new Error(`Unable to read custom template ${templatePath}: ${errorMessage(error)}`);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
