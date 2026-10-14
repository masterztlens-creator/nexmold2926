
import {
  createClaim,
  createKnowledge,
  type Claim,
  type EvidencePayload,
  type FoundationStore,
  type Knowledge,
  type FoundationService,
} from "../../index.js";

import {
  claimId,
  evidenceId,
  type ClaimId,
  type EvidenceId,
} from "../../domain/primitives.js";

import type {
  AuditActor,
  AuditRole,
} from "../../foundation/types.js";

import type {
  ClaimCandidate,
  ClaimInterpreter,
  ClaimSemanticVerification,
  ClaimSemanticVerifier,
  TruthProducerInput,
  TruthProducerResult,
} from "./types.js";

function nonEmpty(
  value: string,
  field: string,
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(
      `V8_TRUTH_PRODUCER_EMPTY_${field.toUpperCase()}`,
    );
  }

  return normalized;
}

function normalizeCandidate(
  candidate: ClaimCandidate,
): ClaimCandidate {
  const statement = nonEmpty(
    candidate.statement,
    "statement",
  );

  if (!Array.isArray(candidate.evidenceIds) ||
      candidate.evidenceIds.length === 0) {
    throw new Error(
      "V8_TRUTH_PRODUCER_CLAIM_WITHOUT_EVIDENCE",
    );
  }

  const evidenceIds = [
    ...new Set(
      candidate.evidenceIds.map(
        (id) => id.trim(),
      ),
    ),
  ].filter(Boolean);

  if (evidenceIds.length === 0) {
    throw new Error(
      "V8_TRUTH_PRODUCER_CLAIM_WITHOUT_EVIDENCE",
    );
  }

  return Object.freeze({
    ...candidate,
    statement,
    evidenceIds: Object.freeze(
      evidenceIds,
    ),
  });
}

function verifiedEvidence(
  store: FoundationStore,
  ids: readonly EvidenceId[],
): EvidencePayload[] {
  return ids.map((id) => {
    const record =
      store.get<EvidencePayload>(
        "EVIDENCE",
        id,
      );

    if (!record) {
      throw new Error(
        `V8_TRUTH_PRODUCER_EVIDENCE_NOT_FOUND:${id}`,
      );
    }

    if (record.state !== "VERIFIED") {
      throw new Error(
        `V8_TRUTH_PRODUCER_EVIDENCE_NOT_VERIFIED:${id}`,
      );
    }

    return record.payload;
  });
}

function normalizeActor(
  actor: TruthProducerInput["actor"],
): AuditActor {
  const roles: readonly AuditRole[] = [
    "SYSTEM",
    "INGESTOR",
    "AUDITOR",
    "VERIFIER",
    "GOVERNOR",
  ];

  if (!roles.includes(actor.role as AuditRole)) {
    throw new Error(
      `V8_TRUTH_PRODUCER_INVALID_AUDIT_ROLE:${actor.role}`,
    );
  }

  const id = nonEmpty(
    actor.id,
    "actor_id",
  );

  return {
    id,
    role: actor.role as AuditRole,
  };
}

function normalizedStringSet(
  values: readonly string[],
): readonly string[] {
  return [
    ...new Set(
      values.map(
        (value) => value.trim(),
      ),
    ),
  ]
    .filter(Boolean)
    .sort();
}

function sameStringSet(
  left: readonly string[],
  right: readonly string[],
): boolean {
  const normalizedLeft =
    normalizedStringSet(left);

  const normalizedRight =
    normalizedStringSet(right);

  return (
    normalizedLeft.length ===
      normalizedRight.length &&
    normalizedLeft.every(
      (value, index) =>
        value === normalizedRight[index],
    )
  );
}

function validateSemanticVerification(
  candidate: ClaimCandidate,
  evidence: readonly EvidencePayload[],
  verification: ClaimSemanticVerification,
): void {
  if (!verification ||
      typeof verification !== "object") {
    throw new Error(
      "V8_TRUTH_PRODUCER_INVALID_SEMANTIC_VERIFICATION_RESULT",
    );
  }

  if (
    verification.verdict !== "VERIFIED" &&
    verification.verdict !== "REQUIRES_REVIEW" &&
    verification.verdict !== "REJECTED"
  ) {
    throw new Error(
      "V8_TRUTH_PRODUCER_INVALID_SEMANTIC_VERIFICATION_VERDICT",
    );
  }

  if (verification.verdict !== "VERIFIED") {
    const reasons =
      Array.isArray(verification.reasons)
        ? verification.reasons
            .map((reason) => String(reason).trim())
            .filter(Boolean)
        : [];

    throw new Error(
      [
        `V8_TRUTH_PRODUCER_SEMANTIC_VERIFICATION_${verification.verdict}`,
        ...(reasons.length > 0
          ? reasons
          : ["No verification reason was provided."]),
      ].join(":"),
    );
  }

  if (
    typeof verification.verifiedStatement !== "string" ||
    verification.verifiedStatement.trim() !==
      candidate.statement
  ) {
    throw new Error(
      "V8_TRUTH_PRODUCER_SEMANTIC_VERIFIED_STATEMENT_MISMATCH",
    );
  }

  if (
    !Array.isArray(verification.evidenceIds) ||
    !sameStringSet(
      verification.evidenceIds,
      candidate.evidenceIds,
    )
  ) {
    throw new Error(
      "V8_TRUTH_PRODUCER_SEMANTIC_VERIFIED_EVIDENCE_MAPPING_MISMATCH",
    );
  }

  if (
    !Array.isArray(verification.reasons) ||
    verification.reasons.some(
      (reason) => typeof reason !== "string",
    )
  ) {
    throw new Error(
      "V8_TRUTH_PRODUCER_INVALID_SEMANTIC_VERIFICATION_REASONS",
    );
  }

  /*
   * The Evidence passed to the verifier must correspond one-to-one with the
   * candidate's normalized Evidence IDs. This check does not itself prove
   * semantic entailment; that is the verifier's responsibility.
   */
  if (evidence.length !== candidate.evidenceIds.length) {
    throw new Error(
      "V8_TRUTH_PRODUCER_SEMANTIC_EVIDENCE_CARDINALITY_MISMATCH",
    );
  }
}

export class TruthProducer {
  private readonly service: FoundationService;
  private readonly interpreter: ClaimInterpreter;
  private readonly semanticVerifier:
    | ClaimSemanticVerifier
    | undefined;

  constructor(
    service: FoundationService,
    interpreter: ClaimInterpreter,
    semanticVerifier?: ClaimSemanticVerifier,
  ) {
    this.service = service;
    this.interpreter = interpreter;
    this.semanticVerifier = semanticVerifier;
  }

  produce(
    input: TruthProducerInput,
  ): TruthProducerResult {
    const actor = normalizeActor(input.actor);

    const candidates =
      this.interpreter.interpret(
        input.evidence,
      );

    const claims: ClaimId[] = [];
    const knowledge: string[] = [];

    const rejectedCandidates: {
      statement: string;
      reason: string;
    }[] = [];

    for (const raw of candidates) {
      let candidate: ClaimCandidate;

      try {
        candidate =
          normalizeCandidate(raw);
      } catch (error) {
        rejectedCandidates.push({
          statement:
            raw?.statement ?? "",
          reason:
            error instanceof Error
              ? error.message
              : String(error),
        });

        continue;
      }

      try {
        /*
         * Fail closed: VERIFIED Evidence does not imply a VERIFIED Claim.
         *
         * Existing callers that do not inject an independently implemented
         * semantic verifier cannot promote any candidate to VERIFIED.
         */
        if (!this.semanticVerifier) {
          throw new Error(
            "V8_TRUTH_PRODUCER_SEMANTIC_VERIFIER_NOT_CONFIGURED",
          );
        }

        const typedEvidenceIds =
          candidate.evidenceIds.map(
            evidenceId,
          );

        const evidence =
          verifiedEvidence(
            this.service.storeView,
            typedEvidenceIds,
          );

        /*
         * Check that the supplied Evidence payloads are exactly the records
         * resolved from the candidate's Evidence IDs before semantic review.
         */
        if (
          evidence.length !== typedEvidenceIds.length
        ) {
          throw new Error(
            "V8_TRUTH_PRODUCER_EVIDENCE_MAPPING_MISMATCH",
          );
        }

        const verification =
          this.semanticVerifier.verify(
            candidate,
            evidence,
          );

        validateSemanticVerification(
          candidate,
          evidence,
          verification,
        );

        /*
         * Only the explicit semantic-verification boundary above may permit
         * the producer to create a VERIFIED Claim.
         */
        const claim = createClaim({
          id: undefined,
          statement: candidate.statement,
          evidenceIds: typedEvidenceIds,
          status: "VERIFIED",

          ...(candidate.scope
            ? {
                scope:
                  candidate.scope,
              }
            : {}),

          ...(candidate.conditions
            ? {
                conditions:
                  candidate.conditions,
              }
            : {}),

          ...(candidate.units
            ? {
                units:
                  candidate.units,
              }
            : {}),

          ...(candidate.confidence
            ? {
                confidence:
                  candidate.confidence,
              }
            : {}),

          ...(candidate.epistemicLevel
            ? {
                epistemicLevel:
                  candidate.epistemicLevel,
              }
            : {}),

          ...(candidate.isUniversal !==
          undefined
            ? {
                isUniversal:
                  candidate.isUniversal,
              }
            : {}),
        });

        const claimRecord =
          this.service.createClaim(
            claim as Claim,
            actor,
            "truth producer: semantic verification accepted",
          );

        const persistedClaimId =
          claimId(
            claimRecord.aggregateId,
          );

        claims.push(
          persistedClaimId,
        );

        /*
         * Knowledge is created only after:
         * 1. all cited Evidence records are VERIFIED;
         * 2. an explicit semantic verifier accepts the exact statement;
         * 3. the verifier's Evidence mapping matches the candidate; and
         * 4. Claim persistence succeeds.
         *
         * Applicability constraints are preserved from the Claim candidate.
         */
        const knowledgeInput =
          createKnowledge({
            proposition:
              candidate.statement,

            claimIds: [
              persistedClaimId,
            ],

            status:
              "APPROVED",

            ...(candidate.scope
              ? {
                  scope:
                    candidate.scope,
                }
              : {}),

            ...(candidate.conditions
              ? {
                  conditions:
                    candidate.conditions,
                }
              : {}),

            ...(candidate.units
              ? {
                  units:
                    candidate.units,
                }
              : {}),

            ...(candidate.isUniversal !==
            undefined
              ? {
                  isUniversal:
                    candidate.isUniversal,
                }
              : {}),
          });

        const knowledgeRecord =
          this.service.createKnowledge(
            knowledgeInput as Knowledge,
            actor,
            "truth producer: semantically verified Claim",
          );

        knowledge.push(
          knowledgeRecord.aggregateId,
        );
      } catch (error) {
        rejectedCandidates.push({
          statement:
            candidate.statement,
          reason:
            error instanceof Error
              ? error.message
              : String(error),
        });
      }
    }

    return Object.freeze({
      claims: Object.freeze(
        claims,
      ),

      knowledge: Object.freeze(
        knowledge,
      ),

      rejectedCandidates:
        Object.freeze(
          rejectedCandidates,
        ),
    });
  }
}
