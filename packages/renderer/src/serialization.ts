import type { ReportData } from "@git-snitch/core";

export const REPORT_DATA_PLACEHOLDER = "__GIT_SNITCH_REPORT_DATA__";

const escapedCharacters = /[<>&\u2028\u2029]/g;

function escapeCharacter(character: string): string {
  switch (character) {
    case "<":
      return "\\u003c";
    case ">":
      return "\\u003e";
    case "&":
      return "\\u0026";
    case "\u2028":
      return "\\u2028";
    case "\u2029":
      return "\\u2029";
    default:
      return character;
  }
}

function escapeJsonForScript(json: string): string {
  return json.replace(escapedCharacters, escapeCharacter);
}

export function serializeReportDataForHtml(report: ReportData): string {
  let json: string | undefined;

  try {
    json = JSON.stringify(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown serialization error";
    throw new Error(`Report data could not be serialized for HTML injection: ${message}`);
  }

  if (json === undefined) {
    throw new Error("Report data could not be serialized for HTML injection: JSON.stringify returned undefined.");
  }

  return escapeJsonForScript(json);
}

export function injectReportDataIntoHtml(templateHtml: string, report: ReportData): string {
  const placeholderLiteral = JSON.stringify(REPORT_DATA_PLACEHOLDER);
  const placeholderIndex = templateHtml.indexOf(placeholderLiteral);

  if (placeholderIndex === -1) {
    throw new Error(`Report template is missing the ${REPORT_DATA_PLACEHOLDER} data placeholder.`);
  }

  if (templateHtml.indexOf(placeholderLiteral, placeholderIndex + placeholderLiteral.length) !== -1) {
    throw new Error(`Report template must contain exactly one ${REPORT_DATA_PLACEHOLDER} data placeholder.`);
  }

  return templateHtml.replace(placeholderLiteral, serializeReportDataForHtml(report));
}
