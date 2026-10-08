import { createHash } from "node:crypto";

import {
  canonicalize,
  entityId,
  fingerprint,
  nonEmpty,
  sortedUnique,
  type EntityId,
  type Fingerprint,
} from "../../domain/primitives.js";

import {
  DEFAULT_KNOWLEDGE_CONFIDENCE,
  DEFAULT_KNOWLEDGE_TRUTH_STATE,
  type CreateKnowledgeEntityInput,
  type KnowledgeConfidence,
  type KnowledgeEntity,
  type KnowledgeEntityType,
  type KnowledgeTruthState,
} from "./types.js";

/**
 * NEXMOLD V8 — Engineering Knowledge Entity Model
 *
 * Phase 2.2
 *
 * Responsibilities:
 * - canonical Engineering Entity construction
 * - deterministic normalization
 * - deterministic entity identity
 * - immutable semantic fingerprints
 * - fail-closed input validation
 * - deterministic deduplication and lookup
 *
 * Non-responsibilities:
 * - evidence verification
 * - claim verification
 * - applicability validation
 * - knowledge graph construction
 * - publication authorization
 *
 * Those responsibilities belong to later Phase 2 modules.
 */

export interface EntityModelOptions {
  readonly confidence?: KnowledgeConfidence;
  readonly truthState?: KnowledgeTruthState;
}

export interface EntityIdentityInput {
  readonly type: KnowledgeEntityType;
  readonly normalizedName: string;
}

export interface EntityLookupKey {
  readonly entityId: EntityId;
  readonly type: KnowledgeEntityType;
  readonly normalizedName: string;
}

export interface EntityModelResult {
  readonly entity: KnowledgeEntity;
  readonly identity: EntityLookupKey;
}

export interface EntityCollectionResult {
  readonly entities: readonly KnowledgeEntity[];
  readonly fingerprint: Fingerprint;
}

/* -------------------------------------------------------------------------- */
/* Normalization                                                               */
/* -------------------------------------------------------------------------- */

export function normalizeEntityName(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("en-US");

  return nonEmpty(normalized, "entity.name");
}

export function normalizeEntityAlias(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("en-US");

  return nonEmpty(normalized, "entity.alias");
}

/* -------------------------------------------------------------------------- */
/* Canonical identity                                                          */
/* -------------------------------------------------------------------------- */

export function canonicalEntityIdentity(
  input: EntityIdentityInput,
): string {
  const normalizedName = normalizeEntityName(input.normalizedName);

  return JSON.stringify(
    canonicalize({
      type: input.type,
      normalizedName,
    }),
  );
}

export function deriveEntityId(
  input: EntityIdentityInput,
): EntityId {
  const material = canonicalEntityIdentity(input);

  const digest = createHash("sha256")
    .update(material, "utf8")
    .digest("hex");

  return entityId(`entity:v8:${digest}`);
}

/* -------------------------------------------------------------------------- */
/* Fingerprint                                                                 */
/* -------------------------------------------------------------------------- */

export function fingerprintEntity(
  entity: Omit<KnowledgeEntity, "fingerprint">,
): Fingerprint {
  const material = canonicalize({
    entityId: entity.entityId,
    type: entity.type,
    name: entity.name,
    normalizedName: entity.normalizedName,
    aliases: entity.aliases,
  });

  const digest = createHash("sha256")
    .update(JSON.stringify(material), "utf8")
    .digest("hex");

  return fingerprint(digest);
}

/* -------------------------------------------------------------------------- */
/* Entity construction                                                         */
/* -------------------------------------------------------------------------- */

export function createKnowledgeEntity(
  input: CreateKnowledgeEntityInput,
): KnowledgeEntity {
  const name = nonEmpty(input.name, "entity.name");
  const normalizedName = normalizeEntityName(name);

  const expectedEntityId = deriveEntityId({
    type: input.type,
    normalizedName,
  });

  /**
   * Entity IDs are semantic identities.
   *
   * If the caller supplies an ID, it must agree with the canonical
   * semantic identity. This prevents mutable or caller-defined aliases
   * from creating multiple identities for the same Engineering Entity.
   */
  if (input.entityId !== expectedEntityId) {
    throw new Error(
      `V8_ENTITY_ID_MISMATCH: supplied EntityId "${input.entityId}" does not match canonical identity "${expectedEntityId}".`,
    );
  }

  const aliases = sortedUnique(
    (input.aliases ?? [])
      .map(normalizeEntityAlias)
      .filter((alias) => alias !== normalizedName),
  );

  const entityWithoutFingerprint: Omit<
    KnowledgeEntity,
    "fingerprint"
  > = {
    entityId: expectedEntityId,
    type: input.type,
    name,
    normalizedName,
    aliases,
  };

  return Object.freeze({
    ...entityWithoutFingerprint,
    fingerprint: fingerprintEntity(entityWithoutFingerprint),
  });
}

/* -------------------------------------------------------------------------- */
/* Deterministic entity factory                                                */
/* -------------------------------------------------------------------------- */

/**
 * Creates an Entity without requiring the caller to manufacture an EntityId.
 *
 * This is the preferred construction API for new Knowledge Intelligence
 * entities.
 */
export function createEntity(
  type: KnowledgeEntityType,
  name: string,
  aliases: readonly string[] = [],
): KnowledgeEntity {
  const normalizedName = normalizeEntityName(name);

  return createKnowledgeEntity({
    entityId: deriveEntityId({
      type,
      normalizedName,
    }),
    type,
    name,
    aliases,
  });
}

/* -------------------------------------------------------------------------- */
/* Identity inspection                                                         */
/* -------------------------------------------------------------------------- */

export function entityIdentity(
  entity: KnowledgeEntity,
): EntityLookupKey {
  return Object.freeze({
    entityId: entity.entityId,
    type: entity.type,
    normalizedName: entity.normalizedName,
  });
}

export function sameEntityIdentity(
  left: KnowledgeEntity,
  right: KnowledgeEntity,
): boolean {
  return (
    left.entityId === right.entityId &&
    left.type === right.type &&
    left.normalizedName === right.normalizedName
  );
}

/* -------------------------------------------------------------------------- */
/* Integrity                                                                    */
/* -------------------------------------------------------------------------- */

export function verifyEntityFingerprint(
  entity: KnowledgeEntity,
): boolean {
  const expected = fingerprintEntity({
    entityId: entity.entityId,
    type: entity.type,
    name: entity.name,
    normalizedName: entity.normalizedName,
    aliases: entity.aliases,
  });

  return expected === entity.fingerprint;
}

export function assertEntityIntegrity(
  entity: KnowledgeEntity,
): void {
  if (!verifyEntityFingerprint(entity)) {
    throw new Error(
      `V8_ENTITY_FINGERPRINT_MISMATCH: entity "${entity.entityId}" fingerprint is invalid.`,
    );
  }

  const expectedId = deriveEntityId({
    type: entity.type,
    normalizedName: entity.normalizedName,
  });

  if (expectedId !== entity.entityId) {
    throw new Error(
      `V8_ENTITY_ID_MISMATCH: entity "${entity.entityId}" does not match canonical semantic identity.`,
    );
  }

  if (
    normalizeEntityName(entity.normalizedName) !==
    entity.normalizedName
  ) {
    throw new Error(
      `V8_ENTITY_NORMALIZATION_MISMATCH: entity "${entity.entityId}" normalizedName is not canonical.`,
    );
  }

  const aliases = sortedUnique(entity.aliases);

  if (aliases.length !== entity.aliases.length) {
    throw new Error(
      `V8_ENTITY_ALIAS_DUPLICATE: entity "${entity.entityId}" contains duplicate aliases.`,
    );
  }

  if (aliases.some((alias) => alias !== alias.toLocaleLowerCase("en-US"))) {
    throw new Error(
      `V8_ENTITY_ALIAS_NORMALIZATION_MISMATCH: entity "${entity.entityId}" contains a non-canonical alias.`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Collection                                                                  */
/* -------------------------------------------------------------------------- */

export function deduplicateEntities(
  entities: readonly KnowledgeEntity[],
): readonly KnowledgeEntity[] {
  const map = new Map<string, KnowledgeEntity>();

  for (const entity of entities) {
    assertEntityIntegrity(entity);

    const key = entity.entityId;

    const existing = map.get(key);

    if (!existing) {
      map.set(key, entity);
      continue;
    }

    if (!sameEntityIdentity(existing, entity)) {
      throw new Error(
        `V8_ENTITY_ID_COLLISION: EntityId "${key}" maps to incompatible semantic identities.`,
      );
    }

    if (existing.fingerprint !== entity.fingerprint) {
      throw new Error(
        `V8_ENTITY_MUTATION: EntityId "${key}" has conflicting fingerprints.`,
      );
    }
  }

  return Object.freeze(
    [...map.values()].sort((a, b) =>
      a.entityId.localeCompare(b.entityId),
    ),
  );
}

export function fingerprintEntityCollection(
  entities: readonly KnowledgeEntity[],
): Fingerprint {
  const canonicalEntities = deduplicateEntities(entities);

  const material = canonicalize(
    canonicalEntities.map((entity) => ({
      entityId: entity.entityId,
      type: entity.type,
      name: entity.name,
      normalizedName: entity.normalizedName,
      aliases: entity.aliases,
      fingerprint: entity.fingerprint,
    })),
  );

  const digest = createHash("sha256")
    .update(JSON.stringify(material), "utf8")
    .digest("hex");

  return fingerprint(digest);
}

export function buildEntityCollection(
  entities: readonly KnowledgeEntity[],
): EntityCollectionResult {
  const canonicalEntities = deduplicateEntities(entities);

  return Object.freeze({
    entities: canonicalEntities,
    fingerprint: fingerprintEntityCollection(canonicalEntities),
  });
}

/* -------------------------------------------------------------------------- */
/* Lookup                                                                      */
/* -------------------------------------------------------------------------- */

export function findEntityById(
  entities: readonly KnowledgeEntity[],
  id: EntityId,
): KnowledgeEntity | undefined {
  for (const entity of entities) {
    if (entity.entityId === id) {
      assertEntityIntegrity(entity);
      return entity;
    }
  }

  return undefined;
}

export function findEntity(
  entities: readonly KnowledgeEntity[],
  type: KnowledgeEntityType,
  name: string,
): KnowledgeEntity | undefined {
  const normalizedName = normalizeEntityName(name);

  for (const entity of entities) {
    assertEntityIntegrity(entity);

    if (
      entity.type === type &&
      entity.normalizedName === normalizedName
    ) {
      return entity;
    }
  }

  return undefined;
}

export function requireEntity(
  entities: readonly KnowledgeEntity[],
  id: EntityId,
): KnowledgeEntity {
  const entity = findEntityById(entities, id);

  if (!entity) {
    throw new Error(
      `V8_ENTITY_NOT_FOUND: entity "${id}" does not exist.`,
    );
  }

  return entity;
}

/* -------------------------------------------------------------------------- */
/* Alias matching                                                              */
/* -------------------------------------------------------------------------- */

export function entityMatchesName(
  entity: KnowledgeEntity,
  value: string,
): boolean {
  assertEntityIntegrity(entity);

  const normalized = normalizeEntityName(value);

  return (
    entity.normalizedName === normalized ||
    entity.aliases.includes(normalized)
  );
}

/* -------------------------------------------------------------------------- */
/* Canonical merge                                                             */
/* -------------------------------------------------------------------------- */

export function mergeEntityAliases(
  base: KnowledgeEntity,
  additionalAliases: readonly string[],
): KnowledgeEntity {
  assertEntityIntegrity(base);

  const aliases = sortedUnique([
    ...base.aliases,
    ...additionalAliases.map(normalizeEntityAlias),
  ]).filter((alias) => alias !== base.normalizedName);

  const mergedWithoutFingerprint: Omit<
    KnowledgeEntity,
    "fingerprint"
  > = {
    entityId: base.entityId,
    type: base.type,
    name: base.name,
    normalizedName: base.normalizedName,
    aliases,
  };

  const merged = Object.freeze({
    ...mergedWithoutFingerprint,
    fingerprint: fingerprintEntity(mergedWithoutFingerprint),
  });

  return merged;
}

/* -------------------------------------------------------------------------- */
/* Replacement protection                                                      */
/* -------------------------------------------------------------------------- */

export function assertEntityReplacementSafe(
  previous: KnowledgeEntity,
  next: KnowledgeEntity,
): void {
  assertEntityIntegrity(previous);
  assertEntityIntegrity(next);

  if (previous.entityId !== next.entityId) {
    throw new Error(
      `V8_ENTITY_REPLACEMENT_ID_CHANGE: EntityId cannot change during entity replacement.`,
    );
  }

  if (previous.type !== next.type) {
    throw new Error(
      `V8_ENTITY_REPLACEMENT_TYPE_CHANGE: entity type cannot change for an existing EntityId.`,
    );
  }

  if (previous.normalizedName !== next.normalizedName) {
    throw new Error(
      `V8_ENTITY_REPLACEMENT_NAME_CHANGE: normalized entity identity cannot change for an existing EntityId.`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Batch construction                                                          */
/* -------------------------------------------------------------------------- */

export function createEntities(
  inputs: readonly CreateKnowledgeEntityInput[],
): readonly KnowledgeEntity[] {
  const entities = inputs.map((input) =>
    createKnowledgeEntity(input),
  );

  return deduplicateEntities(entities);
}

/* -------------------------------------------------------------------------- */
/* Entity model snapshot                                                       */
/* -------------------------------------------------------------------------- */

export interface EntityModelSnapshot {
  readonly version: 1;
  readonly entities: readonly KnowledgeEntity[];
  readonly fingerprint: Fingerprint;
}

export function createEntityModelSnapshot(
  entities: readonly KnowledgeEntity[],
): EntityModelSnapshot {
  const collection = buildEntityCollection(entities);

  return Object.freeze({
    version: 1,
    entities: collection.entities,
    fingerprint: collection.fingerprint,
  });
}

/* -------------------------------------------------------------------------- */
/* Deterministic equality                                                      */
/* -------------------------------------------------------------------------- */

export function entitiesEqual(
  left: KnowledgeEntity,
  right: KnowledgeEntity,
): boolean {
  return (
    left.entityId === right.entityId &&
    left.type === right.type &&
    left.name === right.name &&
    left.normalizedName === right.normalizedName &&
    JSON.stringify(left.aliases) === JSON.stringify(right.aliases) &&
    left.fingerprint === right.fingerprint
  );
}

/* -------------------------------------------------------------------------- */
/* Defensive cloning                                                          */
/* -------------------------------------------------------------------------- */

export function cloneEntity(
  entity: KnowledgeEntity,
): KnowledgeEntity {
  assertEntityIntegrity(entity);

  return Object.freeze({
    entityId: entity.entityId,
    type: entity.type,
    name: entity.name,
    normalizedName: entity.normalizedName,
    aliases: Object.freeze([...entity.aliases]),
    fingerprint: entity.fingerprint,
  });
}

/* -------------------------------------------------------------------------- */
/* Semantic defaults exported for downstream builders                         */
/* -------------------------------------------------------------------------- */

export const ENTITY_MODEL_DEFAULTS = Object.freeze({
  confidence: DEFAULT_KNOWLEDGE_CONFIDENCE,
  truthState: DEFAULT_KNOWLEDGE_TRUTH_STATE,
} as const);