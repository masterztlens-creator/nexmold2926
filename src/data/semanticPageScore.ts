/**
 * NEXMOLD V6.2 Semantic Page Score
 * Pure scoring only. No URL/canonical decisions and no global mutable state.
 */
import type { KnowledgeGraphContext } from "./knowledgeGraphResolver";
import type { EngineeringEntity } from "./engineeringOntology";

export interface PageScoreBreakdown {
  readonly total: number;
  readonly semanticCoverage: number;       // 0-25
  readonly engineeringEvidence: number;    // 0-20
  readonly articleEvidence: number;        // 0-15
  readonly intentStrength: number;          // 0-15
  readonly commercialRelevance: number;    // 0-10
  readonly uniqueness: number;             // 0-10; arbitration may reduce this
  readonly graphConnectivity: number;      // 0-5
  readonly penalties: {
    readonly ambiguity: number;
    readonly thinContent: number;
    readonly weakEvidence: number;
  };
}

export interface ScoreContext {
  readonly resolutionStatus: "resolved" | "ambiguous" | "unresolved";
  readonly intentStrength: number; // 0-1, supplied by candidate discovery
  readonly commercialRelevance: number; // 0-1
  readonly uniqueness: number; // 0-1, supplied by arbitration
}

export const SCORE_MAX = 100 as const;

const clamp01 = (n: number): number => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const clamp = (n: number, max: number): number => Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0));

function weightedEntityCoverage(entities: readonly EngineeringEntity[], max: number): number {
  if (!entities.length) return 0;
  const evidence = entities.reduce((sum, e) => sum + e.engineeringWeight * e.commercialWeight, 0);
  // Saturating curve prevents entity-count inflation.
  return clamp(max * (1 - Math.exp(-evidence / 2.5)), max);
}

export function calculateSemanticPageScore(
  graph: KnowledgeGraphContext | null,
  context: ScoreContext,
): PageScoreBreakdown {
  if (!graph || context.resolutionStatus === "unresolved") {
    return {
      total: 0,
      semanticCoverage: 0,
      engineeringEvidence: 0,
      articleEvidence: 0,
      intentStrength: 0,
      commercialRelevance: 0,
      uniqueness: 0,
      graphConnectivity: 0,
      penalties: { ambiguity: 0, thinContent: 100, weakEvidence: 0 },
    };
  }

  const semanticEvidence =
    weightedEntityCoverage(graph.defects, 7) +
    weightedEntityCoverage(graph.dfm, 7) +
    weightedEntityCoverage(graph.materials, 5) +
    weightedEntityCoverage(graph.processes, 6);
  const semanticCoverage = clamp(semanticEvidence, 25);

  const relationWeight = graph.entityEvidence.reduce((sum, e) => {
    const directionalBoost = ["mitigated-by", "caused-by", "material-for", "process-for"].includes(e.relationship) ? 1.15 : 0.65;
    return sum + e.weight * directionalBoost;
  }, 0);
  const engineeringEvidence = clamp(20 * (1 - Math.exp(-relationWeight / 2.8)), 20);

  const articleWeight = graph.articleEvidence.reduce((sum, e) => sum + e.weight, 0);
  const articleEvidence = clamp(15 * (1 - Math.exp(-articleWeight / 4)), 15);

  const intentStrength = clamp(15 * clamp01(context.intentStrength), 15);
  const commercialRelevance = clamp(10 * clamp01(context.commercialRelevance), 10);
  const uniqueness = clamp(10 * clamp01(context.uniqueness), 10);

  const uniqueKinds = new Set(graph.relatedEntities.map((e) => e.kind)).size;
  const graphConnectivity = clamp(
    5 * (0.45 * clamp01(graph.graphDepth / 2) + 0.55 * clamp01(uniqueKinds / 4)),
    5,
  );

  const thinContent = graph.relatedEntities.length === 0 && graph.knowledgeArticles.length === 0 ? 30 :
    graph.relatedEntities.length < 2 && graph.knowledgeArticles.length < 1 ? 15 : 0;
  const directionalEvidence = graph.entityEvidence.filter((e) =>
    ["mitigated-by", "caused-by", "material-for", "process-for"].includes(e.relationship),
  ).length;
  const weakEvidence = directionalEvidence === 0 && graph.articleEvidence.length === 0 ? 12 : 0;
  const ambiguity = context.resolutionStatus === "ambiguous" ? 12 : 0;

  const raw = semanticCoverage + engineeringEvidence + articleEvidence + intentStrength +
    commercialRelevance + uniqueness + graphConnectivity;
  const total = Math.round(Math.max(0, Math.min(SCORE_MAX, raw - thinContent - weakEvidence - ambiguity)));

  return {
    total,
    semanticCoverage: Number(semanticCoverage.toFixed(2)),
    engineeringEvidence: Number(engineeringEvidence.toFixed(2)),
    articleEvidence: Number(articleEvidence.toFixed(2)),
    intentStrength: Number(intentStrength.toFixed(2)),
    commercialRelevance: Number(commercialRelevance.toFixed(2)),
    uniqueness: Number(uniqueness.toFixed(2)),
    graphConnectivity: Number(graphConnectivity.toFixed(2)),
    penalties: { ambiguity, thinContent, weakEvidence },
  };
}

export function tierForScore(score: number): "A" | "B" | "C" | "NOINDEX" | "REJECT" {
  if (score >= 92) return "A";
  if (score >= 82) return "B";
  if (score >= 70) return "C";
  if (score >= 55) return "NOINDEX";
  return "REJECT";
}
