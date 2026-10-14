import type {
  EvidencePayload,
} from "../foundation/types.js";

import type {
  ClaimCandidate,
  ClaimSemanticVerification,
  ClaimSemanticVerifier,
} from "../intelligence/truth-producer/types.js";

/**
 * Deterministic, fail-closed verifier for verbatim evidence observations.
 *
 * This verifier accepts only a candidate that exactly matches its cited
 * Evidence excerpt after conservative text normalization.
 *
 * It does not claim to provide general natural-language entailment.
 * Paraphrases, synthesized statements, universal claims, and unsupported
 * qualifiers are rejected for independent review.
 */
export class ExactExcerptClaimSemanticVerifier
  implements ClaimSemanticVerifier
{
  verify(
    candidate: ClaimCandidate,
    evidence: readonly EvidencePayload[],
  ): ClaimSemanticVerification {
    const reasons: string[] = [];

    const statement =
      normalizeVerbatim(candidate.statement);

    if (!statement) {
      reasons.push(
        "Claim statement is empty after normalization.",
      );
    }

    if (evidence.length === 0) {
      reasons.push(
        "No Evidence payload was supplied.",
      );
    }

    if (candidate.isUniversal === true) {
      reasons.push(
        "A verbatim excerpt cannot establish a universal proposition.",
      );
    }

    if (
      candidate.scope?.trim() ||
      (candidate.conditions?.length ?? 0) > 0
    ) {
      reasons.push(
        "Added scope or conditions require independent semantic review.",
      );
    }

    if (
      candidate.units?.some(
        (unit) => !unit.trim(),
      )
    ) {
      reasons.push(
        "Claim contains an empty unit.",
      );
    }

    for (
      let index = 0;
      index < evidence.length;
      index += 1
    ) {
      const item = evidence[index];

      const excerpt =
        normalizeVerbatim(item.excerpt);

      if (!excerpt) {
        reasons.push(
          `Evidence[${index}] has an empty excerpt.`,
        );

        continue;
      }

      if (statement !== excerpt) {
        reasons.push(
          `Evidence[${index}] does not exactly support the complete Claim statement.`,
        );
      }

      const evidenceUnit =
        typeof item.unit === "string"
          ? item.unit.trim()
          : "";

      if (
        evidenceUnit &&
        (
          !candidate.units ||
          !candidate.units.some(
            (unit) =>
              normalizeVerbatim(unit) ===
              normalizeVerbatim(evidenceUnit),
          )
        )
      ) {
        reasons.push(
          `Evidence[${index}] unit "${evidenceUnit}" is not preserved by the Claim.`,
        );
      }
    }

    const uniqueReasons = [
      ...new Set(reasons),
    ];

    return Object.freeze({
      verdict:
        uniqueReasons.length === 0
          ? "VERIFIED"
          : "REQUIRES_REVIEW",

      verifiedStatement:
        candidate.statement.trim(),

      evidenceIds: Object.freeze([
        ...candidate.evidenceIds,
      ]),

      reasons: Object.freeze(
        uniqueReasons,
      ),
    });
  }
}

function normalizeVerbatim(
  value: string,
): string {
  return value
    .normalize("NFKC")
    .replace(/[\u2018\u2019]/gu, "'")
    .replace(/[\u201C\u201D]/gu, '"')
    .replace(/[\u2010-\u2015\u2212]/gu, "-")
    .replace(/\s+/gu, " ")
    .trim();
}