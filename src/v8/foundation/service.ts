import {
  createScope,
  type Scope,
} from "../domain/scope.js";import {
  createContext,
  type Context,
} from "../domain/context.js";import {
  immutable,
  invariant,
} from "../constitution/invariants.js";

import {
  evidenceId,
  nonEmpty,
} from "../domain/primitives.js";

import {
  createSource,
  type Source,
} from "../domain/source.js";

import {
  createEvidence,
  type Evidence,
} from "../domain/evidence.js";

import {
  createClaim,
  type Claim,
} from "../domain/claim.js";

import {
  createKnowledge,
  type Knowledge,
} from "../domain/knowledge.js";

import {
  contentFingerprint,
  rawBytesFingerprint,
} from "./hash.js";

import {
  assertAuthoritativeSource,
} from "./authority-gate.js";

import {
  assertEvidenceReady,
} from "./evidence-gate.js";

import {
  assertClaimReady,
} from "./claim-gate.js";

import {
  recordVerification,
  hasPassingVerification,
} from "./verification.js";

import type {
  AuditActor,
  ClaimPayload,
  EvidencePayload,
  FoundationRecord,
  FoundationStore,
  KnowledgePayload,
  LineageLink,
  SnapshotPayload,
} from "./types.js";

export interface SnapshotInput {
  readonly source: Source;
  readonly capturedAt: string;
  readonly locator: string;
  readonly metadataOnly: boolean;
  readonly content?: string;
  readonly rawBytes?: Uint8Array;
  readonly requestedUrl?: string;
  readonly finalUrl?: string;
  readonly redirectChain?: readonly string[];
  readonly mediaType?: string;
  readonly blobLocator?: string;
}

function uniqueLineage(
  items: readonly LineageLink[],
): LineageLink[] {
  return [
    ...new Map(
      items.map((lineage) => [
        `${lineage.type}:${lineage.id}:${lineage.version}`,
        lineage,
      ]),
    ).values(),
  ];
}

export class FoundationService {
  private readonly store: FoundationStore;

  constructor(store: FoundationStore) {
    this.store = store;
  }

  get storeView(): FoundationStore {
    return this.store;
  }

  registerSource(
    input: Source,
    actor: AuditActor,
    reason = "source registration",
  ) {
    const source = createSource(input);

    assertAuthoritativeSource(source);

    invariant(
      !this.store.get("SOURCE", source.id),
      "V8_FOUNDATION_SOURCE_EXISTS",
      "Source identity already exists.",
    );

    return this.store.append({
      aggregateType: "SOURCE",
      aggregateId: source.id,
      version: 1,
      state: "REGISTERED",
      payload: source,
      lineage: [],
      actor,
      reason,
    });
  }

  captureSnapshot(
    input: SnapshotInput,
    actor: AuditActor,
    reason = "snapshot capture",
  ) {
    nonEmpty(
      input.capturedAt,
      "snapshot.capturedAt",
    );

    nonEmpty(
      input.locator,
      "snapshot.locator",
    );

    if (input.metadataOnly) {
      invariant(
        input.content === undefined &&
          input.rawBytes === undefined,
        "V8_FOUNDATION_METADATA_PAYLOAD_FORBIDDEN",
        "Metadata-only sources cannot persist payload.",
      );
    }

    invariant(
      !(
        input.content !== undefined &&
        input.rawBytes !== undefined
      ),
      "V8_FOUNDATION_DUAL_PAYLOAD",
      "Snapshot must use text or raw bytes, not both.",
    );

    const sourceRecord =
      this.store.get<Source>(
        "SOURCE",
        input.source.id,
      );

    invariant(
      sourceRecord !== null,
      "V8_FOUNDATION_SOURCE_NOT_REGISTERED",
      `Source ${input.source.id} is not registered.`,
    );

    const hash = input.rawBytes
      ? rawBytesFingerprint(input.rawBytes)
      : contentFingerprint(
          input.content ?? {
            locator: input.locator,
            capturedAt: input.capturedAt,
          },
        );

    if (input.source.documentHash) {
      invariant(
        hash === input.source.documentHash,
        "V8_FOUNDATION_DOCUMENT_HASH_MISMATCH",
        "Captured bytes do not match Source documentHash.",
      );
    }

    const payload: SnapshotPayload =
      immutable({
        sourceId: input.source.id,
        capturedAt: input.capturedAt,
        locator: input.locator.trim(),
        contentHash: hash,
        metadataOnly: input.metadataOnly,

        ...(input.content === undefined
          ? {}
          : { payload: input.content }),

        ...(input.requestedUrl
          ? { requestedUrl: input.requestedUrl }
          : {}),

        ...(input.finalUrl
          ? { finalUrl: input.finalUrl }
          : {}),

        ...(input.redirectChain
          ? {
              redirectChain: [
                ...input.redirectChain,
              ],
            }
          : {}),

        ...(input.mediaType
          ? { mediaType: input.mediaType }
          : {}),

        ...(input.rawBytes
          ? {
              byteLength:
                input.rawBytes.byteLength,
            }
          : {}),

        ...(input.blobLocator
          ? { blobLocator: input.blobLocator }
          : {}),
      });

    const id =
      `snapshot:${input.source.id}:${hash}`;

    if (this.store.get("SNAPSHOT", id)) {
      return this.store.get<SnapshotPayload>(
        "SNAPSHOT",
        id,
      )!;
    }

    return this.store.append({
      aggregateType: "SNAPSHOT",
      aggregateId: id,
      version: 1,
      state: "CAPTURED",
      payload,
      lineage: [
        {
          type: "SOURCE",
          id: sourceRecord.aggregateId,
          version: sourceRecord.version,
          fingerprint: sourceRecord.fingerprint,
        },
      ],
      actor,
      reason,
    });
  }

  sealSnapshot(
    id: string,
    actor: AuditActor,
    reason = "snapshot sealed",
  ) {
    const current =
      this.store.get<SnapshotPayload>(
        "SNAPSHOT",
        id,
      );

    invariant(
      current !== null,
      "V8_FOUNDATION_SNAPSHOT_NOT_FOUND",
      `Snapshot ${id} not found.`,
    );

    return this.store.append({
      aggregateType: "SNAPSHOT",
      aggregateId: id,
      version: current.version + 1,
      state: "SEALED",
      payload: current.payload,
      lineage: current.lineage,
      actor,
      reason,
    });
  }

  ingestEvidence(
    input: Omit<Evidence, "id"> & {
      id?: string;
      snapshotId: string;
    },
    actor: AuditActor,
    reason = "evidence ingestion",
  ) {
    const snapshot =
      this.store.get<SnapshotPayload>(
        "SNAPSHOT",
        input.snapshotId,
      );

    invariant(
      snapshot !== null &&
        snapshot.state === "SEALED",
      "V8_FOUNDATION_SNAPSHOT_NOT_SEALED",
      "Evidence may only be ingested from a sealed snapshot.",
    );

    const evidence =
      createEvidence(input);

    assertEvidenceReady(evidence);

    const payload: EvidencePayload =
      immutable({
        sourceId: evidence.sourceId,
        snapshotId: input.snapshotId,
        locator: evidence.locator,
        excerpt: evidence.excerpt,

        evidenceHash:
          contentFingerprint({
            excerpt: evidence.excerpt,
            locator: evidence.locator,
            snapshot: snapshot.fingerprint,
          }),

        capturedAt: evidence.capturedAt,

        verificationStatus:
          evidence.verificationStatus ??
          "UNVERIFIED",

        ...Object.fromEntries(
          [
            "page",
            "printedPage",
            "section",
            "table",
            "row",
            "parameter",
            "value",
            "unit",
            "materialManufacturer",
            "materialGrade",
            "testMethod",
            "testCondition",
            "flowDirection",
            "extractionMethod",
            "extractionConfidence",
          ]
            .filter(
              (key) =>
                (evidence as any)[key] !==
                undefined,
            )
            .map((key) => [
              key,
              (evidence as any)[key],
            ]),
        ),
      });

    const lineage = uniqueLineage([
      ...snapshot.lineage,
      {
        type: "SNAPSHOT",
        id: snapshot.aggregateId,
        version: snapshot.version,
        fingerprint: snapshot.fingerprint,
      },
    ]);

    return this.store.append({
      aggregateType: "EVIDENCE",
      aggregateId: evidence.id,
      version: 1,
      state: "INGESTED",
      payload,
      lineage,
      actor,
      reason,
    });
  }

  auditEvidence(
    id: string,
    actor: AuditActor,
    reason = "evidence audit",
  ) {
    const current =
      this.store.get<EvidencePayload>(
        "EVIDENCE",
        id,
      );

    invariant(
      current !== null,
      "V8_FOUNDATION_EVIDENCE_NOT_FOUND",
      `Evidence ${id} not found.`,
    );

    invariant(
      current.state === "INGESTED" ||
        current.state === "AUDITED" ||
        current.state === "REQUIRES_REVIEW",
      "V8_FOUNDATION_EVIDENCE_NOT_AUDITABLE",
      "Evidence is not auditable.",
    );

    const source =
      this.store.get<Source>(
        "SOURCE",
        current.payload.sourceId,
      );

    invariant(
      source !== null,
      "V8_FOUNDATION_SOURCE_NOT_FOUND",
      "Evidence source missing.",
    );

    const snapshot =
      this.store.get<SnapshotPayload>(
        "SNAPSHOT",
        current.payload.snapshotId,
      );

    invariant(
      snapshot !== null &&
        snapshot.state === "SEALED",
      "V8_FOUNDATION_SNAPSHOT_NOT_SEALED",
      "Evidence snapshot is not sealed.",
    );

    assertEvidenceReady({
      ...current.payload,
      id: evidenceId(current.aggregateId),
      sourceId: current.payload.sourceId,
      ingestion: "INGESTED",
    } as Evidence);

    recordVerification(
      this.store,
      "EVIDENCE",
      id,
      "PASS",
      [
        "source exists",
        "sealed snapshot exists",
        "exact locator present",
        "raw excerpt present",
        "evidence hash bound to snapshot",
      ],
      actor,
      current.payload.evidenceHash,
    );

    return this.store.append({
      aggregateType: "EVIDENCE",
      aggregateId: id,
      version: current.version + 1,
      state: "AUDITED",
      payload: current.payload,
      lineage: current.lineage,
      actor,
      reason,
    });
  }
  verifyEvidence(
    id: string,
    actor: AuditActor,
    reason = "evidence verification",
  ) {
    const current =
      this.store.get<EvidencePayload>(
        "EVIDENCE",
        id,
      );

    invariant(
      current !== null,
      "V8_FOUNDATION_EVIDENCE_NOT_FOUND",
      `Evidence ${id} not found.`,
    );

    invariant(
      current.state === "INGESTED" ||
        current.state === "AUDITED" ||
        current.state === "REQUIRES_REVIEW",
      "V8_FOUNDATION_EVIDENCE_NOT_AUDITABLE",
      "Evidence is not verifiable.",
    );

    const source =
      this.store.get<Source>(
        "SOURCE",
        current.payload.sourceId,
      );

    invariant(
      source !== null,
      "V8_FOUNDATION_SOURCE_NOT_FOUND",
      "Evidence source missing.",
    );

    const snapshot =
      this.store.get<SnapshotPayload>(
        "SNAPSHOT",
        current.payload.snapshotId,
      );

    invariant(
      snapshot !== null &&
        snapshot.state === "SEALED",
      "V8_FOUNDATION_SNAPSHOT_NOT_SEALED",
      "Evidence snapshot is not sealed.",
    );

    assertEvidenceReady({
      ...current.payload,
      id: evidenceId(current.aggregateId),
      sourceId: current.payload.sourceId,
      ingestion: "INGESTED",
    } as Evidence);

    recordVerification(
      this.store,
      "EVIDENCE",
      id,
      "PASS",
      [
        "source exists",
        "sealed snapshot exists",
        "exact locator present",
        "raw excerpt present",
        "evidence hash bound to snapshot",
      ],
      actor,
      current.payload.evidenceHash,
    );

    const audited = this.store.append({
      aggregateType: "EVIDENCE",
      aggregateId: id,
      version: current.version + 1,
      state: "AUDITED",
      payload: current.payload,
      lineage: current.lineage,
      actor,
      reason,
    });

    return this.store.append({
      aggregateType: "EVIDENCE",
      aggregateId: id,
      version: audited.version + 1,
      state: "VERIFIED",
      payload: {
        ...current.payload,
        verificationStatus: "VERIFIED",
      },
      lineage: audited.lineage,
      actor,
      reason,
    });
  }

  createClaim(
    claim: Claim,
    actor: AuditActor,
    reason = "claim verification",
  ) {
    const prepared =
      createClaim({
        ...claim,
        status: "REQUIRES_REVIEW",
      });

    const evidenceRecords =
      prepared.evidenceIds.map(
        (id) =>
          this.store.get<EvidencePayload>(
            "EVIDENCE",
            id,
          ),
      );

    invariant(
      evidenceRecords.every(
        (record) =>
          record !== null &&
          record.state === "VERIFIED",
      ),
      "V8_FOUNDATION_CLAIM_EVIDENCE_NOT_VERIFIED",
      "Every cited evidence must be verified.",
    );

    assertClaimReady(
      {
        ...prepared,
        epistemicLevel:
          (claim as any).epistemicLevel,
        isUniversal:
          (claim as any).isUniversal,
      } as any,
      evidenceRecords as FoundationRecord<EvidencePayload>[],
    );

    const checks = [
      "all cited evidence exists",
      "all cited evidence is verified",
      "claim provenance is explicit",
    ];

    const verification =
      recordVerification(
        this.store,
        "CLAIM",
        prepared.id,
        "PASS",
        checks,
        actor,
      );

    invariant(
      verification.state === "VERIFIED",
      "V8_FOUNDATION_CLAIM_VERIFICATION_FAILED",
      "Claim verification did not pass.",
    );

    const lineage = uniqueLineage(
      (
        evidenceRecords as FoundationRecord<EvidencePayload>[]
      ).flatMap((record) => [
        ...record.lineage,
        {
          type: "EVIDENCE",
          id: record.aggregateId,
          version: record.version,
          fingerprint: record.fingerprint,
        },
      ]),
    );

    const payload: ClaimPayload =
      immutable({
        statement: prepared.statement,
        evidenceIds: prepared.evidenceIds,

        ...((claim as any).scope
          ? { scope: (claim as any).scope }
          : {}),

        ...((claim as any).conditions
          ? {
              conditions: [
                ...(claim as any)
                  .conditions,
              ],
            }
          : {}),

        ...((claim as any).units
          ? {
              units: [
                ...(claim as any).units,
              ],
            }
          : {}),

        ...((claim as any).confidence
          ? {
              confidence:
                (claim as any).confidence,
            }
          : {}),

        ...((claim as any).epistemicLevel
          ? {
              epistemicLevel:
                (claim as any)
                  .epistemicLevel,
            }
          : {}),

        ...((claim as any)
          .isUniversal !== undefined
          ? {
              isUniversal:
                (claim as any)
                  .isUniversal,
            }
          : {}),
      });

    return this.store.append({
      aggregateType: "CLAIM",
      aggregateId: prepared.id,
      version: 1,
      state: "VERIFIED",
      payload,
      lineage,
      actor,
      reason,
    });
  }

  registerScope(
    scope: Scope,
    actor: AuditActor,
    reason = "scope registration",
  ) {
    const prepared = createScope(scope);
    invariant(
      !this.store.get("SCOPE", prepared.id),
      "V8_FOUNDATION_SCOPE_EXISTS",
      "Scope identity already exists.",
    );
    return this.store.append({
      aggregateType: "SCOPE",
      aggregateId: prepared.id,
      version: 1,
      state: "REGISTERED",
      payload: {
        geography: prepared.geography,
        industries: prepared.industries,
        languages: prepared.languages,
      },
      lineage: [],
      actor,
      reason,
    });
  }
  registerContext(
    context: Context,
    actor: AuditActor,
    reason = "context registration",
  ) {
    const prepared = createContext(context);
    const scope = this.store.get(
      "SCOPE",
      prepared.scopeId,
    );
    invariant(
      scope !== null &&
        scope.state === "REGISTERED",
      "V8_FOUNDATION_CONTEXT_SCOPE_NOT_REGISTERED",
      `Context scope ${prepared.scopeId} is not registered.`,
    );
    invariant(
      !this.store.get("CONTEXT", prepared.id),
      "V8_FOUNDATION_CONTEXT_EXISTS",
      "Context identity already exists.",
    );
    return this.store.append({
      aggregateType: "CONTEXT",
      aggregateId: prepared.id,
      version: 1,
      state: "REGISTERED",
      payload: {
        scopeId: prepared.scopeId,
        purpose: prepared.purpose,
        variables: prepared.variables,
      },
      lineage: [
        {
          type: "SCOPE",
          id: scope.aggregateId,
          version: scope.version,
          fingerprint: scope.fingerprint,
        },
      ],
      actor,
      reason,
    });
  }  createKnowledge(
    knowledge: Knowledge,
    actor: AuditActor,
    reason = "knowledge approval",
  ) {
    const prepared =
      createKnowledge(knowledge);

    invariant(
      prepared.status === "APPROVED",
      "V8_FOUNDATION_KNOWLEDGE_NOT_APPROVED",
      "Only approved knowledge can persist.",
    );

    const claimRecords =
      prepared.claimIds.map(
        (id) =>
          this.store.get<ClaimPayload>(
            "CLAIM",
            id,
          ),
      );

    invariant(
      claimRecords.every(
        (record) =>
          record !== null &&
          record.state === "VERIFIED",
      ),
      "V8_FOUNDATION_KNOWLEDGE_CLAIM_NOT_VERIFIED",
      "Every supporting claim must be verified.",
    );

    const lineage = uniqueLineage(
      (
        claimRecords as FoundationRecord<ClaimPayload>[]
      ).flatMap((record) => [
        ...record.lineage,
        {
          type: "CLAIM",
          id: record.aggregateId,
          version: record.version,
          fingerprint: record.fingerprint,
        },
      ]),
    );

    return this.store.append({
      aggregateType: "KNOWLEDGE",
      aggregateId: prepared.id,
      version: 1,
      state: "VERIFIED",
      payload: {
        proposition: prepared.proposition,
        claimIds: prepared.claimIds,
      },
      lineage,
      actor,
      reason,
    });
  }
}
