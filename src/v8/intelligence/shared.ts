
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface EvidenceRef {
  readonly sourceUrl: string;
  readonly title?: string;
  readonly publisher?: string;
  readonly retrievedAt?: string;
  readonly excerpt?: string;
  readonly authority?: string;
}

export interface KeywordRecord {
  readonly keyword: string;
  readonly normalized: string;
  readonly source: "SERP" | "SUGGESTION" | "RELATED" | "COMPETITOR" | "DISCOVERY" | "SEED";
  readonly intent: SearchIntent;
  readonly language?: string;
  readonly market?: string;
  readonly parent?: string;
  readonly terms: readonly string[];
}

export type SearchIntent =
  | "INFORMATIONAL"
  | "COMMERCIAL"
  | "TRANSACTIONAL"
  | "NAVIGATIONAL"
  | "COMPARISON"
  | "PROBLEM_SOLUTION"
  | "UNKNOWN";

export interface Opportunity {
  readonly keyword: KeywordRecord;
  readonly score: number;
  readonly demand: number;
  readonly relevance: number;
  readonly competition: number;
  readonly authorityGap: number;
  readonly conversionPotential: number;
  readonly reasons: readonly string[];
}

export interface ContentBrief {
  readonly primaryKeyword: string;
  readonly intent: SearchIntent;
  readonly title: string;
  readonly outline: readonly string[];
  readonly questions: readonly string[];
  readonly evidenceQueries: readonly string[];
  readonly competitorGaps: readonly string[];
  readonly internalLinkTargets: readonly string[];
}

export interface ContentDraft {
  readonly title: string;
  readonly slug: string;
  readonly description: string;
  readonly sections: readonly {
    readonly heading: string;
    readonly body: string;
  }[];
  readonly claims: readonly string[];
  readonly evidence: readonly EvidenceRef[];
}

export interface QualityFinding {
  readonly code: string;
  readonly severity: "INFO" | "WARN" | "BLOCK";
  readonly message: string;
}

export interface QualityReport {
  readonly passed: boolean;
  readonly findings: readonly QualityFinding[];
}

export interface GrowthState {
  readonly cycleId: string;
  readonly keywords: readonly KeywordRecord[];
  readonly opportunities: readonly Opportunity[];
  readonly briefs: readonly ContentBrief[];
  readonly drafts: readonly ContentDraft[];
  readonly publishedSlugs: readonly string[];
  readonly blocked: readonly string[];
}

export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function tokenize(value: string): string[] {
  return normalizeText(value)
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/[\s-]+/)
    .filter(Boolean);
}

export function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map(normalizeText).filter(Boolean))];
}

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function slugify(value: string): string {
  return normalizeText(value)
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function inferIntent(query: string): SearchIntent {
  const q = normalizeText(query);
  if (/\b(vs|versus|compare|comparison|alternative|difference)\b/.test(q)) return "COMPARISON";
  if (/\b(price|cost|quote|buy|supplier|manufacturer|factory|service|custom)\b/.test(q)) return "COMMERCIAL";
  if (/\b(order|purchase|request quote|rfq)\b/.test(q)) return "TRANSACTIONAL";
  if (/^(how|what|why|when|where|guide|tutorial|definition)\b/.test(q) || /\bhow to\b/.test(q)) return "INFORMATIONAL";
  if (/\b(problem|issue|defect|failure|troubleshoot|repair)\b/.test(q)) return "PROBLEM_SOLUTION";
  return "UNKNOWN";
}
