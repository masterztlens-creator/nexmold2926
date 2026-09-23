import {
  immutable,
  invariant,
  requireKnown,
} from "../constitution/invariants.js";

import {
  claimId,
  knowledgeId,
  nonEmpty,
  type ClaimId,
  type Fingerprint,
  type KnowledgeId,
} from "./primitives.js";

import {
  contentFingerprint,
} from "../foundation/hash.js";

export type KnowledgeStatus =
  | "APPROVED"
  | "REJECTED"
  | "UNKNOWN";

export interface Knowledge {
  id: KnowledgeId;

  proposition: string;

  claimIds: readonly ClaimId[];

  scope?: string;

  conditions?: readonly string[];

  units?: readonly string[];

  isUniversal?: boolean;

  status: Exclude<
    KnowledgeStatus,
    "UNKNOWN"
  >;

  fingerprint: Fingerprint;
}

export function createKnowledge(
  input: Omit<
    Knowledge,
    "id" | "fingerprint"
  > & {
    id?: string;
  },
): Readonly<Knowledge> {
  const status = requireKnown(
    input.status,
    "V8_KNOWLEDGE_UNKNOWN",
    "knowledge.status",
  );

  invariant(
    input.claimIds.length > 0,
    "V8_KNOWLEDGE_NO_CLAIM",
    "Knowledge must derive from at least one claim.",
  );

  const claimIds = immutable(
    [
      ...new Set(
        input.claimIds.map(claimId),
      ),
    ].sort(),
  );

  const proposition = nonEmpty(
    input.proposition,
    "knowledge.proposition",
  );

  const scope =
    input.scope === undefined
      ? undefined
      : nonEmpty(
          input.scope,
          "knowledge.scope",
        );

  const conditions =
    input.conditions === undefined
      ? undefined
      : immutable(
          [
            ...new Set(
              input.conditions
                .map((value) =>
                  nonEmpty(
                    value,
                    "knowledge.condition",
                  ),
                ),
            ),
          ].sort(),
        );

  const units =
    input.units === undefined
      ? undefined
      : immutable(
          [
            ...new Set(
              input.units
                .map((value) =>
                  nonEmpty(
                    value,
                    "knowledge.unit",
                  ),
                ),
            ),
          ].sort(),
        );

  const fp = contentFingerprint({
    proposition,
    claimIds,
    scope,
    conditions,
    units,
    isUniversal:
      input.isUniversal,
    status,
  });

  return immutable({
    id: knowledgeId(
      input.id ??
        `knowledge:${fp}`,
    ),

    proposition,

    claimIds,

    ...(scope === undefined
      ? {}
      : { scope }),

    ...(conditions === undefined
      ? {}
      : { conditions }),

    ...(units === undefined
      ? {}
      : { units }),

    ...(input.isUniversal === undefined
      ? {}
      : {
          isUniversal:
            input.isUniversal,
        }),

    status,

    fingerprint: fp,
  });
}