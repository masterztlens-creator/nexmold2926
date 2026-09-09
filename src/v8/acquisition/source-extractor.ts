import type { ExtractedEvidenceCandidate } from "./types.js";

function decodeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function extractTextEvidence(html: string, locator = "document:text"): readonly ExtractedEvidenceCandidate[] {
  const text = decodeHtml(html);
  if (!text) return [];
  return [{ locator, excerpt: text.slice(0, 2_000), extractionConfidence: "MEDIUM" }];
}

export function extractEvidenceByPattern(
  html: string,
  patterns: readonly RegExp[],
): readonly ExtractedEvidenceCandidate[] {
  const text = decodeHtml(html);
  const output: ExtractedEvidenceCandidate[] = [];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[0]) output.push({ locator: `document:pattern:${pattern.source}`, excerpt: match[0].slice(0, 2_000), extractionConfidence: "MEDIUM" });
  }
  return output;
}
