import {
  createClaim,
  createKnowledge,
  type Claim,
  type EvidencePayload,
  type FoundationStore,
  type Knowledge,
  type FoundationService,
} from "../../index.js";

import type {
  ClaimCandidate,
  ClaimInterpreter,
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

  if (candidate.evidenceIds.length === 0) {
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
  ids: readonly string[],
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

export class TruthProducer {
  private readonly service: FoundationService;
  private readonly interpreter: ClaimInterpreter;

  constructor(
    service: FoundationService,
    interpreter: ClaimInterpreter,
  ) {
    this.service = service;
    this.interpreter = interpreter;
  }

  produce(
    input: TruthProducerInput,
  ): TruthProducerResult {
    const candidates =
      this.interpreter.interpret(
        input.evidence,
      );

    const claims: string[] = [];
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
        const evidence =
          verifiedEvidence(
            this.service.storeView,
            candidate.evidenceIds,
          );

        const claim = createClaim({
          id: undefined,
          statement:
            candidate.statement,
          evidenceIds:
            candidate.evidenceIds,
          status: "VERIFIED",
          fingerprint: "ignored",
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
            input.actor,
            "truth producer",
          );

        claims.push(
          claimRecord.aggregateId,
        );

        /*
         * Knowledge is intentionally created only
         * after Claim persistence succeeds.
         *
         * This prevents a Knowledge record from
         * existing without a persisted Claim.
         */
        const knowledgeInput =
          createKnowledge({
            proposition:
              candidate.statement,
            claimIds: [
              claimRecord.aggregateId,
            ],
            status: "APPROVED",
            fingerprint: "ignored",
          });

        const knowledgeRecord =
          this.service.createKnowledge(
            knowledgeInput as Knowledge,
            input.actor,
            "truth producer",
          );

        knowledge.push(
          knowledgeRecord.aggregateId,
        );

        /*
         * Keep the variable alive so the
         * verified-evidence lookup remains an
         * explicit producer gate.
         */
        void evidence;
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
      claims: Object.freeze(claims),
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