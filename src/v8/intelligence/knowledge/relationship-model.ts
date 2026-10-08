import { createHash } from "node:crypto";

import {
  canonicalize,
  fingerprint,
  nonEmpty,
  sortedUnique,
  type ClaimId,
  type EntityId,
  type EvidenceId,
  type Fingerprint,
} from "../../domain/primitives.js";

import {
  type CreateKnowledgeRelationshipInput,
  type KnowledgeConfidence,
  type KnowledgeEntity,
  type KnowledgePolarity,
  type KnowledgeRelationship,
  type KnowledgeRelationshipType,
} from "./types.js";

import {
  assertEntityIntegrity,
  findEntityById,
} from "./entity-model.js";

/**
 * NEXMOLD V8 — Engineering Knowledge Relationship Model
 *
 * Phase 2.3
 *
 * Relationship semantics:
 *
 * Entity ──Relationship──> Entity
 *
 * A relationship is semantic structure, not prose.
 *
 * Every relationship must therefore preserve:
 * - canonical source Entity
 * - canonical target Entity
 * - canonical relationship type
 * - deterministic identity
 * - deterministic fingerprint
 * - Claim lineage
 * - Evidence lineage
 * - optional Conditions
 *
 * This module does not decide whether a relationship is true.
 * It preserves the evidence-backed relationship supplied by the
 * upstream Knowledge construction pipeline.
 */

/* -------------------------------------------------------------------------- */
/* Identity                                                                     */
/* -------------------------------------------------------------------------- */

export interface RelationshipIdentityInput {
  readonly fromEntityId: EntityId;
  readonly toEntityId: EntityId;
  readonly type: KnowledgeRelationshipType;
}

export interface RelationshipLookupKey {
  readonly relationshipId: string;
  readonly fromEntityId: EntityId;
  readonly toEntityId: EntityId;
  readonly type: KnowledgeRelationshipType;
}

export interface RelationshipCollectionResult {
  readonly relationships: readonly KnowledgeRelationship[];
  readonly fingerprint: Fingerprint;
}

/* -------------------------------------------------------------------------- */
/* Normalization                                                               */
/* -------------------------------------------------------------------------- */

export function normalizeRelationshipType(
  type: KnowledgeRelationshipType,
): KnowledgeRelationshipType {
  return type;
}

export function normalizeRelationshipCondition(
  value: string,
): string {
  return nonEmpty(
    value
      .normalize("NFKC")
      .trim()
      .replace(/\s+/gu, " "),
    "relationship.condition",
  );
}

/* -------------------------------------------------------------------------- */
/* Identity                                                                     */
/* -------------------------------------------------------------------------- */

export function canonicalRelationshipIdentity(
  input: RelationshipIdentityInput,
): string {
  return JSON.stringify(
    canonicalize({
      fromEntityId: input.fromEntityId,
      toEntityId: input.toEntityId,
      type: normalizeRelationshipType(input.type),
    }),
  );
}

export function deriveRelationshipId(
  input: RelationshipIdentityInput,
): string {
  const material =
    canonicalRelationshipIdentity(input);

  return `relationship:v8:${createHash("sha256")
    .update(material, "utf8")
    .digest("hex")}`;
}

/* -------------------------------------------------------------------------- */
/* Fingerprint                                                                  */
/* -------------------------------------------------------------------------- */

export function fingerprintRelationship(
  relationship: Omit<
    KnowledgeRelationship,
    "fingerprint"
  >,
): Fingerprint {
  const material = canonicalize({
    relationshipId:
      relationship.relationshipId,
    fromEntityId:
      relationship.fromEntityId,
    toEntityId:
      relationship.toEntityId,
    type: relationship.type,
    polarity: relationship.polarity,
    confidence: relationship.confidence,
    evidenceIds:
      relationship.evidenceIds,
    claimIds:
      relationship.claimIds,
    conditions:
      relationship.conditions,
  });

  return fingerprint(
    createHash("sha256")
      .update(JSON.stringify(material), "utf8")
      .digest("hex"),
  );
}

/* -------------------------------------------------------------------------- */
/* Construction                                                                */
/* -------------------------------------------------------------------------- */

export function createKnowledgeRelationship(
  input: CreateKnowledgeRelationshipInput,
): KnowledgeRelationship {
  if (
    input.fromEntityId ===
    input.toEntityId
  ) {
    throw new Error(
      "V8_RELATIONSHIP_SELF_REFERENCE: source and target EntityId cannot be identical.",
    );
  }

  const expectedId =
    deriveRelationshipId({
      fromEntityId: input.fromEntityId,
      toEntityId: input.toEntityId,
      type: input.type,
    });

  if (
    input.relationshipId !==
    expectedId
  ) {
    throw new Error(
      `V8_RELATIONSHIP_ID_MISMATCH: supplied RelationshipId "${input.relationshipId}" does not match canonical identity "${expectedId}".`,
    );
  }

  const evidenceIds = sortedUnique(
    input.evidenceIds ?? [],
  ) as readonly EvidenceId[];

  const claimIds = sortedUnique(
    input.claimIds ?? [],
  ) as readonly ClaimId[];

  const conditions = sortedUnique(
    (input.conditions ?? []).map(
      normalizeRelationshipCondition,
    ),
  );

  if (
    evidenceIds.length === 0 &&
    claimIds.length === 0
  ) {
    throw new Error(
      `V8_RELATIONSHIP_LINEAGE_REQUIRED: relationship "${expectedId}" requires Claim or Evidence lineage.`,
    );
  }

  const relationshipWithoutFingerprint: Omit<
    KnowledgeRelationship,
    "fingerprint"
  > = {
    relationshipId: expectedId,
    fromEntityId:
      input.fromEntityId,
    toEntityId:
      input.toEntityId,
    type: input.type,
    polarity:
      input.polarity ?? "UNKNOWN",
    confidence:
      input.confidence ?? "MEDIUM",
    evidenceIds,
    claimIds,
    conditions,
  };

  return Object.freeze({
    ...relationshipWithoutFingerprint,
    fingerprint:
      fingerprintRelationship(
        relationshipWithoutFingerprint,
      ),
  });
}

/* -------------------------------------------------------------------------- */
/* Preferred deterministic factory                                             */
/* -------------------------------------------------------------------------- */

export function createRelationship(
  fromEntityId: EntityId,
  toEntityId: EntityId,
  type: KnowledgeRelationshipType,
  options: {
    readonly polarity?: KnowledgePolarity;
    readonly confidence?: KnowledgeConfidence;
    readonly evidenceIds?: readonly EvidenceId[];
    readonly claimIds?: readonly ClaimId[];
    readonly conditions?: readonly string[];
  } = {},
): KnowledgeRelationship {
  return createKnowledgeRelationship({
    relationshipId:
      deriveRelationshipId({
        fromEntityId,
        toEntityId,
        type,
      }),
    fromEntityId,
    toEntityId,
    type,
    polarity: options.polarity,
    confidence: options.confidence,
    evidenceIds:
      options.evidenceIds,
    claimIds:
      options.claimIds,
    conditions:
      options.conditions,
  });
}

/* -------------------------------------------------------------------------- */
/* Integrity                                                                    */
/* -------------------------------------------------------------------------- */

export function verifyRelationshipFingerprint(
  relationship: KnowledgeRelationship,
): boolean {
  const expected =
    fingerprintRelationship({
      relationshipId:
        relationship.relationshipId,
      fromEntityId:
        relationship.fromEntityId,
      toEntityId:
        relationship.toEntityId,
      type: relationship.type,
      polarity:
        relationship.polarity,
      confidence:
        relationship.confidence,
      evidenceIds:
        relationship.evidenceIds,
      claimIds:
        relationship.claimIds,
      conditions:
        relationship.conditions,
    });

  return (
    expected ===
    relationship.fingerprint
  );
}

export function assertRelationshipIntegrity(
  relationship: KnowledgeRelationship,
): void {
  if (
    !verifyRelationshipFingerprint(
      relationship,
    )
  ) {
    throw new Error(
      `V8_RELATIONSHIP_FINGERPRINT_MISMATCH: relationship "${relationship.relationshipId}" fingerprint is invalid.`,
    );
  }

  if (
    relationship.fromEntityId ===
    relationship.toEntityId
  ) {
    throw new Error(
      `V8_RELATIONSHIP_SELF_REFERENCE: relationship "${relationship.relationshipId}" is a self-reference.`,
    );
  }

  const expectedId =
    deriveRelationshipId({
      fromEntityId:
        relationship.fromEntityId,
      toEntityId:
        relationship.toEntityId,
      type: relationship.type,
    });

  if (
    expectedId !==
    relationship.relationshipId
  ) {
    throw new Error(
      `V8_RELATIONSHIP_ID_MISMATCH: relationship "${relationship.relationshipId}" does not match canonical identity.`,
    );
  }

  if (
    sortedUnique(
      relationship.evidenceIds,
    ).length !==
    relationship.evidenceIds.length
  ) {
    throw new Error(
      `V8_RELATIONSHIP_DUPLICATE_EVIDENCE: relationship "${relationship.relationshipId}" contains duplicate Evidence IDs.`,
    );
  }

  if (
    sortedUnique(
      relationship.claimIds,
    ).length !==
    relationship.claimIds.length
  ) {
    throw new Error(
      `V8_RELATIONSHIP_DUPLICATE_CLAIMS: relationship "${relationship.relationshipId}" contains duplicate Claim IDs.`,
    );
  }

  if (
    sortedUnique(
      relationship.conditions,
    ).length !==
    relationship.conditions.length
  ) {
    throw new Error(
      `V8_RELATIONSHIP_DUPLICATE_CONDITIONS: relationship "${relationship.relationshipId}" contains duplicate Conditions.`,
    );
  }

  if (
    relationship.evidenceIds.length ===
      0 &&
    relationship.claimIds.length ===
      0
  ) {
    throw new Error(
      `V8_RELATIONSHIP_LINEAGE_REQUIRED: relationship "${relationship.relationshipId}" has no Claim or Evidence lineage.`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Entity closure                                                              */
/* -------------------------------------------------------------------------- */

export function assertRelationshipEntitiesExist(
  relationship: KnowledgeRelationship,
  entities: readonly KnowledgeEntity[],
): void {
  assertRelationshipIntegrity(
    relationship,
  );

  const from = findEntityById(
    entities,
    relationship.fromEntityId,
  );

  if (!from) {
    throw new Error(
      `V8_RELATIONSHIP_SOURCE_ENTITY_NOT_FOUND: relationship "${relationship.relationshipId}" references missing source Entity "${relationship.fromEntityId}".`,
    );
  }

  const to = findEntityById(
    entities,
    relationship.toEntityId,
  );

  if (!to) {
    throw new Error(
      `V8_RELATIONSHIP_TARGET_ENTITY_NOT_FOUND: relationship "${relationship.relationshipId}" references missing target Entity "${relationship.toEntityId}".`,
    );
  }

  assertEntityIntegrity(from);
  assertEntityIntegrity(to);
}

export function relationshipEntities(
  relationship: KnowledgeRelationship,
  entities: readonly KnowledgeEntity[],
): {
  readonly from: KnowledgeEntity;
  readonly to: KnowledgeEntity;
} {
  assertRelationshipEntitiesExist(
    relationship,
    entities,
  );

  const from = findEntityById(
    entities,
    relationship.fromEntityId,
  );

  const to = findEntityById(
    entities,
    relationship.toEntityId,
  );

  if (!from || !to) {
    throw new Error(
      `V8_RELATIONSHIP_ENTITY_CLOSURE: relationship "${relationship.relationshipId}" has incomplete Entity closure.`,
    );
  }

  return Object.freeze({
    from,
    to,
  });
}

/* -------------------------------------------------------------------------- */
/* Lookup                                                                      */
/* -------------------------------------------------------------------------- */

export function findRelationshipById(
  relationships: readonly KnowledgeRelationship[],
  relationshipId: string,
): KnowledgeRelationship | undefined {
  for (const relationship of relationships) {
    if (
      relationship.relationshipId ===
      relationshipId
    ) {
      assertRelationshipIntegrity(
        relationship,
      );

      return relationship;
    }
  }

  return undefined;
}

export function findRelationship(
  relationships: readonly KnowledgeRelationship[],
  fromEntityId: EntityId,
  toEntityId: EntityId,
  type: KnowledgeRelationshipType,
): KnowledgeRelationship | undefined {
  const expectedId =
    deriveRelationshipId({
      fromEntityId,
      toEntityId,
      type,
    });

  return findRelationshipById(
    relationships,
    expectedId,
  );
}

export function requireRelationship(
  relationships: readonly KnowledgeRelationship[],
  relationshipId: string,
): KnowledgeRelationship {
  const relationship =
    findRelationshipById(
      relationships,
      relationshipId,
    );

  if (!relationship) {
    throw new Error(
      `V8_RELATIONSHIP_NOT_FOUND: relationship "${relationshipId}" does not exist.`,
    );
  }

  return relationship;
}

/* -------------------------------------------------------------------------- */
/* Directional indexes                                                         */
/* -------------------------------------------------------------------------- */

export function outgoingRelationships(
  relationships: readonly KnowledgeRelationship[],
  entityId: EntityId,
): readonly KnowledgeRelationship[] {
  return Object.freeze(
    relationships
      .filter((relationship) => {
        assertRelationshipIntegrity(
          relationship,
        );

        return (
          relationship.fromEntityId ===
          entityId
        );
      })
      .sort((a, b) =>
        a.relationshipId.localeCompare(
          b.relationshipId,
        ),
      ),
  );
}

export function incomingRelationships(
  relationships: readonly KnowledgeRelationship[],
  entityId: EntityId,
): readonly KnowledgeRelationship[] {
  return Object.freeze(
    relationships
      .filter((relationship) => {
        assertRelationshipIntegrity(
          relationship,
        );

        return (
          relationship.toEntityId ===
          entityId
        );
      })
      .sort((a, b) =>
        a.relationshipId.localeCompare(
          b.relationshipId,
        ),
      ),
  );
}

export function relationshipsForEntity(
  relationships: readonly KnowledgeRelationship[],
  entityId: EntityId,
): readonly KnowledgeRelationship[] {
  const result = [
    ...outgoingRelationships(
      relationships,
      entityId,
    ),
    ...incomingRelationships(
      relationships,
      entityId,
    ),
  ];

  const map = new Map<
    string,
    KnowledgeRelationship
  >();

  for (const relationship of result) {
    map.set(
      relationship.relationshipId,
      relationship,
    );
  }

  return Object.freeze(
    [...map.values()].sort((a, b) =>
      a.relationshipId.localeCompare(
        b.relationshipId,
      ),
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* Relationship type index                                                     */
/* -------------------------------------------------------------------------- */

export function relationshipsOfType(
  relationships: readonly KnowledgeRelationship[],
  type: KnowledgeRelationshipType,
): readonly KnowledgeRelationship[] {
  return Object.freeze(
    relationships
      .filter((relationship) => {
        assertRelationshipIntegrity(
          relationship,
        );

        return relationship.type === type;
      })
      .sort((a, b) =>
        a.relationshipId.localeCompare(
          b.relationshipId,
        ),
      ),
  );
}

/* -------------------------------------------------------------------------- */
/* Polarity index                                                              */
/* -------------------------------------------------------------------------- */

export function relationshipsByPolarity(
  relationships: readonly KnowledgeRelationship[],
  polarity: KnowledgePolarity,
): readonly KnowledgeRelationship[] {
  return Object.freeze(
    relationships
      .filter((relationship) => {
        assertRelationshipIntegrity(
          relationship,
        );

        return (
          relationship.polarity ===
          polarity
        );
      })
      .sort((a, b) =>
        a.relationshipId.localeCompare(
          b.relationshipId,
        ),
      ),
  );
}

/* -------------------------------------------------------------------------- */
/* Evidence / Claim closure                                                    */
/* -------------------------------------------------------------------------- */

export function relationshipEvidenceClosure(
  relationship: KnowledgeRelationship,
): readonly EvidenceId[] {
  assertRelationshipIntegrity(
    relationship,
  );

  return Object.freeze(
    sortedUnique(
      relationship.evidenceIds,
    ) as readonly EvidenceId[],
  );
}

export function relationshipClaimClosure(
  relationship: KnowledgeRelationship,
): readonly ClaimId[] {
  assertRelationshipIntegrity(
    relationship,
  );

  return Object.freeze(
    sortedUnique(
      relationship.claimIds,
    ) as readonly ClaimId[],
  );
}

/* -------------------------------------------------------------------------- */
/* Deduplication                                                               */
/* -------------------------------------------------------------------------- */

export function deduplicateRelationships(
  relationships: readonly KnowledgeRelationship[],
): readonly KnowledgeRelationship[] {
  const map = new Map<
    string,
    KnowledgeRelationship
  >();

  for (const relationship of relationships) {
    assertRelationshipIntegrity(
      relationship,
    );

    const existing = map.get(
      relationship.relationshipId,
    );

    if (!existing) {
      map.set(
        relationship.relationshipId,
        relationship,
      );

      continue;
    }

    if (
      existing.fromEntityId !==
        relationship.fromEntityId ||
      existing.toEntityId !==
        relationship.toEntityId ||
      existing.type !==
        relationship.type
    ) {
      throw new Error(
        `V8_RELATIONSHIP_ID_COLLISION: RelationshipId "${relationship.relationshipId}" maps to incompatible identities.`,
      );
    }

    if (
      existing.fingerprint !==
      relationship.fingerprint
    ) {
      throw new Error(
        `V8_RELATIONSHIP_MUTATION: RelationshipId "${relationship.relationshipId}" has conflicting fingerprints.`,
      );
    }
  }

  return Object.freeze(
    [...map.values()].sort((a, b) =>
      a.relationshipId.localeCompare(
        b.relationshipId,
      ),
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* Collection fingerprint                                                      */
/* -------------------------------------------------------------------------- */

export function fingerprintRelationshipCollection(
  relationships: readonly KnowledgeRelationship[],
): Fingerprint {
  const canonicalRelationships =
    deduplicateRelationships(
      relationships,
    );

  const material = canonicalize(
    canonicalRelationships.map(
      (relationship) => ({
        relationshipId:
          relationship.relationshipId,
        fromEntityId:
          relationship.fromEntityId,
        toEntityId:
          relationship.toEntityId,
        type: relationship.type,
        polarity:
          relationship.polarity,
        confidence:
          relationship.confidence,
        evidenceIds:
          relationship.evidenceIds,
        claimIds:
          relationship.claimIds,
        conditions:
          relationship.conditions,
        fingerprint:
          relationship.fingerprint,
      }),
    ),
  );

  return fingerprint(
    createHash("sha256")
      .update(
        JSON.stringify(material),
        "utf8",
      )
      .digest("hex"),
  );
}

export function buildRelationshipCollection(
  relationships: readonly KnowledgeRelationship[],
): RelationshipCollectionResult {
  const canonicalRelationships =
    deduplicateRelationships(
      relationships,
    );

  return Object.freeze({
    relationships:
      canonicalRelationships,
    fingerprint:
      fingerprintRelationshipCollection(
        canonicalRelationships,
      ),
  });
}

/* -------------------------------------------------------------------------- */
/* Batch construction                                                          */
/* -------------------------------------------------------------------------- */

export function createRelationships(
  inputs: readonly CreateKnowledgeRelationshipInput[],
): readonly KnowledgeRelationship[] {
  return deduplicateRelationships(
    inputs.map(
      createKnowledgeRelationship,
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* Replacement protection                                                      */
/* -------------------------------------------------------------------------- */

export function assertRelationshipReplacementSafe(
  previous: KnowledgeRelationship,
  next: KnowledgeRelationship,
): void {
  assertRelationshipIntegrity(
    previous,
  );

  assertRelationshipIntegrity(next);

  if (
    previous.relationshipId !==
    next.relationshipId
  ) {
    throw new Error(
      "V8_RELATIONSHIP_REPLACEMENT_ID_CHANGE: RelationshipId cannot change.",
    );
  }

  if (
    previous.fromEntityId !==
    next.fromEntityId
  ) {
    throw new Error(
      "V8_RELATIONSHIP_REPLACEMENT_SOURCE_CHANGE: source EntityId cannot change.",
    );
  }

  if (
    previous.toEntityId !==
    next.toEntityId
  ) {
    throw new Error(
      "V8_RELATIONSHIP_REPLACEMENT_TARGET_CHANGE: target EntityId cannot change.",
    );
  }

  if (
    previous.type !==
    next.type
  ) {
    throw new Error(
      "V8_RELATIONSHIP_REPLACEMENT_TYPE_CHANGE: relationship type cannot change.",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Semantic equality                                                           */
/* -------------------------------------------------------------------------- */

export function relationshipsEqual(
  left: KnowledgeRelationship,
  right: KnowledgeRelationship,
): boolean {
  return (
    left.relationshipId ===
      right.relationshipId &&
    left.fromEntityId ===
      right.fromEntityId &&
    left.toEntityId ===
      right.toEntityId &&
    left.type === right.type &&
    left.polarity ===
      right.polarity &&
    left.confidence ===
      right.confidence &&
    JSON.stringify(
      left.evidenceIds,
    ) ===
      JSON.stringify(
        right.evidenceIds,
      ) &&
    JSON.stringify(
      left.claimIds,
    ) ===
      JSON.stringify(
        right.claimIds,
      ) &&
    JSON.stringify(
      left.conditions,
    ) ===
      JSON.stringify(
        right.conditions,
      ) &&
    left.fingerprint ===
      right.fingerprint
  );
}

/* -------------------------------------------------------------------------- */
/* Immutable clone                                                             */
/* -------------------------------------------------------------------------- */

export function cloneRelationship(
  relationship: KnowledgeRelationship,
): KnowledgeRelationship {
  assertRelationshipIntegrity(
    relationship,
  );

  return Object.freeze({
    relationshipId:
      relationship.relationshipId,
    fromEntityId:
      relationship.fromEntityId,
    toEntityId:
      relationship.toEntityId,
    type: relationship.type,
    polarity:
      relationship.polarity,
    confidence:
      relationship.confidence,
    evidenceIds: Object.freeze([
      ...relationship.evidenceIds,
    ]),
    claimIds: Object.freeze([
      ...relationship.claimIds,
    ]),
    conditions: Object.freeze([
      ...relationship.conditions,
    ]),
    fingerprint:
      relationship.fingerprint,
  });
}

/* -------------------------------------------------------------------------- */
/* Snapshot                                                                    */
/* -------------------------------------------------------------------------- */

export interface RelationshipModelSnapshot {
  readonly version: 1;
  readonly relationships: readonly KnowledgeRelationship[];
  readonly fingerprint: Fingerprint;
}

export function createRelationshipModelSnapshot(
  relationships: readonly KnowledgeRelationship[],
): RelationshipModelSnapshot {
  const collection =
    buildRelationshipCollection(
      relationships,
    );

  return Object.freeze({
    version: 1,
    relationships:
      collection.relationships,
    fingerprint:
      collection.fingerprint,
  });
}