
import { tokenize, uniqueStrings } from "../shared.js";
export interface CompetitorPage { readonly url: string; readonly title: string; readonly headings: readonly string[]; readonly terms: readonly string[]; }
export interface CompetitorGap { readonly missingTopics: readonly string[]; readonly weakTopics: readonly string[]; readonly competitorCoverage: number; }
export function analyzeCompetitorGap(targetTerms: readonly string[], competitors: readonly CompetitorPage[]): CompetitorGap {
  const target = new Set(uniqueStrings(targetTerms)); const coverage = new Map<string, number>();
  for (const page of competitors) for (const term of new Set(page.terms.flatMap(tokenize))) if (target.has(term)) coverage.set(term, (coverage.get(term) ?? 0) + 1);
  const missingTopics = [...target].filter(t => !coverage.has(t)); const weakTopics = [...target].filter(t => (coverage.get(t) ?? 0) === 1);
  return Object.freeze({ missingTopics, weakTopics, competitorCoverage: target.size ? (target.size - missingTopics.length) / target.size : 0 });
}
