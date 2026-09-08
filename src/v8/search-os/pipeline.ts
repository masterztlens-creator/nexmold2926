import { classifyIntent } from "./intent.js";
import { createEngineeringDecision } from "./decision.js";
import { decideAsset } from "./economics.js";
import { canonicalAssetKey, duplicateRisk, type ExistingAsset } from "./dedup.js";
import { cannibalizationRisk } from "./cannibalization.js";
import type { AssetCandidate, CompetitorObservation, QueryCandidate, SearchOsRecord } from "./contracts.js";
import { evaluateApplicability, type EvidenceCondition } from "./applicability.js";

export function evaluateSearchOpportunity(input: {
  query: QueryCandidate;
  competitors: readonly CompetitorObservation[];
  evidence: readonly EvidenceCondition[];
  requiredEvidenceIds: readonly string[];
  existingAssets: readonly ExistingAsset[];
  title: string;
  uniquenessScore: number;
  economicScore: number;
}): Readonly<SearchOsRecord> {
  const intent = classifyIntent(input.query);
  const applicability = evaluateApplicability(input.evidence, input.requiredEvidenceIds);
  if (intent.kind === "NON_ENGINEERING") {
    return Object.freeze({ query: input.query, intent, competitors: Object.freeze([...input.competitors]) });
  }
  let engineeringDecision;
  try {
    engineeringDecision = createEngineeringDecision({
      id: `decision:${input.query.id}`,
      queryId: input.query.id,
      intent,
      statement: `Engineering guidance for ${input.query.normalizedQuery} is supported only within the verified evidence boundary.`,
      applicability,
      evidenceIds: applicability.evidenceIds,
    });
  } catch {
    return Object.freeze({ query: input.query, intent, competitors: Object.freeze([...input.competitors]) });
  }

  const key = canonicalAssetKey(input.query.normalizedQuery, intent.kind);
  const candidate: AssetCandidate = {
    id: `asset:${input.query.id}`,
    queryId: input.query.id,
    canonicalKey: key,
    title: input.title,
    decisionId: engineeringDecision.id,
    uniquenessScore: input.uniquenessScore,
    economicScore: input.economicScore,
    duplicateRisk: duplicateRisk(key, input.existingAssets),
    cannibalizationRisk: cannibalizationRisk(input.query.normalizedQuery, input.existingAssets),
  };
  return Object.freeze({
    query: input.query,
    intent,
    competitors: Object.freeze([...input.competitors]),
    engineeringDecision,
    asset: decideAsset(candidate),
  });
}
