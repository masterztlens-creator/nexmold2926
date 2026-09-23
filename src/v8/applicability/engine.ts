import { invariant } from "../constitution/invariants.js";
import { nonEmpty } from "../domain/primitives.js";
import type {
  FoundationRecord,
  FoundationStore,
  KnowledgePayload,
} from "../foundation/types.js";
import type {
  ApplicabilityInput,
  ApplicabilityLineage,
  ApplicabilityResult,
} from "./types.js";

interface ContextPayload {
  readonly scopeId: string;
  readonly purpose: string;
  readonly variables: Readonly<Record<string, string>>;
}

function lineageOf(
  record: FoundationRecord,
  type: "KNOWLEDGE" | "SCOPE" | "CONTEXT",
): ApplicabilityLineage {
  return {
    type,
    id: record.aggregateId,
    version: record.version,
    fingerprint: record.fingerprint,
  };
}

function containsExactContextValue(
  context: ContextPayload,
  requiredValue: string,
): boolean {
  return Object.values(context.variables).some(
    (value) => value === requiredValue,
  );
}

function evaluateKnowledgeConstraints(
  knowledge: KnowledgePayload,
  context: ContextPayload,
): readonly string[] {
  const reasons: string[] = [];

  for (const condition of knowledge.conditions ?? []) {
    if (
      !containsExactContextValue(
        context,
        condition,
      )
    ) {
      reasons.push(
        `KNOWLEDGE_CONDITION_MISMATCH:${condition}`,
      );
    }
  }

  for (const unit of knowledge.units ?? []) {
    if (
      !containsExactContextValue(
        context,
        unit,
      )
    ) {
      reasons.push(
        `KNOWLEDGE_UNIT_MISMATCH:${unit}`,
      );
    }
  }

  return reasons;
}

export class ApplicabilityEngine {
  constructor(
    private readonly store: FoundationStore,
  ) {}

  evaluate(
    input: ApplicabilityInput,
  ): ApplicabilityResult {
    const knowledgeId = nonEmpty(
      input.knowledgeId,
      "knowledgeId",
    );

    const scopeId = nonEmpty(
      input.scopeId,
      "scopeId",
    );

    const contextId = nonEmpty(
      input.contextId,
      "contextId",
    );

    const reasons: string[] = [];
    const lineage: ApplicabilityLineage[] = [];

    const knowledge =
      this.store.get<KnowledgePayload>(
        "KNOWLEDGE",
        knowledgeId,
      );

    if (!knowledge) {
      reasons.push(
        "KNOWLEDGE_NOT_FOUND",
      );
    } else {
      lineage.push(
        lineageOf(
          knowledge,
          "KNOWLEDGE",
        ),
      );

      if (
        knowledge.state !==
        "VERIFIED"
      ) {
        reasons.push(
          "KNOWLEDGE_NOT_VERIFIED",
        );
      }
    }

    const scope =
      this.store.get<{
        readonly geography: string;
        readonly industries: readonly string[];
        readonly languages: readonly string[];
      }>(
        "SCOPE",
        scopeId,
      );

    if (!scope) {
      reasons.push(
        "SCOPE_NOT_FOUND",
      );
    } else {
      lineage.push(
        lineageOf(
          scope,
          "SCOPE",
        ),
      );

      if (
        scope.state !==
        "REGISTERED"
      ) {
        reasons.push(
          "SCOPE_NOT_REGISTERED",
        );
      }
    }

    const context =
      this.store.get<ContextPayload>(
        "CONTEXT",
        contextId,
      );

    if (!context) {
      reasons.push(
        "CONTEXT_NOT_FOUND",
      );
    } else {
      lineage.push(
        lineageOf(
          context,
          "CONTEXT",
        ),
      );

      if (
        context.state !==
        "REGISTERED"
      ) {
        reasons.push(
          "CONTEXT_NOT_REGISTERED",
        );
      }

      if (
        context.payload.scopeId !==
        scopeId
      ) {
        reasons.push(
          "CONTEXT_SCOPE_MISMATCH",
        );
      }

      if (knowledge) {
        reasons.push(
          ...evaluateKnowledgeConstraints(
            knowledge.payload,
            context.payload,
          ),
        );
      }
    }

    return {
      applicable:
        reasons.length === 0,
      knowledgeId,
      scopeId,
      contextId,
      reasons,
      lineage,
    };
  }

  assert(
    input: ApplicabilityInput,
  ): void {
    const result =
      this.evaluate(input);

    invariant(
      result.applicable,
      "V8_APPLICABILITY_BLOCKED",
      result.reasons.join(","),
    );
  }
}