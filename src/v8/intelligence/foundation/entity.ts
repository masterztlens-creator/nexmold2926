import {
  immutable,
  invariant,
} from "../../constitution/invariants.js";

import {
  contentFingerprint,
} from "../../foundation/hash.js";

import {
  normalizeText,
  slugify,
  uniqueStrings,
} from "../shared.js";

import type {
  Fingerprint,
} from "../../domain/primitives.js";

import type {
  JsonValue,
} from "../shared.js";

import type {
  EntityRelationshipType,
  IntelligenceConfidence,
  IntelligenceEntity,
  IntelligenceEntityAttribute,
  IntelligenceEntityRelationship,
  IntelligenceEntityType,
  IntelligenceEvidenceRef,
} from "./types.js";

export interface CreateIntelligenceEntityInput {
  readonly entityId?: string;
  readonly type: IntelligenceEntityType;
  readonly name: string;
  readonly aliases?: readonly string[];
  readonly attributes?: readonly IntelligenceEntityAttribute[];
  readonly relationships?: readonly IntelligenceEntityRelationship[];
  readonly confidence?: IntelligenceConfidence;
  readonly lifecycle?: IntelligenceEntity["lifecycle"];
  readonly evidenceRefs?: readonly IntelligenceEvidenceRef[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export interface CreateEntityRelationshipInput {
  readonly relationshipId?: string;
  readonly fromEntityId: string;
  readonly toEntityId: string;
  readonly type: EntityRelationshipType;
  readonly confidence: IntelligenceConfidence;
  readonly evidenceRefs?: readonly IntelligenceEvidenceRef[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface EntityIdentity {
  readonly type: IntelligenceEntityType;
  readonly normalizedName: string;
  readonly identityFingerprint: Fingerprint;
}

export interface EntityDeduplicationResult {
  readonly duplicate: boolean;
  readonly entityId: string | null;
  readonly identityFingerprint: Fingerprint;
  readonly reason:
    | "IDENTITY_MATCH"
    | "NO_MATCH";
}

export interface EntityMergeResult {
  readonly entity: IntelligenceEntity;
  readonly mergedEntityIds: readonly string[];
  readonly fingerprint: Fingerprint;
}

const CONFIDENCE_RANK: Readonly<
  Record<IntelligenceConfidence, number>
> = {
  VERY_LOW: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  VERY_HIGH: 4,
};

function assertNonEmpty(
  value: string,
  field: string,
): string {
  invariant(
    typeof value === "string" &&
      value.trim().length > 0,
    "V8_INTELLIGENCE_ENTITY_VALUE_REQUIRED",
    `${field} must be non-empty.`,
  );

  return value.trim();
}

function assertConfidence(
  confidence: IntelligenceConfidence,
): void {
  invariant(
    Object.prototype.hasOwnProperty.call(
      CONFIDENCE_RANK,
      confidence,
    ),
    "V8_INTELLIGENCE_ENTITY_CONFIDENCE_INVALID",
    `Unsupported confidence: ${String(confidence)}.`,
  );
}

function normalizeAliases(
  aliases: readonly string[] | undefined,
  normalizedName: string,
): string[] {
  return uniqueStrings(
    (aliases ?? []).filter(
      (alias) =>
        normalizeText(alias) !== normalizedName,
    ),
  );
}

function normalizeAttributes(
  attributes:
    | readonly IntelligenceEntityAttribute[]
    | undefined,
): IntelligenceEntityAttribute[] {
  const values = attributes ?? [];

  const seen = new Set<string>();

  return values
    .map((attribute) => {
      invariant(
        typeof attribute.name === "string" &&
          attribute.name.trim().length > 0,
        "V8_INTELLIGENCE_ENTITY_ATTRIBUTE_NAME_REQUIRED",
        "Entity attribute name must be non-empty.",
      );

      assertConfidence(
        attribute.confidence,
      );

      const name =
        normalizeText(attribute.name);

      invariant(
        !seen.has(name),
        "V8_INTELLIGENCE_ENTITY_ATTRIBUTE_DUPLICATE",
        `Duplicate entity attribute: ${name}.`,
      );

      seen.add(name);

      return immutable({
        name,
        value: attribute.value,
        confidence:
          attribute.confidence,
        evidenceRefs: [
          ...(attribute.evidenceRefs ?? []),
        ],
      });
    });
}

function normalizeRelationships(
  relationships:
    | readonly IntelligenceEntityRelationship[]
    | undefined,
): IntelligenceEntityRelationship[] {
  const values = relationships ?? [];

  const seen = new Set<string>();

  return values
    .map((relationship) => {
      assertNonEmpty(
        relationship.relationshipId,
        "relationshipId",
      );

      assertNonEmpty(
        relationship.fromEntityId,
        "fromEntityId",
      );

      assertNonEmpty(
        relationship.toEntityId,
        "toEntityId",
      );

      assertConfidence(
        relationship.confidence,
      );

      invariant(
        relationship.fromEntityId !==
          relationship.toEntityId ||
          relationship.type === "RELATED_TO",
        "V8_INTELLIGENCE_ENTITY_SELF_RELATION_INVALID",
        "An entity cannot relate to itself unless the relationship is RELATED_TO.",
      );

      const key = [
        relationship.fromEntityId,
        relationship.toEntityId,
        relationship.type,
      ].join(":");

      invariant(
        !seen.has(key),
        "V8_INTELLIGENCE_ENTITY_RELATIONSHIP_DUPLICATE",
        `Duplicate entity relationship: ${key}.`,
      );

      seen.add(key);

      return immutable({
        relationshipId:
          relationship.relationshipId,
        fromEntityId:
          relationship.fromEntityId,
        toEntityId:
          relationship.toEntityId,
        type: relationship.type,
        confidence:
          relationship.confidence,
        evidenceRefs: [
          ...(relationship.evidenceRefs ?? []),
        ],
        ...(relationship.metadata
          ? {
              metadata: {
                ...relationship.metadata,
              },
            }
          : {}),
      });
    });
}

function identityPayload(
  type: IntelligenceEntityType,
  normalizedName: string,
): {
  readonly type: IntelligenceEntityType;
  readonly normalizedName: string;
} {
  return {
    type,
    normalizedName,
  };
}

export function normalizeEntityName(
  name: string,
): string {
  const normalized =
    normalizeText(name);

  invariant(
    normalized.length > 0,
    "V8_INTELLIGENCE_ENTITY_NAME_EMPTY",
    "Entity name must contain meaningful text.",
  );

  return normalized;
}

export function createEntityIdentity(
  type: IntelligenceEntityType,
  name: string,
): EntityIdentity {
  invariant(
    typeof type === "string" &&
      type.length > 0,
    "V8_INTELLIGENCE_ENTITY_TYPE_REQUIRED",
    "Entity type is required.",
  );

  const normalizedName =
    normalizeEntityName(name);

  const identityFingerprint =
    contentFingerprint(
      identityPayload(
        type,
        normalizedName,
      ),
    );

  return immutable({
    type,
    normalizedName,
    identityFingerprint,
  });
}

export function createEntityRelationship(
  input: CreateEntityRelationshipInput,
): IntelligenceEntityRelationship {
  const relationshipId =
    input.relationshipId ??
    slugify(
      [
        input.fromEntityId,
        input.type,
        input.toEntityId,
      ].join("-"),
    );

  assertNonEmpty(
    relationshipId,
    "relationshipId",
  );

  assertNonEmpty(
    input.fromEntityId,
    "fromEntityId",
  );

  assertNonEmpty(
    input.toEntityId,
    "toEntityId",
  );

  assertConfidence(
    input.confidence,
  );

  invariant(
    input.fromEntityId !==
      input.toEntityId ||
      input.type === "RELATED_TO",
    "V8_INTELLIGENCE_ENTITY_SELF_RELATION_INVALID",
    "An entity cannot relate to itself unless the relationship is RELATED_TO.",
  );

  return immutable({
    relationshipId,
    fromEntityId:
      input.fromEntityId,
    toEntityId:
      input.toEntityId,
    type: input.type,
    confidence:
      input.confidence,
    evidenceRefs: [
      ...(input.evidenceRefs ?? []),
    ],
    ...(input.metadata
      ? {
          metadata: {
            ...input.metadata,
          },
        }
      : {}),
  });
}

export function createIntelligenceEntity(
  input: CreateIntelligenceEntityInput,
): IntelligenceEntity {
  const name =
    assertNonEmpty(
      input.name,
      "name",
    );

  const identity =
    createEntityIdentity(
      input.type,
      name,
    );

  const confidence =
    input.confidence ?? "MEDIUM";

  assertConfidence(confidence);

  const aliases =
    normalizeAliases(
      input.aliases,
      identity.normalizedName,
    );

  const attributes =
    normalizeAttributes(
      input.attributes,
    );

  const relationships =
    normalizeRelationships(
      input.relationships,
    );

  const createdAt =
    input.createdAt ??
    "1970-01-01T00:00:00.000Z";

  const updatedAt =
    input.updatedAt ??
    createdAt;

  invariant(
    !Number.isNaN(
      Date.parse(createdAt),
    ),
    "V8_INTELLIGENCE_ENTITY_CREATED_AT_INVALID",
    "createdAt must be a valid ISO timestamp.",
  );

  invariant(
    !Number.isNaN(
      Date.parse(updatedAt),
    ),
    "V8_INTELLIGENCE_ENTITY_UPDATED_AT_INVALID",
    "updatedAt must be a valid ISO timestamp.",
  );

  invariant(
    Date.parse(updatedAt) >=
      Date.parse(createdAt),
    "V8_INTELLIGENCE_ENTITY_TIME_ORDER_INVALID",
    "updatedAt cannot be earlier than createdAt.",
  );

  const entityId =
    input.entityId ??
    `entity:${identity.identityFingerprint}`;

  assertNonEmpty(
    entityId,
    "entityId",
  );

  const evidenceRefs =
    [
      ...(input.evidenceRefs ?? []),
    ];

  const entity =
    immutable({
      entityId,
      type: input.type,
      name,
      normalizedName:
        identity.normalizedName,
      identityFingerprint:
        identity.identityFingerprint,
      aliases,
      attributes,
      relationships,
      confidence,
      lifecycle:
        input.lifecycle ??
        "DISCOVERED",
      evidenceRefs,
      ...(input.metadata
        ? {
            metadata: {
              ...input.metadata,
            },
          }
        : {}),
      createdAt,
      updatedAt,
    }) as IntelligenceEntity;

  return entity;
}

export function compareEntityIdentity(
  left: Pick<
    IntelligenceEntity,
    "type" | "normalizedName"
  >,
  right: Pick<
    IntelligenceEntity,
    "type" | "normalizedName"
  >,
): boolean {
  return (
    left.type === right.type &&
    normalizeEntityName(
      left.normalizedName,
    ) ===
      normalizeEntityName(
        right.normalizedName,
      )
  );
}

export function entityIdentityFingerprint(
  entity: Pick<
    IntelligenceEntity,
    "type" | "normalizedName"
  >,
): Fingerprint {
  return contentFingerprint(
    identityPayload(
      entity.type,
      normalizeEntityName(
        entity.normalizedName,
      ),
    ),
  );
}

export function assertEntityIdentity(
  entity: IntelligenceEntity,
): void {
  const expected =
    entityIdentityFingerprint(
      entity,
    );

  invariant(
    entity.identityFingerprint ===
      expected,
    "V8_INTELLIGENCE_ENTITY_IDENTITY_FINGERPRINT_MISMATCH",
    `Entity ${entity.entityId} identity fingerprint mismatch.`,
  );

  invariant(
    entity.normalizedName ===
      normalizeEntityName(
        entity.name,
      ),
    "V8_INTELLIGENCE_ENTITY_NORMALIZATION_MISMATCH",
    `Entity ${entity.entityId} normalizedName mismatch.`,
  );

  assertConfidence(
    entity.confidence,
  );
}

export function findDuplicateEntity(
  entity: Pick<
    IntelligenceEntity,
    "type" | "normalizedName"
  >,
  existing: readonly IntelligenceEntity[],
): EntityDeduplicationResult {
  const identity =
    createEntityIdentity(
      entity.type,
      entity.normalizedName,
    );

  const match =
    existing.find(
      (candidate) =>
        candidate.identityFingerprint ===
          identity.identityFingerprint ||
        compareEntityIdentity(
          candidate,
          entity,
        ),
    );

  return immutable({
    duplicate:
      match !== undefined,
    entityId:
      match?.entityId ?? null,
    identityFingerprint:
      identity.identityFingerprint,
    reason:
      match !== undefined
        ? "IDENTITY_MATCH"
        : "NO_MATCH",
  });
}

function confidenceMax(
  left: IntelligenceConfidence,
  right: IntelligenceConfidence,
): IntelligenceConfidence {
  return CONFIDENCE_RANK[left] >=
    CONFIDENCE_RANK[right]
    ? left
    : right;
}

function mergeEvidenceRefs(
  left: readonly IntelligenceEvidenceRef[],
  right: readonly IntelligenceEvidenceRef[],
): IntelligenceEvidenceRef[] {
  const map =
    new Map<string, IntelligenceEvidenceRef>();

  for (const ref of [
    ...left,
    ...right,
  ]) {
    const key = [
      ref.evidenceId,
      ref.sourceId ?? "",
      ref.snapshotId ?? "",
      ref.fingerprint ?? "",
      ref.locator ?? "",
    ].join("|");

    map.set(key, ref);
  }

  return [
    ...map.values(),
  ];
}

function mergeAttributes(
  left: readonly IntelligenceEntityAttribute[],
  right: readonly IntelligenceEntityAttribute[],
): IntelligenceEntityAttribute[] {
  const map =
    new Map<
      string,
      IntelligenceEntityAttribute
    >();

  for (const attribute of [
    ...left,
    ...right,
  ]) {
    const key =
      normalizeText(
        attribute.name,
      );

    const previous =
      map.get(key);

    if (!previous) {
      map.set(key, attribute);
      continue;
    }

    const selected =
      CONFIDENCE_RANK[
        attribute.confidence
      ] >
      CONFIDENCE_RANK[
        previous.confidence
      ]
        ? attribute
        : previous;

    map.set(key, selected);
  }

  return [
    ...map.values(),
  ];
}

function mergeRelationships(
  left: readonly IntelligenceEntityRelationship[],
  right: readonly IntelligenceEntityRelationship[],
): IntelligenceEntityRelationship[] {
  const map =
    new Map<
      string,
      IntelligenceEntityRelationship
    >();

  for (const relationship of [
    ...left,
    ...right,
  ]) {
    const key = [
      relationship.fromEntityId,
      relationship.toEntityId,
      relationship.type,
    ].join(":");

    const previous =
      map.get(key);

    if (!previous) {
      map.set(
        key,
        relationship,
      );
      continue;
    }

    const confidence =
      confidenceMax(
        previous.confidence,
        relationship.confidence,
      );

    map.set(
      key,
      immutable({
        ...previous,
        confidence,
        evidenceRefs:
          mergeEvidenceRefs(
            previous.evidenceRefs,
            relationship.evidenceRefs,
          ),
        ...(previous.metadata ||
        relationship.metadata
          ? {
              metadata: {
                ...(previous.metadata ??
                  {}),
                ...(relationship.metadata ??
                  {}),
              },
            }
          : {}),
      }),
    );
  }

  return [
    ...map.values(),
  ];
}

export function mergeIntelligenceEntities(
  primary: IntelligenceEntity,
  secondary: IntelligenceEntity,
): EntityMergeResult {
  assertEntityIdentity(primary);
  assertEntityIdentity(secondary);

  invariant(
    compareEntityIdentity(
      primary,
      secondary,
    ),
    "V8_INTELLIGENCE_ENTITY_MERGE_IDENTITY_CONFLICT",
    "Only entities with identical canonical identity may be merged.",
  );

  const confidence =
    confidenceMax(
      primary.confidence,
      secondary.confidence,
    );

  const aliases =
    uniqueStrings([
      primary.name,
      ...primary.aliases,
      secondary.name,
      ...secondary.aliases,
    ]).filter(
      (value) =>
        value !==
        primary.normalizedName,
    );

  const merged =
    immutable({
      ...primary,
      aliases,
      attributes:
        mergeAttributes(
          primary.attributes,
          secondary.attributes,
        ),
      relationships:
        mergeRelationships(
          primary.relationships,
          secondary.relationships,
        ),
      confidence,
      evidenceRefs:
        mergeEvidenceRefs(
          primary.evidenceRefs,
          secondary.evidenceRefs,
        ),
      updatedAt:
        Date.parse(
          secondary.updatedAt,
        ) >
        Date.parse(
          primary.updatedAt,
        )
          ? secondary.updatedAt
          : primary.updatedAt,
    }) as IntelligenceEntity;

  const fingerprint =
    contentFingerprint({
      entityId:
        merged.entityId,
      type: merged.type,
      normalizedName:
        merged.normalizedName,
      identityFingerprint:
        merged.identityFingerprint,
      aliases: merged.aliases,
      attributes:
        merged.attributes,
      relationships:
        merged.relationships,
      confidence:
        merged.confidence,
      lifecycle:
        merged.lifecycle,
      evidenceRefs:
        merged.evidenceRefs,
      metadata:
        merged.metadata ?? null,
      createdAt:
        merged.createdAt,
      updatedAt:
        merged.updatedAt,
    });

  return immutable({
    entity: merged,
    mergedEntityIds: [
      primary.entityId,
      secondary.entityId,
    ],
    fingerprint,
  });
}

export function deduplicateEntities(
  entities: readonly IntelligenceEntity[],
): readonly IntelligenceEntity[] {
  const result: IntelligenceEntity[] = [];

  const byIdentity =
    new Map<
      string,
      IntelligenceEntity
    >();

  for (const entity of entities) {
    assertEntityIdentity(entity);

    const identity =
      entityIdentityFingerprint(
        entity,
      );

    const existing =
      byIdentity.get(identity);

    if (!existing) {
      byIdentity.set(
        identity,
        entity,
      );
      continue;
    }

    const merged =
      mergeIntelligenceEntities(
        existing,
        entity,
      );

    byIdentity.set(
      identity,
      merged.entity,
    );
  }

  result.push(
    ...byIdentity.values(),
  );

  return immutable([
    ...result,
  ]);
}

export function findEntityById(
  entities: readonly IntelligenceEntity[],
  entityId: string,
): IntelligenceEntity | null {
  const normalizedId =
    assertNonEmpty(
      entityId,
      "entityId",
    );

  return (
    entities.find(
      (entity) =>
        entity.entityId ===
        normalizedId,
    ) ?? null
  );
}

export function findEntitiesByType(
  entities: readonly IntelligenceEntity[],
  type: IntelligenceEntityType,
): readonly IntelligenceEntity[] {
  return immutable(
    entities.filter(
      (entity) =>
        entity.type === type,
    ),
  );
}

export function findEntitiesByName(
  entities: readonly IntelligenceEntity[],
  name: string,
): readonly IntelligenceEntity[] {
  const normalized =
    normalizeEntityName(name);

  return immutable(
    entities.filter(
      (entity) =>
        entity.normalizedName ===
          normalized ||
        entity.aliases.some(
          (alias) =>
            normalizeText(
              alias,
            ) === normalized,
        ),
    ),
  );
}

export function relatedEntities(
  entity: IntelligenceEntity,
  entities: readonly IntelligenceEntity[],
): readonly IntelligenceEntity[] {
  const ids =
    new Set<string>();

  for (const relationship of
    entity.relationships) {
    if (
      relationship.fromEntityId ===
      entity.entityId
    ) {
      ids.add(
        relationship.toEntityId,
      );
    }

    if (
      relationship.toEntityId ===
      entity.entityId
    ) {
      ids.add(
        relationship.fromEntityId,
      );
    }
  }

  return immutable(
    entities.filter(
      (candidate) =>
        ids.has(
          candidate.entityId,
        ),
    ),
  );
}

export function assertEntityGraph(
  entities: readonly IntelligenceEntity[],
): void {
  const ids =
    new Set<string>();

  const identities =
    new Set<string>();

  for (const entity of entities) {
    invariant(
      !ids.has(entity.entityId),
      "V8_INTELLIGENCE_ENTITY_ID_DUPLICATE",
      `Duplicate entity id: ${entity.entityId}.`,
    );

    ids.add(entity.entityId);

    assertEntityIdentity(entity);

    invariant(
      !identities.has(
        entity.identityFingerprint,
      ),
      "V8_INTELLIGENCE_ENTITY_IDENTITY_DUPLICATE",
      `Duplicate entity identity: ${entity.identityFingerprint}.`,
    );

    identities.add(
      entity.identityFingerprint,
    );
  }

  for (const entity of entities) {
    for (const relationship of
      entity.relationships) {
      invariant(
        ids.has(
          relationship.fromEntityId,
        ),
        "V8_INTELLIGENCE_ENTITY_RELATIONSHIP_ORPHAN",
        `Relationship ${relationship.relationshipId} references missing source entity ${relationship.fromEntityId}.`,
      );

      invariant(
        ids.has(
          relationship.toEntityId,
        ),
        "V8_INTELLIGENCE_ENTITY_RELATIONSHIP_ORPHAN",
        `Relationship ${relationship.relationshipId} references missing target entity ${relationship.toEntityId}.`,
      );
    }
  }
}

export function entityFingerprint(
  entity: IntelligenceEntity,
): Fingerprint {
  assertEntityIdentity(entity);

  return contentFingerprint({
    entityId:
      entity.entityId,
    type:
      entity.type,
    name:
      entity.name,
    normalizedName:
      entity.normalizedName,
    identityFingerprint:
      entity.identityFingerprint,
    aliases:
      entity.aliases,
    attributes:
      entity.attributes,
    relationships:
      entity.relationships,
    confidence:
      entity.confidence,
    lifecycle:
      entity.lifecycle,
    evidenceRefs:
      entity.evidenceRefs,
    metadata:
      entity.metadata ?? null,
    createdAt:
      entity.createdAt,
    updatedAt:
      entity.updatedAt,
  });
}