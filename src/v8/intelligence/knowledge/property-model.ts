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
  DEFAULT_KNOWLEDGE_CONFIDENCE,
  DEFAULT_KNOWLEDGE_TRUTH_STATE,
  type CreateKnowledgePropertyInput,
  type KnowledgeConfidence,
  type KnowledgeEntity,
  type KnowledgeProperty,
  type KnowledgePropertyType,
  type KnowledgeTruthState,
  type KnowledgeValue,
  type KnowledgeValueKind,
} from "./types.js";

import {
  assertEntityIntegrity,
  findEntityById,
} from "./entity-model.js";

/**
 * NEXMOLD V8 — Engineering Knowledge Property Model
 *
 * Phase 2.2
 *
 * A Property is a typed semantic assertion about an Engineering Entity.
 *
 * Canonical chain:
 *
 * Entity
 *   ↓
 * Property
 *   ↓
 * Claim
 *   ↓
 * Evidence
 *
 * This module does NOT decide whether a Property is publishable.
 * It only guarantees deterministic construction, normalization,
 * identity, fingerprinting, lookup, and structural integrity.
 */

/* -------------------------------------------------------------------------- */
/* Property identity                                                           */
/* -------------------------------------------------------------------------- */

export interface PropertyIdentityInput {
  readonly entityId: EntityId;
  readonly type: KnowledgePropertyType;
  readonly normalizedName: string;
}

export interface PropertyLookupKey {
  readonly propertyId: string;
  readonly entityId: EntityId;
  readonly type: KnowledgePropertyType;
  readonly normalizedName: string;
}

export interface PropertyCollectionResult {
  readonly properties: readonly KnowledgeProperty[];
  readonly fingerprint: Fingerprint;
}

/* -------------------------------------------------------------------------- */
/* Normalization                                                               */
/* -------------------------------------------------------------------------- */

export function normalizePropertyName(value: string): string {
  return nonEmpty(
    value
      .normalize("NFKC")
      .trim()
      .replace(/\s+/gu, " ")
      .toLocaleLowerCase("en-US"),
    "property.name",
  );
}

export function normalizePropertyUnit(
  value: string | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return nonEmpty(
    value
      .normalize("NFKC")
      .trim()
      .replace(/\s+/gu, " "),
    "property.unit",
  );
}

export function normalizePropertyText(
  value: string | undefined,
  field: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return nonEmpty(
    value
      .normalize("NFKC")
      .trim()
      .replace(/\s+/gu, " "),
    field,
  );
}

/* -------------------------------------------------------------------------- */
/* Value normalization                                                         */
/* -------------------------------------------------------------------------- */

function normalizeScalarValue(
  value: string | number | boolean,
): string | number | boolean {
  if (typeof value === "string") {
    return value
      .normalize("NFKC")
      .trim()
      .replace(/\s+/gu, " ");
  }

  return value;
}

function normalizeNumber(
  value: number | undefined,
  field: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isFinite(value)) {
    throw new Error(
      `V8_PROPERTY_INVALID_NUMBER: ${field} must be finite.`,
    );
  }

  return value;
}

export function normalizeKnowledgeValue(
  value: KnowledgeValue,
): KnowledgeValue {
  if (value.kind === "RANGE") {
    const minimum = normalizeNumber(
      value.minimum,
      "property.value.minimum",
    );

    const maximum = normalizeNumber(
      value.maximum,
      "property.value.maximum",
    );

    if (
      minimum !== undefined &&
      maximum !== undefined &&
      minimum > maximum
    ) {
      throw new Error(
        "V8_PROPERTY_INVALID_RANGE: minimum cannot exceed maximum.",
      );
    }

    if (
      minimum === undefined &&
      maximum === undefined
    ) {
      throw new Error(
        "V8_PROPERTY_EMPTY_RANGE: range must contain minimum or maximum.",
      );
    }

    return Object.freeze({
      kind: "RANGE",
      minimum,
      maximum,
      inclusiveMinimum:
        value.inclusiveMinimum ?? true,
      inclusiveMaximum:
        value.inclusiveMaximum ?? true,
      unit: normalizePropertyUnit(value.unit),
    });
  }

  return Object.freeze({
    kind: value.kind,
    value: normalizeScalarValue(value.value),
    unit: normalizePropertyUnit(value.unit),
    normalizedValue:
      value.normalizedValue === undefined
        ? undefined
        : normalizePropertyText(
            value.normalizedValue,
            "property.value.normalizedValue",
          ),
  });
}

export function knowledgeValueKind(
  value: KnowledgeValue,
): KnowledgeValueKind {
  return value.kind;
}

/* -------------------------------------------------------------------------- */
/* Identity                                                                    */
/* -------------------------------------------------------------------------- */

export function canonicalPropertyIdentity(
  input: PropertyIdentityInput,
): string {
  return JSON.stringify(
    canonicalize({
      entityId: input.entityId,
      type: input.type,
      normalizedName: normalizePropertyName(
        input.normalizedName,
      ),
    }),
  );
}

export function derivePropertyId(
  input: PropertyIdentityInput,
): string {
  const material = canonicalPropertyIdentity(input);

  return `property:v8:${createHash("sha256")
    .update(material, "utf8")
    .digest("hex")}`;
}

/* -------------------------------------------------------------------------- */
/* Fingerprint                                                                 */
/* -------------------------------------------------------------------------- */

export function fingerprintProperty(
  property: Omit<KnowledgeProperty, "fingerprint">,
): Fingerprint {
  const material = canonicalize({
    propertyId: property.propertyId,
    entityId: property.entityId,
    type: property.type,
    name: property.name,
    normalizedName: property.normalizedName,
    value: property.value,
    unit: property.unit,
    confidence: property.confidence,
    truthState: property.truthState,
    evidenceIds: property.evidenceIds,
    claimIds: property.claimIds,
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

export function createKnowledgeProperty(
  input: CreateKnowledgePropertyInput,
): KnowledgeProperty {
  const name = nonEmpty(input.name, "property.name");
  const normalizedName = normalizePropertyName(name);

  const expectedId = derivePropertyId({
    entityId: input.entityId,
    type: input.type,
    normalizedName,
  });

  if (input.propertyId !== expectedId) {
    throw new Error(
      `V8_PROPERTY_ID_MISMATCH: supplied PropertyId "${input.propertyId}" does not match canonical identity "${expectedId}".`,
    );
  }

  const value =
    input.value === undefined
      ? undefined
      : normalizeKnowledgeValue(input.value);

  const unit = normalizePropertyUnit(input.unit);

  const evidenceIds = sortedUnique(
    input.evidenceIds ?? [],
  ) as readonly EvidenceId[];

  const claimIds = sortedUnique(
    input.claimIds ?? [],
  ) as readonly ClaimId[];

  if (
    input.truthState !== "UNKNOWN" &&
    input.truthState !== "INSUFFICIENT_EVIDENCE" &&
    evidenceIds.length === 0
  ) {
    throw new Error(
      `V8_PROPERTY_EVIDENCE_REQUIRED: non-unknown Property "${expectedId}" requires Evidence.`,
    );
  }

  const propertyWithoutFingerprint: Omit<
    KnowledgeProperty,
    "fingerprint"
  > = {
    propertyId: expectedId,
    entityId: input.entityId,
    type: input.type,
    name,
    normalizedName,
    value,
    unit,
    confidence:
      input.confidence ??
      DEFAULT_KNOWLEDGE_CONFIDENCE,
    truthState:
      input.truthState ??
      DEFAULT_KNOWLEDGE_TRUTH_STATE,
    evidenceIds,
    claimIds,
  };

  return Object.freeze({
    ...propertyWithoutFingerprint,
    fingerprint:
      fingerprintProperty(propertyWithoutFingerprint),
  });
}

/* -------------------------------------------------------------------------- */
/* Preferred deterministic factory                                             */
/* -------------------------------------------------------------------------- */

export function createProperty(
  entityId: EntityId,
  type: KnowledgePropertyType,
  name: string,
  value?: KnowledgeValue,
  options: {
    readonly unit?: string;
    readonly confidence?: KnowledgeConfidence;
    readonly truthState?: KnowledgeTruthState;
    readonly evidenceIds?: readonly EvidenceId[];
    readonly claimIds?: readonly ClaimId[];
  } = {},
): KnowledgeProperty {
  const normalizedName = normalizePropertyName(name);

  return createKnowledgeProperty({
    propertyId: derivePropertyId({
      entityId,
      type,
      normalizedName,
    }),
    entityId,
    type,
    name,
    value,
    unit: options.unit,
    confidence: options.confidence,
    truthState: options.truthState,
    evidenceIds: options.evidenceIds,
    claimIds: options.claimIds,
  });
}

/* -------------------------------------------------------------------------- */
/* Integrity                                                                    */
/* -------------------------------------------------------------------------- */

export function verifyPropertyFingerprint(
  property: KnowledgeProperty,
): boolean {
  const expected = fingerprintProperty({
    propertyId: property.propertyId,
    entityId: property.entityId,
    type: property.type,
    name: property.name,
    normalizedName: property.normalizedName,
    value: property.value,
    unit: property.unit,
    confidence: property.confidence,
    truthState: property.truthState,
    evidenceIds: property.evidenceIds,
    claimIds: property.claimIds,
  });

  return expected === property.fingerprint;
}

export function assertPropertyIntegrity(
  property: KnowledgeProperty,
): void {
  if (!verifyPropertyFingerprint(property)) {
    throw new Error(
      `V8_PROPERTY_FINGERPRINT_MISMATCH: property "${property.propertyId}" fingerprint is invalid.`,
    );
  }

  const expectedId = derivePropertyId({
    entityId: property.entityId,
    type: property.type,
    normalizedName: property.normalizedName,
  });

  if (expectedId !== property.propertyId) {
    throw new Error(
      `V8_PROPERTY_ID_MISMATCH: property "${property.propertyId}" does not match canonical identity.`,
    );
  }

  if (
    normalizePropertyName(property.normalizedName) !==
    property.normalizedName
  ) {
    throw new Error(
      `V8_PROPERTY_NORMALIZATION_MISMATCH: property "${property.propertyId}" normalizedName is not canonical.`,
    );
  }

  if (
    sortedUnique(property.evidenceIds).length !==
    property.evidenceIds.length
  ) {
    throw new Error(
      `V8_PROPERTY_DUPLICATE_EVIDENCE: property "${property.propertyId}" contains duplicate Evidence IDs.`,
    );
  }

  if (
    sortedUnique(property.claimIds).length !==
    property.claimIds.length
  ) {
    throw new Error(
      `V8_PROPERTY_DUPLICATE_CLAIMS: property "${property.propertyId}" contains duplicate Claim IDs.`,
    );
  }

  if (
    property.truthState !== "UNKNOWN" &&
    property.truthState !== "INSUFFICIENT_EVIDENCE" &&
    property.evidenceIds.length === 0
  ) {
    throw new Error(
      `V8_PROPERTY_EVIDENCE_REQUIRED: property "${property.propertyId}" has no Evidence closure.`,
    );
  }

  if (property.value !== undefined) {
    normalizeKnowledgeValue(property.value);
  }
}

/* -------------------------------------------------------------------------- */
/* Entity association                                                          */
/* -------------------------------------------------------------------------- */

export function assertPropertyEntityExists(
  property: KnowledgeProperty,
  entities: readonly KnowledgeEntity[],
): KnowledgeEntity {
  const entity = findEntityById(
    entities,
    property.entityId,
  );

  if (!entity) {
    throw new Error(
      `V8_PROPERTY_ENTITY_NOT_FOUND: property "${property.propertyId}" references missing Entity "${property.entityId}".`,
    );
  }

  return entity;
}

export function assertPropertyBelongsToEntity(
  property: KnowledgeProperty,
  entity: KnowledgeEntity,
): void {
  assertPropertyIntegrity(property);
  assertEntityIntegrity(entity);

  if (property.entityId !== entity.entityId) {
    throw new Error(
      `V8_PROPERTY_ENTITY_MISMATCH: property "${property.propertyId}" does not belong to entity "${entity.entityId}".`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Lookup                                                                      */
/* -------------------------------------------------------------------------- */

export function findPropertyById(
  properties: readonly KnowledgeProperty[],
  propertyId: string,
): KnowledgeProperty | undefined {
  for (const property of properties) {
    if (property.propertyId === propertyId) {
      assertPropertyIntegrity(property);
      return property;
    }
  }

  return undefined;
}

export function findProperty(
  properties: readonly KnowledgeProperty[],
  entityId: EntityId,
  type: KnowledgePropertyType,
  name: string,
): KnowledgeProperty | undefined {
  const normalizedName = normalizePropertyName(name);

  for (const property of properties) {
    assertPropertyIntegrity(property);

    if (
      property.entityId === entityId &&
      property.type === type &&
      property.normalizedName === normalizedName
    ) {
      return property;
    }
  }

  return undefined;
}

export function requireProperty(
  properties: readonly KnowledgeProperty[],
  propertyId: string,
): KnowledgeProperty {
  const property = findPropertyById(
    properties,
    propertyId,
  );

  if (!property) {
    throw new Error(
      `V8_PROPERTY_NOT_FOUND: property "${propertyId}" does not exist.`,
    );
  }

  return property;
}

/* -------------------------------------------------------------------------- */
/* Entity property index                                                       */
/* -------------------------------------------------------------------------- */

export function propertiesForEntity(
  properties: readonly KnowledgeProperty[],
  entityId: EntityId,
): readonly KnowledgeProperty[] {
  return Object.freeze(
    properties
      .filter((property) => {
        assertPropertyIntegrity(property);
        return property.entityId === entityId;
      })
      .sort((a, b) =>
        a.propertyId.localeCompare(b.propertyId),
      ),
  );
}

/* -------------------------------------------------------------------------- */
/* Type index                                                                  */
/* -------------------------------------------------------------------------- */

export function propertiesOfType(
  properties: readonly KnowledgeProperty[],
  type: KnowledgePropertyType,
): readonly KnowledgeProperty[] {
  return Object.freeze(
    properties
      .filter((property) => {
        assertPropertyIntegrity(property);
        return property.type === type;
      })
      .sort((a, b) =>
        a.propertyId.localeCompare(b.propertyId),
      ),
  );
}

/* -------------------------------------------------------------------------- */
/* Truth-state index                                                           */
/* -------------------------------------------------------------------------- */

export function propertiesByTruthState(
  properties: readonly KnowledgeProperty[],
  state: KnowledgeTruthState,
): readonly KnowledgeProperty[] {
  return Object.freeze(
    properties
      .filter((property) => {
        assertPropertyIntegrity(property);
        return property.truthState === state;
      })
      .sort((a, b) =>
        a.propertyId.localeCompare(b.propertyId),
      ),
  );
}

/* -------------------------------------------------------------------------- */
/* Evidence closure                                                            */
/* -------------------------------------------------------------------------- */

export function propertyEvidenceClosure(
  property: KnowledgeProperty,
): readonly EvidenceId[] {
  assertPropertyIntegrity(property);

  return Object.freeze(
    sortedUnique(property.evidenceIds) as readonly EvidenceId[],
  );
}

export function propertyClaimClosure(
  property: KnowledgeProperty,
): readonly ClaimId[] {
  assertPropertyIntegrity(property);

  return Object.freeze(
    sortedUnique(property.claimIds) as readonly ClaimId[],
  );
}

/* -------------------------------------------------------------------------- */
/* Mutation protection                                                         */
/* -------------------------------------------------------------------------- */

export function assertPropertyReplacementSafe(
  previous: KnowledgeProperty,
  next: KnowledgeProperty,
): void {
  assertPropertyIntegrity(previous);
  assertPropertyIntegrity(next);

  if (previous.propertyId !== next.propertyId) {
    throw new Error(
      "V8_PROPERTY_REPLACEMENT_ID_CHANGE: PropertyId cannot change.",
    );
  }

  if (previous.entityId !== next.entityId) {
    throw new Error(
      "V8_PROPERTY_REPLACEMENT_ENTITY_CHANGE: property EntityId cannot change.",
    );
  }

  if (previous.type !== next.type) {
    throw new Error(
      "V8_PROPERTY_REPLACEMENT_TYPE_CHANGE: property type cannot change.",
    );
  }

  if (
    previous.normalizedName !==
    next.normalizedName
  ) {
    throw new Error(
      "V8_PROPERTY_REPLACEMENT_NAME_CHANGE: normalized property identity cannot change.",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Deduplication                                                               */
/* -------------------------------------------------------------------------- */

export function deduplicateProperties(
  properties: readonly KnowledgeProperty[],
): readonly KnowledgeProperty[] {
  const map = new Map<
    string,
    KnowledgeProperty
  >();

  for (const property of properties) {
    assertPropertyIntegrity(property);

    const existing = map.get(property.propertyId);

    if (!existing) {
      map.set(property.propertyId, property);
      continue;
    }

    if (
      existing.entityId !== property.entityId ||
      existing.type !== property.type ||
      existing.normalizedName !==
        property.normalizedName
    ) {
      throw new Error(
        `V8_PROPERTY_ID_COLLISION: PropertyId "${property.propertyId}" maps to incompatible identities.`,
      );
    }

    if (
      existing.fingerprint !==
      property.fingerprint
    ) {
      throw new Error(
        `V8_PROPERTY_MUTATION: PropertyId "${property.propertyId}" has conflicting fingerprints.`,
      );
    }
  }

  return Object.freeze(
    [...map.values()].sort((a, b) =>
      a.propertyId.localeCompare(b.propertyId),
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* Collection fingerprint                                                      */
/* -------------------------------------------------------------------------- */

export function fingerprintPropertyCollection(
  properties: readonly KnowledgeProperty[],
): Fingerprint {
  const canonicalProperties =
    deduplicateProperties(properties);

  const material = canonicalize(
    canonicalProperties.map((property) => ({
      propertyId: property.propertyId,
      entityId: property.entityId,
      type: property.type,
      name: property.name,
      normalizedName: property.normalizedName,
      value: property.value,
      unit: property.unit,
      confidence: property.confidence,
      truthState: property.truthState,
      evidenceIds: property.evidenceIds,
      claimIds: property.claimIds,
      fingerprint: property.fingerprint,
    })),
  );

  return fingerprint(
    createHash("sha256")
      .update(JSON.stringify(material), "utf8")
      .digest("hex"),
  );
}

export function buildPropertyCollection(
  properties: readonly KnowledgeProperty[],
): PropertyCollectionResult {
  const canonicalProperties =
    deduplicateProperties(properties);

  return Object.freeze({
    properties: canonicalProperties,
    fingerprint:
      fingerprintPropertyCollection(
        canonicalProperties,
      ),
  });
}

/* -------------------------------------------------------------------------- */
/* Batch construction                                                          */
/* -------------------------------------------------------------------------- */

export function createProperties(
  inputs: readonly CreateKnowledgePropertyInput[],
): readonly KnowledgeProperty[] {
  return deduplicateProperties(
    inputs.map(createKnowledgeProperty),
  );
}

/* -------------------------------------------------------------------------- */
/* Semantic comparison                                                         */
/* -------------------------------------------------------------------------- */

export function propertiesEqual(
  left: KnowledgeProperty,
  right: KnowledgeProperty,
): boolean {
  return (
    left.propertyId === right.propertyId &&
    left.entityId === right.entityId &&
    left.type === right.type &&
    left.name === right.name &&
    left.normalizedName ===
      right.normalizedName &&
    JSON.stringify(left.value) ===
      JSON.stringify(right.value) &&
    left.unit === right.unit &&
    left.confidence === right.confidence &&
    left.truthState === right.truthState &&
    JSON.stringify(left.evidenceIds) ===
      JSON.stringify(right.evidenceIds) &&
    JSON.stringify(left.claimIds) ===
      JSON.stringify(right.claimIds) &&
    left.fingerprint === right.fingerprint
  );
}

/* -------------------------------------------------------------------------- */
/* Immutable clone                                                             */
/* -------------------------------------------------------------------------- */

export function cloneProperty(
  property: KnowledgeProperty,
): KnowledgeProperty {
  assertPropertyIntegrity(property);

  return Object.freeze({
    propertyId: property.propertyId,
    entityId: property.entityId,
    type: property.type,
    name: property.name,
    normalizedName: property.normalizedName,
    value:
      property.value === undefined
        ? undefined
        : normalizeKnowledgeValue(
            property.value,
          ),
    unit: property.unit,
    confidence: property.confidence,
    truthState: property.truthState,
    evidenceIds: Object.freeze([
      ...property.evidenceIds,
    ]),
    claimIds: Object.freeze([
      ...property.claimIds,
    ]),
    fingerprint: property.fingerprint,
  });
}

/* -------------------------------------------------------------------------- */
/* Snapshot                                                                    */
/* -------------------------------------------------------------------------- */

export interface PropertyModelSnapshot {
  readonly version: 1;
  readonly properties: readonly KnowledgeProperty[];
  readonly fingerprint: Fingerprint;
}

export function createPropertyModelSnapshot(
  properties: readonly KnowledgeProperty[],
): PropertyModelSnapshot {
  const collection =
    buildPropertyCollection(properties);

  return Object.freeze({
    version: 1,
    properties: collection.properties,
    fingerprint: collection.fingerprint,
  });
}