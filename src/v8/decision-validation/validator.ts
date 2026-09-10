import { immutable, invariant } from "../constitution/invariants.js";
import { contentFingerprint } from "../foundation/hash.js";
import type {
  FoundationRecord,
  FoundationStore,
  LineageLink,
} from "../foundation/types.js";
import { ApplicabilityEngine } from "../applicability/engine.js";
import type { DecisionValidationInput, DecisionValidationResult } from "./types.js";

interface DecisionPayload {
  readonly problemId: string;
  readonly knowledgeIds: readonly string[];
  readonly outcome: string;
  readonly status: "APPROVED";
  readonly fingerprint: string;
}

interface ProblemPayload {
  readonly contextId: string;
  readonly question: string;
  readonly constraints: readonly string[];
}

interface ContextPayload {
  readonly scopeId: string;
  readonly purpose: string;
  readonly variables: Readonly<Record<string, string>>;
}

interface ScopePayload {
  readonly geography: string;
  readonly industries: readonly string[];
  readonly languages: readonly string[];
}

interface KnowledgePayload {
  readonly proposition: string;
  readonly claimIds: readonly string[];
}

function lineageOf(
  record: FoundationRecord,
  type: LineageLink["type"],
): LineageLink {
  return {
    type,
    id: record.aggregateId,
    version: record.version,
    fingerprint: record.fingerprint,
  };
}

export class DecisionValidator {
  constructor(private readonly store: FoundationStore) {}

  validate(input: DecisionValidationInput): DecisionValidationResult {
    const reasons: string[] = [];
    const lineage: LineageLink[] = [];

    const decision = this.store.get<DecisionPayload>(
      "DECISION",
      input.decisionId,
    );

    if (!decision) {
      return immutable({
        valid: false,
        decisionId: input.decisionId,
        status: "UNKNOWN",
        reasons: ["DECISION_NOT_FOUND"],
        lineage: [],
      });
    }

    lineage.push(lineageOf(decision, "DECISION"));

    const expectedFingerprint = contentFingerprint({
      problemId: decision.payload.problemId,
      knowledgeIds: decision.payload.knowledgeIds,
      outcome: decision.payload.outcome,
      status: decision.payload.status,
    });

    if (decision.payload.fingerprint !== expectedFingerprint) {
      reasons.push("DECISION_FINGERPRINT_MISMATCH");
    }

    if (decision.state !== "APPROVED") {
      reasons.push("DECISION_NOT_APPROVED");
    }

    if (decision.payload.status !== "APPROVED") {
      reasons.push("DECISION_STATUS_NOT_APPROVED");
    }

    const problem = this.store.get<ProblemPayload>(
      "PROBLEM",
      decision.payload.problemId,
    );

    if (!problem) {
      reasons.push("PROBLEM_NOT_FOUND");
    } else {
      lineage.push(lineageOf(problem, "PROBLEM"));

      if (problem.state !== "REGISTERED") {
        reasons.push("PROBLEM_NOT_REGISTERED");
      }

      const context = this.store.get<ContextPayload>(
        "CONTEXT",
        problem.payload.contextId,
      );

      if (!context) {
        reasons.push("CONTEXT_NOT_FOUND");
      } else {
        lineage.push(lineageOf(context, "CONTEXT"));

        if (context.state !== "REGISTERED") {
          reasons.push("CONTEXT_NOT_REGISTERED");
        }

        if (context.payload.scopeId !== input.scopeId) {
          reasons.push("CONTEXT_SCOPE_MISMATCH");
        }

        const scope = this.store.get<ScopePayload>(
          "SCOPE",
          input.scopeId,
        );

        if (!scope) {
          reasons.push("SCOPE_NOT_FOUND");
        } else {
          lineage.push(lineageOf(scope, "SCOPE"));

          if (scope.state !== "REGISTERED") {
            reasons.push("SCOPE_NOT_REGISTERED");
          }
        }

        const applicability = new ApplicabilityEngine(this.store);

        if (decision.payload.knowledgeIds.length === 0) {
          reasons.push("DECISION_NO_KNOWLEDGE");
        }

        for (const knowledgeId of decision.payload.knowledgeIds) {
          const knowledge = this.store.get<KnowledgePayload>(
            "KNOWLEDGE",
            knowledgeId,
          );

          if (!knowledge) {
            reasons.push(`KNOWLEDGE_NOT_FOUND:${knowledgeId}`);
            continue;
          }

          lineage.push(lineageOf(knowledge, "KNOWLEDGE"));

          if (knowledge.state !== "VERIFIED") {
            reasons.push(`KNOWLEDGE_NOT_VERIFIED:${knowledgeId}`);
            continue;
          }

          const applicabilityResult = applicability.evaluate({
            knowledgeId,
            scopeId: input.scopeId,
            contextId: problem.payload.contextId,
          });

          if (!applicabilityResult.applicable) {
            reasons.push(
              `APPLICABILITY_FAILED:${knowledgeId}:${applicabilityResult.reasons.join(",")}`,
            );
          }
        }
      }
    }

    return immutable({
      valid: reasons.length === 0,
      decisionId: input.decisionId,
      status: decision.payload.status,
      reasons,
      lineage,
    });
  }

  assert(input: DecisionValidationInput): void {
    const result = this.validate(input);

    invariant(
      result.valid,
      "V8_DECISION_VALIDATION_FAILED",
      result.reasons.join(","),
    );
  }
}

