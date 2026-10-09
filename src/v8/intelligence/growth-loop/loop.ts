
import type { Opportunity, GrowthState } from "../shared.js";
import { rankOpportunities } from "../opportunity/score.js";
import { nextGrowthCycle } from "../pipeline.js";

/**
 * A publication receipt is evidence that a candidate was actually published
 * and that its resulting route/artifact was verified.
 *
 * A candidate, an approval decision, or an attempted publication is not
 * sufficient to create this receipt.
 */
export interface PublicationReceipt {
  readonly candidateId: string;
  readonly slug: string;
  readonly routeUrl: string;
  readonly artifactFingerprint: string;
  readonly verifiedAt: string;
  readonly state: "VERIFIED";
}

export interface GrowthLoopDecision {
  readonly nextOpportunities: readonly Opportunity[];
  readonly publishCandidates: readonly string[];
  readonly blocked: readonly string[];
}

function requireNonEmptyString(
  value: unknown,
  field: string,
): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
}

function validatePublicationReceipt(
  receipt: PublicationReceipt,
): void {
  if (receipt === null || typeof receipt !== "object") {
    throw new TypeError("publication receipt must be an object");
  }

  requireNonEmptyString(receipt.candidateId, "receipt.candidateId");
  requireNonEmptyString(receipt.slug, "receipt.slug");
  requireNonEmptyString(receipt.routeUrl, "receipt.routeUrl");
  requireNonEmptyString(
    receipt.artifactFingerprint,
    "receipt.artifactFingerprint",
  );
  requireNonEmptyString(receipt.verifiedAt, "receipt.verifiedAt");

  if (receipt.candidateId !== receipt.candidateId.trim()) {
    throw new TypeError(
      "receipt.candidateId must not contain surrounding whitespace",
    );
  }

  if (receipt.slug !== receipt.slug.trim()) {
    throw new TypeError(
      "receipt.slug must not contain surrounding whitespace",
    );
  }

  if (receipt.state !== "VERIFIED") {
    throw new TypeError(
      "publication receipt state must be VERIFIED",
    );
  }

  let route: URL;

  try {
    route = new URL(receipt.routeUrl);
  } catch {
    throw new TypeError("receipt.routeUrl must be an absolute URL");
  }

  if (route.protocol !== "https:" && route.protocol !== "http:") {
    throw new TypeError(
      "receipt.routeUrl must use HTTP or HTTPS",
    );
  }

  const verifiedAt = Date.parse(receipt.verifiedAt);

  if (!Number.isFinite(verifiedAt)) {
    throw new TypeError(
      "receipt.verifiedAt must be a valid timestamp",
    );
  }
}

export function runGrowthLoop(
  state: GrowthState,
): GrowthLoopDecision {
  const ranked = rankOpportunities(state.opportunities).filter(
    (opportunity) =>
      !state.publishedSlugs.includes(
        opportunity.keyword.normalized,
      ),
  );

  const publishCandidates = ranked
    .filter((opportunity) => opportunity.score >= 0.65)
    .slice(0, 20)
    .map((opportunity) => opportunity.keyword.normalized);

  const blocked = ranked
    .filter((opportunity) => opportunity.score < 0.4)
    .map((opportunity) => opportunity.keyword.normalized);

  return Object.freeze({
    nextOpportunities: Object.freeze(ranked),
    publishCandidates: Object.freeze(publishCandidates),
    blocked: Object.freeze(blocked),
  });
}

/**
 * Advances the growth state using verified publication receipts only.
 *
 * Important:
 * - publishCandidates are proposals, not publication confirmations.
 * - Each receipt must refer to a candidate in this decision.
 * - Duplicate receipts for the same candidate are rejected.
 * - Only receipt-confirmed candidate IDs enter publishedSlugs.
 * - Existing published IDs are not appended a second time.
 *
 * The caller must obtain receipts from the real publication/verification
 * path. This function deliberately does not publish content itself.
 */
export function advanceGrowthLoop(
  state: GrowthState,
  decision: GrowthLoopDecision,
  publicationReceipts: readonly PublicationReceipt[] = [],
): GrowthState {
  const candidates = new Set(decision.publishCandidates);

  const confirmedCandidateIds: string[] = [];
  const seenReceiptIds = new Set<string>();

  for (const receipt of publicationReceipts) {
    validatePublicationReceipt(receipt);

    if (!candidates.has(receipt.candidateId)) {
      throw new Error(
        `publication receipt references a non-candidate: ${receipt.candidateId}`,
      );
    }

    if (seenReceiptIds.has(receipt.candidateId)) {
      throw new Error(
        `duplicate publication receipt: ${receipt.candidateId}`,
      );
    }

    seenReceiptIds.add(receipt.candidateId);

    if (!state.publishedSlugs.includes(receipt.candidateId)) {
      confirmedCandidateIds.push(receipt.candidateId);
    }
  }

  return nextGrowthCycle(state, {
    publishedSlugs: confirmedCandidateIds,
    blocked: decision.blocked,
  });
}