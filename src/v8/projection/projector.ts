import {
  immutable,
  invariant,
} from "../constitution/invariants.js";

import {
  contentFingerprint,
} from "../foundation/hash.js";

import type {
  FoundationRecord,
  FoundationStore,
  LineageLink,
} from "../foundation/types.js";

import {
  PublicationEligibilityEvaluator,
} from "../publication-eligibility/evaluator.js";

import type {
  CompiledContent,
} from "../content-compiler/types.js";

import type {
  ProjectionInput,
  ProjectionPayload,
  ProjectionResult,
  ProjectedContent,
} from "./types.js";

interface ContentShape {
  readonly id: string;
  readonly decisionId: string;
  readonly title: string;
  readonly body: string;
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

function hasLineage(
  lineage: readonly LineageLink[],
  target: LineageLink,
): boolean {
  return lineage.some(
    (item) =>
      item.type === target.type &&
      item.id === target.id &&
      item.version === target.version &&
      item.fingerprint === target.fingerprint,
  );
}

export class ProjectionProjector {
  private readonly eligibilityEvaluator: PublicationEligibilityEvaluator;

  constructor(
    private readonly store: FoundationStore,
  ) {
    this.eligibilityEvaluator =
      new PublicationEligibilityEvaluator(store);
  }

  project(
    input: ProjectionInput,
  ): ProjectionResult {
    const compiled = input.compiled;
    const content = compiled.content as ContentShape;

    invariant(
      content.id.trim().length > 0,
      "V8_PROJECTION_CONTENT_ID_EMPTY",
      "Projection requires a non-empty Content id.",
    );

    invariant(
      content.decisionId ===
        compiled.decision.aggregateId,
      "V8_PROJECTION_CONTENT_DECISION_MISMATCH",
      "Projection Content decision does not match compiled Decision.",
    );

    invariant(
      content.title.trim().length > 0,
      "V8_PROJECTION_CONTENT_TITLE_EMPTY",
      "Projection requires a non-empty Content title.",
    );

    invariant(
      content.body.trim().length > 0,
      "V8_PROJECTION_CONTENT_BODY_EMPTY",
      "Projection requires a non-empty Content body.",
    );

    const eligibility =
      this.eligibilityEvaluator.evaluate({
        compiled,
        scopeId: input.scopeId,
        contextId: input.contextId,
      });

    invariant(
      eligibility.eligible &&
        eligibility.status === "ELIGIBLE",
      "V8_PROJECTION_PUBLICATION_NOT_ELIGIBLE",
      eligibility.reasons.join(","),
    );

    const expectedSourceFingerprint =
      contentFingerprint({
        decisionId: compiled.decision.aggregateId,
        scopeId: input.scopeId,
        contextId: input.contextId,
        title: content.title,
        body: content.body,
      });

    invariant(
      compiled.fingerprint ===
        expectedSourceFingerprint,
      "V8_PROJECTION_SOURCE_FINGERPRINT_MISMATCH",
      "Compiled Content fingerprint does not match its canonical projection input.",
    );

    const projectionFingerprint =
      contentFingerprint({
        contentId: content.id,
        decisionId: compiled.decision.aggregateId,
        sourceFingerprint: compiled.fingerprint,
        scopeId: input.scopeId,
        contextId: input.contextId,
        title: content.title,
        body: content.body,
      });

    const projectionId =
      `projection:${content.id}:${input.scopeId}:${input.contextId}`;

    const existing =
      this.store.get<ProjectionPayload>(
        "PROJECTION",
        projectionId,
      );

    if (existing !== null) {
      invariant(
        existing.payload.sourceFingerprint ===
          compiled.fingerprint,
        "V8_PROJECTION_EXISTING_SOURCE_CHANGED",
        "Existing Projection is bound to a different source fingerprint.",
      );

      const existingFingerprint =
        contentFingerprint({
          contentId: existing.payload.contentId,
          decisionId: existing.payload.decisionId,
          sourceFingerprint:
            existing.payload.sourceFingerprint,
          scopeId: existing.payload.scopeId,
          contextId: existing.payload.contextId,
          title: existing.payload.title,
          body: existing.payload.body,
        });

      invariant(
        existing.fingerprint ===
          existingFingerprint,
        "V8_PROJECTION_EXISTING_FINGERPRINT_MISMATCH",
        "Existing Projection fingerprint is invalid.",
      );

      invariant(
        existingFingerprint ===
          projectionFingerprint,
        "V8_PROJECTION_IDENTITY_MISMATCH",
        "Existing Projection does not match the requested projection.",
      );

      return immutable({
        projected: immutable({
          projectionId,
          contentId: existing.payload.contentId,
          decisionId: existing.payload.decisionId,
          scopeId: existing.payload.scopeId,
          contextId: existing.payload.contextId,
          title: existing.payload.title,
          body: existing.payload.body,
          fingerprint: existing.fingerprint,
          lineage: existing.lineage,
          sourceContent:
            compiled.decision,
        }),
      });
    }

    const sourceLineage: LineageLink[] = [
      lineageOf(
        compiled.decision,
        "DECISION",
      ),
    ];

    for (const item of compiled.lineage) {
      if (!hasLineage(sourceLineage, item)) {
        sourceLineage.push(item);
      }
    }

    for (const item of eligibility.lineage) {
      if (!hasLineage(sourceLineage, item)) {
        sourceLineage.push(item);
      }
    }

    const payload: ProjectionPayload =
      immutable({
        contentId: content.id,
        decisionId: compiled.decision.aggregateId,
        sourceFingerprint: compiled.fingerprint,
        scopeId: input.scopeId,
        contextId: input.contextId,
        title: content.title,
        body: content.body,
      });

    const record =
      this.store.append<ProjectionPayload>({
        aggregateType: "PROJECTION",
        aggregateId: projectionId,
        version: 1,
        state: "REGISTERED",
        payload,
        lineage: sourceLineage,
        actor: {
          id: "v8:projection-projector",
          role: "SYSTEM",
        },
        reason: "V8-16 projection",
      });

    const projected: ProjectedContent =
      immutable({
        projectionId,
        contentId: content.id,
        decisionId: compiled.decision.aggregateId,
        scopeId: input.scopeId,
        contextId: input.contextId,
        title: content.title,
        body: content.body,
        fingerprint: record.fingerprint,
        lineage: record.lineage,
        sourceContent: compiled.decision,
      });

    return immutable({
      projected,
    });
  }

  assert(
    input: ProjectionInput,
  ): void {
    this.project(input);
  }
}