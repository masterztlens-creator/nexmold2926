import { invariant } from "../constitution/invariants.js";

import type {
  ClaimPayload,
  FoundationRecord,
} from "./types.js";

import type {
  Knowledge,
} from "../domain/knowledge.js";

function normalizeValues(
  values: readonly string[] | undefined,
): readonly string[] {
  if (!values) {
    return [];
  }

  return [
    ...new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ].sort();
}

function assertClaimScopePreserved(
  knowledge: Knowledge,
  claims: readonly FoundationRecord<ClaimPayload>[],
): void {
  for (const record of claims) {
    const claim = record.payload;

    if (claim.scope !== undefined) {
      invariant(
        knowledge.scope === claim.scope,
        "V8_KNOWLEDGE_SCOPE_DROPPED",
        "Knowledge must preserve the scope of every supporting Claim.",
      );
    }
  }
}

function assertClaimConditionsPreserved(
  knowledge: Knowledge,
  claims: readonly FoundationRecord<ClaimPayload>[],
): void {
  const knowledgeConditions =
    normalizeValues(
      knowledge.conditions,
    );

  const knowledgeConditionSet =
    new Set(knowledgeConditions);

  for (const record of claims) {
    const claimConditions =
      normalizeValues(
        record.payload.conditions,
      );

    for (const condition of claimConditions) {
      invariant(
        knowledgeConditionSet.has(
          condition,
        ),
        "V8_KNOWLEDGE_CONDITION_DROPPED",
        "Knowledge must preserve every condition declared by its supporting Claims.",
      );
    }
  }
}

function assertClaimUnitsPreserved(
  knowledge: Knowledge,
  claims: readonly FoundationRecord<ClaimPayload>[],
): void {
  const knowledgeUnits =
    new Set(
      normalizeValues(
        knowledge.units,
      ),
    );

  for (const record of claims) {
    const claimUnits =
      normalizeValues(
        record.payload.units,
      );

    for (const unit of claimUnits) {
      invariant(
        knowledgeUnits.has(unit),
        "V8_KNOWLEDGE_UNIT_DROPPED",
        "Knowledge must preserve every unit declared by its supporting Claims.",
      );
    }
  }
}

function assertUniversalizationClosed(
  knowledge: Knowledge,
  claims: readonly FoundationRecord<ClaimPayload>[],
): void {
  if (knowledge.isUniversal !== true) {
    return;
  }

  invariant(
    claims.every(
      (record) =>
        record.payload.isUniversal === true,
    ),
    "V8_KNOWLEDGE_UNSUPPORTED_UNIVERSALIZATION",
    "Knowledge cannot become universal unless every supporting Claim is explicitly universal.",
  );

  invariant(
    knowledge.scope === undefined,
    "V8_KNOWLEDGE_UNSUPPORTED_UNIVERSALIZATION",
    "Universal Knowledge cannot retain a narrower scope.",
  );

  invariant(
    normalizeValues(
      knowledge.conditions,
    ).length === 0,
    "V8_KNOWLEDGE_UNSUPPORTED_UNIVERSALIZATION",
    "Universal Knowledge cannot retain conditional constraints.",
  );
}

export function assertKnowledgeReady(
  knowledge: Knowledge,
  claims: readonly FoundationRecord<ClaimPayload>[],
): void {
  invariant(
    claims.length === knowledge.claimIds.length,
    "V8_KNOWLEDGE_CLAIM_RECORD_COUNT_MISMATCH",
    "Every supporting Claim must resolve to exactly one Foundation record.",
  );

  const resolvedIds = new Set(
    claims.map(
      (record) => record.aggregateId,
    ),
  );

  invariant(
    knowledge.claimIds.every(
      (id) => resolvedIds.has(id),
    ),
    "V8_KNOWLEDGE_CLAIM_MISSING",
    "Every Knowledge Claim reference must resolve to a supporting Claim.",
  );

  invariant(
    claims.every(
      (record) =>
        record.state === "VERIFIED",
    ),
    "V8_KNOWLEDGE_CLAIM_NOT_VERIFIED",
    "Every supporting Claim must be VERIFIED.",
  );

  assertClaimScopePreserved(
    knowledge,
    claims,
  );

  assertClaimConditionsPreserved(
    knowledge,
    claims,
  );

  assertClaimUnitsPreserved(
    knowledge,
    claims,
  );

  assertUniversalizationClosed(
    knowledge,
    claims,
  );
}