/**
 * NEXMOLD V6.2 Page Registry
 * Five-pass deterministic candidate -> resolution -> score -> arbitration -> decision pipeline.
 */
import { knowledgeArticles, type KnowledgeArticle } from "./knowledge";
import { resolveEngineeringPain, type ResolvedEngineeringContext } from "./engineeringResolver";
import { resolveKnowledgeGraph, type KnowledgeGraphContext } from "./knowledgeGraphResolver";
import { calculateSemanticPageScore, tierForScore, type PageScoreBreakdown } from "./semanticPageScore";
import { resolveCanonical, type CanonicalAction, type CanonicalDecision } from "./canonicalResolver";

export interface IndustryPayload {
  readonly name: string;
  readonly app?: string;
  readonly pain?: string;
  readonly caseStudy?: boolean;
  readonly commercial?: boolean;
  readonly intent?: string;
}

export interface IndustryRawData {
  readonly industryTitle: string;
  readonly subsystems?: Record<string, IndustryPayload>;
  readonly defaultPayload?: IndustryPayload;
}

export type IndustryKnowledgeMap = Record<string, IndustryRawData>;

export interface PageCandidate {
  readonly candidateId: string;
  readonly kind: "industry" | "subsystem";
  readonly industrySlug: string;
  readonly subsystemSlug?: string;
  readonly industryTitle: string;
  readonly name: string;
  readonly pain: string;
  readonly intentText: string;
  readonly url: string;
  readonly industryUrl: string;
  readonly commercialRelevance: number;
  readonly intentStrength: number;
  readonly explicitCaseStudy: boolean;
  readonly payload: IndustryPayload;
}

export interface ResolvedPageCandidate extends PageCandidate {
  readonly resolved: ResolvedEngineeringContext;
  readonly graph: KnowledgeGraphContext | null;
}

export interface ScoredPageCandidate extends ResolvedPageCandidate {
  readonly score: PageScoreBreakdown;
  readonly preArbitrationScore: number;
}

export interface FinalPageRecord extends ScoredPageCandidate {
  readonly action: CanonicalAction;
  readonly winnerCandidateId?: string;
  readonly canonical?: string;
  readonly indexable: boolean;
  readonly robots: CanonicalDecision["robots"];
  readonly tier: ReturnType<typeof tierForScore>;
  readonly reasonCodes: readonly string[];
}

export interface PageRegistry {
  readonly version: "6.2";
  readonly generatedAt: string;
  readonly candidates: readonly PageCandidate[];
  readonly resolved: readonly ResolvedPageCandidate[];
  readonly scored: readonly ScoredPageCandidate[];
  readonly pages: readonly FinalPageRecord[];
  readonly stats: RegistryStats;
}

export interface RegistryStats {
  readonly candidates: number;
  readonly resolved: number;
  readonly ambiguous: number;
  readonly unresolved: number;
  readonly generated: number;
  readonly indexable: number;
  readonly noindex: number;
  readonly rejected: number;
  readonly merged: number;
  readonly tierA: number;
  readonly tierB: number;
  readonly tierC: number;
  readonly orphanArticles: number;
  readonly articleCount: number;
}

const slugify = (value: string): string => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const tokens = (value: string): Set<string> => new Set(normalize(value).split(" ").filter((x) => x.length > 2));

function similarity(a: string, b: string): number {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let intersection = 0;
  for (const t of A) if (B.has(t)) intersection++;
  return intersection / new Set([...A, ...B]).size;
}

function commercialRelevance(payload: IndustryPayload, kind: "industry" | "subsystem"): number {
  if (payload.commercial === true) return 1;
  if (kind === "subsystem") return 0.75;
  return 0.55;
}

function intentStrength(payload: IndustryPayload, kind: "industry" | "subsystem"): number {
  if (payload.intent) return 0.9;
  if (kind === "subsystem" && payload.pain) return 0.85;
  if (payload.pain) return 0.7;
  return 0.45;
}

function discoverCandidates(map: IndustryKnowledgeMap): PageCandidate[] {
  const out: PageCandidate[] = [];
  for (const [industrySlugRaw, data] of Object.entries(map)) {
    const industrySlug = slugify(industrySlugRaw);
    const defaultPayload = data.defaultPayload;
    if (defaultPayload) {
      const pain = defaultPayload.pain?.trim() || defaultPayload.name;
      out.push({
        candidateId: `${industrySlug}:root`, kind: "industry", industrySlug,
        industryTitle: data.industryTitle, name: defaultPayload.name || data.industryTitle,
        pain, intentText: `${data.industryTitle} ${defaultPayload.name} ${pain}`,
        url: `/industries/${industrySlug}/`, industryUrl: `/industries/${industrySlug}/`,
        commercialRelevance: commercialRelevance(defaultPayload, "industry"),
        intentStrength: intentStrength(defaultPayload, "industry"),
        explicitCaseStudy: defaultPayload.caseStudy === true, payload: defaultPayload,
      });
    }
    for (const [subsystemSlugRaw, payload] of Object.entries(data.subsystems ?? {})) {
      const subsystemSlug = slugify(subsystemSlugRaw);
      const pain = payload.pain?.trim() || payload.name;
      out.push({
        candidateId: `${industrySlug}:${subsystemSlug}`, kind: "subsystem", industrySlug,
        subsystemSlug, industryTitle: data.industryTitle, name: payload.name,
        pain, intentText: `${data.industryTitle} ${payload.name} ${payload.app ?? ""} ${pain}`,
        url: `/industries/${industrySlug}/${subsystemSlug}/`, industryUrl: `/industries/${industrySlug}/`,
        commercialRelevance: commercialRelevance(payload, "subsystem"),
        intentStrength: intentStrength(payload, "subsystem"),
        explicitCaseStudy: payload.caseStudy === true, payload,
      });
    }
  }
  return out.sort((a, b) => a.candidateId.localeCompare(b.candidateId));
}

function resolveCandidates(candidates: readonly PageCandidate[], articles: readonly KnowledgeArticle[]): ResolvedPageCandidate[] {
  return candidates.map((candidate) => {
    const resolved = resolveEngineeringPain(candidate.pain, {
      industrySlug: candidate.industrySlug,
      subsystemSlug: candidate.subsystemSlug,
    });
    const graph = resolveKnowledgeGraph(resolved, articles);
    return { ...candidate, resolved, graph };
  });
}

function scoreCandidates(resolved: readonly ResolvedPageCandidate[]): ScoredPageCandidate[] {
  return resolved.map((candidate) => {
    const score = calculateSemanticPageScore(candidate.graph, {
      resolutionStatus: candidate.resolved.status,
      intentStrength: candidate.intentStrength,
      commercialRelevance: candidate.commercialRelevance,
      uniqueness: 1,
    });
    return { ...candidate, score, preArbitrationScore: score.total };
  });
}

function stableRank(a: ScoredPageCandidate, b: ScoredPageCandidate): number {
  return b.preArbitrationScore - a.preArbitrationScore || b.commercialRelevance - a.commercialRelevance || a.candidateId.localeCompare(b.candidateId);
}

function reScoreForUniqueness(candidate: ScoredPageCandidate, uniqueness: number): ScoredPageCandidate {
  const score = calculateSemanticPageScore(candidate.graph, {
    resolutionStatus: candidate.resolved.status,
    intentStrength: candidate.intentStrength,
    commercialRelevance: candidate.commercialRelevance,
    uniqueness,
  });
  return { ...candidate, score };
}

function arbitrate(scored: readonly ScoredPageCandidate[]): { scored: ScoredPageCandidate[]; winners: Set<string>; merges: Map<string, string> } {
  const ranked = [...scored].sort(stableRank);
  const winners = new Set<string>();
  const merges = new Map<string, string>();
  const finalScored: ScoredPageCandidate[] = [];

  for (const candidate of ranked) {
    if (candidate.resolved.status === "unresolved" || !candidate.graph) {
      finalScored.push(reScoreForUniqueness(candidate, 0));
      continue;
    }
    let duplicateOf: ScoredPageCandidate | undefined;
    for (const winnerId of winners) {
      const winner = finalScored.find((x) => x.candidateId === winnerId);
      if (!winner || !winner.graph || winner.resolved.primaryEntity?.id !== candidate.resolved.primaryEntity?.id) continue;
      const sameIndustry = winner.industrySlug === candidate.industrySlug;
      const sameStage = winner.payload.intent === candidate.payload.intent || (!winner.payload.intent && !candidate.payload.intent);
      const sim = similarity(winner.intentText, candidate.intentText);
      if ((sameIndustry && sameStage && sim >= 0.72) || sim >= 0.92) { duplicateOf = winner; break; }
    }
    if (duplicateOf) {
      merges.set(candidate.candidateId, duplicateOf.candidateId);
      finalScored.push(reScoreForUniqueness(candidate, 0.15));
    } else {
      winners.add(candidate.candidateId);
      finalScored.push(reScoreForUniqueness(candidate, 1));
    }
  }
  return { scored: finalScored.sort((a, b) => a.candidateId.localeCompare(b.candidateId)), winners, merges };
}

function decide(scored: readonly ScoredPageCandidate[], winners: Set<string>, merges: Map<string, string>): FinalPageRecord[] {
  return scored.map((candidate) => {
    const reasons: string[] = [];
    let action: CanonicalAction;
    const winnerId = merges.get(candidate.candidateId);
    if (candidate.resolved.status === "unresolved" || !candidate.graph) {
      action = "REJECT"; reasons.push("UNRESOLVED_OR_NO_GRAPH");
    } else if (winnerId) {
      action = "MERGE"; reasons.push("SEMANTIC_DUPLICATE");
    } else if (candidate.score.penalties.thinContent >= 30 || candidate.score.total < 55) {
      action = "REJECT"; reasons.push("BELOW_GENERATION_THRESHOLD");
    } else if (candidate.score.total < 70) {
      action = "GENERATE_NOINDEX"; reasons.push("LOW_VALUE_NOINDEX");
    } else {
      action = "GENERATE_INDEX";
      reasons.push(winners.has(candidate.candidateId) ? "INTENT_WINNER" : "INDEX_ELIGIBLE");
    }
    if (candidate.resolved.status === "ambiguous") reasons.push("AMBIGUOUS_ENTITY");
    if (!candidate.graph?.entityEvidence.some((e) => ["mitigated-by", "caused-by", "material-for", "process-for"].includes(e.relationship))) reasons.push("WEAK_ENGINEERING_EVIDENCE");

    const canonical = resolveCanonical({
      action,
      candidateUrl: candidate.url,
      winnerUrl: winnerId ? scored.find((x) => x.candidateId === winnerId)?.url : undefined,
      industryUrl: candidate.industryUrl,
    });
    const tier = tierForScore(candidate.score.total);
    return {
      ...candidate,
      action,
      winnerCandidateId: winnerId,
      canonical: canonical.canonical,
      indexable: canonical.indexable,
      robots: canonical.robots,
      tier,
      reasonCodes: reasons,
    };
  });
}

function countOrphanArticles(articles: readonly KnowledgeArticle[], pages: readonly FinalPageRecord[]): number {
  const used = new Set<string>();
  for (const page of pages) for (const article of page.graph?.knowledgeArticles ?? []) used.add(article.slug);
  return articles.filter((a) => !used.has(a.slug)).length;
}

export function buildPageRegistry(map: IndustryKnowledgeMap, articles: readonly KnowledgeArticle[] = knowledgeArticles): PageRegistry {
  const candidates = discoverCandidates(map);
  const resolved = resolveCandidates(candidates, articles);
  const initialScored = scoreCandidates(resolved);
  const arbitration = arbitrate(initialScored);
  const pages = decide(arbitration.scored, arbitration.winners, arbitration.merges);
  const stats: RegistryStats = {
    candidates: pages.length,
    resolved: pages.filter((p) => p.resolved.status === "resolved").length,
    ambiguous: pages.filter((p) => p.resolved.status === "ambiguous").length,
    unresolved: pages.filter((p) => p.resolved.status === "unresolved").length,
    generated: pages.filter((p) => p.action !== "REJECT").length,
    indexable: pages.filter((p) => p.indexable).length,
    noindex: pages.filter((p) => p.action === "GENERATE_NOINDEX" || p.action === "MERGE").length,
    rejected: pages.filter((p) => p.action === "REJECT").length,
    merged: pages.filter((p) => p.action === "MERGE").length,
    tierA: pages.filter((p) => p.tier === "A").length,
    tierB: pages.filter((p) => p.tier === "B").length,
    tierC: pages.filter((p) => p.tier === "C").length,
    orphanArticles: countOrphanArticles(articles, pages),
    articleCount: articles.length,
  };
  return { version: "6.2", generatedAt: new Date().toISOString(), candidates, resolved, scored: arbitration.scored, pages, stats };
}

export function getAstroPages(registry: PageRegistry): FinalPageRecord[] {
  return registry.pages.filter((p) => p.action !== "REJECT");
}
