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
 * A Claim is admissible only when its complete normalized statement can be
 * matched to a complete sentence or the complete excerpt of its cited
 * Evidence.
 *
 * This implementation does not claim to perform general natural-language
 * entailment. It rejects paraphrases, synthesized statements, unsupported
 * qualifiers, and universal claims for independent review.
 *
 * Important:
 * - Evidence remains the source of truth.
 * - A substring match is insufficient.
 * - Sentence boundaries must be preserved.
 * - Every supplied Evidence excerpt must support the statement.
 * - Unsupported units, scope, and conditions fail closed.
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

    if (candidate.scope?.trim()) {
      reasons.push(
        "Additional Claim scope requires independent semantic review.",
      );
    }

    if (
      (candidate.conditions?.length ?? 0) > 0
    ) {
      reasons.push(
        "Additional Claim conditions require independent semantic review.",
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

    const candidateUnits =
      new Set(
        (candidate.units ?? [])
          .map(normalizeVerbatim)
          .filter(Boolean),
      );

    for (
      let index = 0;
      index < evidence.length;
      index += 1
    ) {
      const item = evidence[index];

      if (!item) {
        reasons.push(
          `Evidence[${index}] is missing.`,
        );

        continue;
      }

      const excerpt =
        normalizeVerbatim(item.excerpt);

      if (!excerpt) {
        reasons.push(
          `Evidence[${index}] has an empty excerpt.`,
        );

        continue;
      }

      if (
        statement &&
        !matchesCompleteObservation(
          statement,
          excerpt,
        )
      ) {
        reasons.push(
          [
            `Evidence[${index}] does not contain`,
            "the complete Claim statement as an exact",
            "excerpt or complete sentence.",
          ].join(" "),
        );
      }

      const evidenceUnit =
        typeof item.unit === "string"
          ? normalizeVerbatim(item.unit)
          : "";

      if (
        evidenceUnit &&
        !candidateUnits.has(evidenceUnit)
      ) {
        reasons.push(
          `Evidence[${index}] unit "${evidenceUnit}" is not preserved by the Claim.`,
        );
      }
    }

    const uniqueReasons = [
      ...new Set(reasons),
    ];

    const verdict =
      uniqueReasons.length === 0
        ? "VERIFIED"
        : "REQUIRES_REVIEW";

    return Object.freeze({
      verdict,

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

/**
 * Accept only:
 * 1. An exact match with the complete Evidence excerpt; or
 * 2. An exact match with a sentence extracted using conservative boundaries.
 *
 * This deliberately rejects arbitrary substring matches, because matching
 * a fragment of navigation text or a table cell is not sufficient to prove
 * that the fragment is a complete proposition.
 */
function matchesCompleteObservation(
  statement: string,
  excerpt: string,
): boolean {
  if (statement === excerpt) {
    return true;
  }

  const sentences =
    extractConservativeSentences(excerpt);

  return sentences.some(
    (sentence) =>
      normalizeVerbatim(sentence) === statement,
  );
}

/**
 * Extract conservative sentence candidates without rewriting their wording.
 *
 * Newlines are treated as possible boundaries only when the preceding
 * segment ends in terminal punctuation. This avoids treating every line
 * in a navigation menu or technical table as a complete sentence.
 *
 * A production semantic model or domain-specific table parser may improve
 * extraction later, but must not bypass the evidence and lineage gates.
 */
function extractConservativeSentences(
  excerpt: string,
): readonly string[] {
  const normalized =
    excerpt
      .normalize("NFKC")
      .replace(/\r\n?/gu, "\n")
      .trim();

  if (!normalized) {
    return [];
  }

  const candidates =
    normalized.match(
      /[^.!?。！？\n]+(?:[.!?。！？]+|(?=\n|$))/gu,
    ) ?? [];

  return candidates
    .map((candidate) => candidate.trim())
    .filter(Boolean);
}

/**
 * Normalize typography and whitespace only.
 *
 * No semantic rewriting, stemming, qualifier removal, or paraphrase
 * normalization is permitted at this verification boundary.
 */
function normalizeVerbatim(
  value: string,
): string {
  return value
    .normalize("NFKC")
    .replace(/[\u2018\u2019]/gu, "'")
    .replace(/[\u201C\u201D]/gu, '"')
    .replace(/[\u2010-\u2015\u2212]/gu, "-")
    .replace(/[ \t]+/gu, " ")
    .replace(/\s*\n\s*/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}