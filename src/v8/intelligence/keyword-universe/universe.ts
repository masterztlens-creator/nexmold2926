
import { inferIntent, normalizeText, tokenize, uniqueStrings, type KeywordRecord } from "../shared.js";
export interface KeywordExpansionInput { readonly seeds: readonly string[]; readonly modifiers?: readonly string[]; readonly questions?: readonly string[]; readonly related?: readonly string[]; readonly market?: string; readonly language?: string; }
export function buildKeywordUniverse(input: KeywordExpansionInput): readonly KeywordRecord[] {
  const candidates = [...input.seeds, ...(input.related ?? []), ...(input.questions ?? [])];
  for (const seed of input.seeds) for (const modifier of input.modifiers ?? []) candidates.push(`${modifier} ${seed}`, `${seed} ${modifier}`);
  const seen = new Set<string>(); const out: KeywordRecord[] = [];
  for (const raw of candidates) {
    const normalized = normalizeText(raw); if (!normalized || seen.has(normalized)) continue; seen.add(normalized);
    out.push({ keyword: raw.trim(), normalized, source: input.seeds.includes(raw) ? "SEED" : "DISCOVERY", intent: inferIntent(raw), market: input.market, language: input.language, terms: Object.freeze(uniqueStrings(tokenize(raw))) });
  }
  return Object.freeze(out);
}
