
import { normalizeText, tokenize } from "../shared.js";
export interface NicheSignal { readonly industry: string; readonly niche: string; readonly microNiches: readonly string[]; readonly evidenceTerms: readonly string[]; readonly score: number; }
export function discoverNiches(industry: string, keywords: readonly string[]): readonly NicheSignal[] {
  const groups = new Map<string, string[]>();
  for (const keyword of keywords) { const terms = tokenize(keyword); const key = terms.filter(t => !["the","for","and","with","of"].includes(t)).slice(-2).join(" "); if (!key) continue; (groups.get(key) ?? groups.set(key, []).get(key)!).push(keyword); }
  return Object.freeze([...groups.entries()].map(([niche, values]) => Object.freeze({
    industry, niche: normalizeText(niche), microNiches: Object.freeze(values.slice(0, 8)), evidenceTerms: Object.freeze([...new Set(values.flatMap(tokenize))]), score: Math.min(1, values.length / Math.max(5, keywords.length)),
  })));
}
