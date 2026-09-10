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
  Projection,
  V8ProjectionInput,
} from "./types.js";

/**
 * Legacy V8-05~08 projection producer.
 *
 * This API MUST remain intact.
 */
export function project(
  input: ProjectionInput,
): Readonly<Projection> {
  const route = input.route.trim();

  invariant(
    route.startsWith("/") && route !== "/",
    "V8_PROJECTION_ROUTE_INVALID",
    "Projection route must be a non-root path.",
  );

  const fp = contentFingerprint({
    publicationId: input.artifact.id,
    route,
    title: input.artifact.title,
    body: input.artifact.body,
  });

  return immutable({
    id: `projection:${fp}`,
    publicationId: input.artifact.id,
    route,
    title: input.artifact.title,
    body: input.artifact.body,
    fingerprint: fp,
  });
}

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
    input: V8ProjectionInput,
  ): ProjectionResult {
    const compiled = input.compiled;
    const content = compiled.content as ContentShape;

    invariant(
      content.id.trim().length > 0,
      "V8_PROJECTION_CONTENT_ID_EMPTY",
      "Projection requires a non-empty Content id.",
    );

    invariant(
      content.decisionId === compiled.decision.aggregateId,
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
      compiled.fingerprint === expectedSourceFingerprint,
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
        existing.payload.contentId === content.id &&
          existing.payload.decisionId ===
            compiled.decision.aggregateId &&
          existing.payload.sourceFingerprint ===
            compiled.fingerprint &&
          existing.payload.scopeId === input.scopeId &&
          existing.payload.contextId === input.contextId &&
          existing.payload.title === content.title &&
          existing.payload.body === content.body,
        "V8_PROJECTION_EXISTING_IDENTITY_MISMATCH",
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
          sourceContent: compiled.decision,
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
    input: V8ProjectionInput,
  ): void {
    this.project(input);
  }
}