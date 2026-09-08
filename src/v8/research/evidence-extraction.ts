import { createHash } from "node:crypto";
import type { EvidenceCandidate, NormalizedDocument } from "./types.js";
const ENGINEERING_UNIT_PATTERN =
  /\b\d+(?:\.\d+)?\s?(?:mm|cm|m|in|inch|inches|%|MPa|GPa|°C|C|kg|g|N|kN|psi|bar|s|min|hr|h)\b/gi;
const ENGINEERING_TERM_PATTERN =
  /\b(?:wall\s+thickness|draft\s+angle|shrinkage|tolerance|flatness|warpage|sink\s+mark|sink\s+marks|cooling|clamp\s+force|injection\s+pressure|mold\s+temperature|melt\s+temperature|cycle\s+time|gate|runner|ejector|parting\s+line|undercut|rib|boss|fillet|radius|DFM|SPI|surface\s+finish)\b/gi;
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?。！？])\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
}
function hashExcerpt(value: string): string {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}
function confidenceForSentence(sentence: string): "MEDIUM" | "LOW" {
  const hasUnit = ENGINEERING_UNIT_PATTERN.test(sentence);
  ENGINEERING_UNIT_PATTERN.lastIndex = 0;
  const hasEngineeringTerm = ENGINEERING_TERM_PATTERN.test(sentence);
  ENGINEERING_TERM_PATTERN.lastIndex = 0;
  return hasUnit && hasEngineeringTerm ? "MEDIUM" : "LOW";
}
export function extractEvidenceCandidates(
  document: NormalizedDocument,
): EvidenceCandidate[] {
  const sentences = splitSentences(document.text);
  const candidates: EvidenceCandidate[] = [];
  for (let index = 0; index < sentences.length; index += 1) {
    const sentence = sentences[index];
    const hasUnit = ENGINEERING_UNIT_PATTERN.test(sentence);
    ENGINEERING_UNIT_PATTERN.lastIndex = 0;
    const hasEngineeringTerm =
      ENGINEERING_TERM_PATTERN.test(sentence);
    ENGINEERING_TERM_PATTERN.lastIndex = 0;
    if (!hasUnit && !hasEngineeringTerm) {
      continue;
    }
    const excerpt = sentence.slice(0, 2000);
    const excerptHash = hashExcerpt(excerpt);
    const evidence = {
      sourceUrl: document.finalUrl,
      excerpt,
      locator: `sentence:${index + 1}`,
      extractionMethod: "TEXT_EXTRACTION",
      extractionConfidence: confidenceForSentence(sentence),
      observedAt: new Date().toISOString(),
    } as EvidenceCandidate["evidence"];
    candidates.push({
      evidence,
      sourceUrl: document.finalUrl,
      excerpt,
      locator: `sentence:${index + 1}`,
      excerptHash,
    });
  }
  return candidates;
}