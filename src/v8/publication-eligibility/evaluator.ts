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
  DecisionValidator,
} from "../decision-validation/validator.js";

import type {
  CompiledContent,
} from "../content-compiler/types.js";

import type {
  PublicationEligibilityInput,
  PublicationEligibilityResult,
} from "./types.js";

interface ContentShape {
  readonly id: string;
  readonly decisionId: string;
  readonly title: string;
  readonly body: string;
}

interface ScopePayload {
  readonly geography: string;
  readonly industries: readonly string[];
  readonly languages: readonly string[];
}

interface ContextPayload {
  readonly scopeId: string;
  readonly purpose: string;
  readonly variables: Readonly<Record<string, string>>;
}

interface DecisionPayload {
  readonly problemId: string;
  readonly knowledgeIds: readonly string[];
  readonly outcome: string;
  readonly status: "APPROVED";
  readonly fingerprint: string;
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

export class PublicationEligibilityEvaluator {
  private readonly decisionValidator: DecisionValidator;

  constructor(
    private readonly store: FoundationStore,
  ) {
    this.decisionValidator = new DecisionValidator(store);
  }

  evaluate(
    input: PublicationEligibilityInput,
  ): PublicationEligibilityResult {
    const reasons: string[] = [];
    const lineage: LineageLink[] = [];

    const compiled = input.compiled;
    const content = compiled.content as ContentShape;

    if (content.id.trim().length === 0) {
      reasons.push("CONTENT_ID_EMPTY");
    }

    if (content.title.trim().length === 0) {
      reasons.push("CONTENT_TITLE_EMPTY");
    }

    if (content.body.trim().length === 0) {
      reasons.push("CONTENT_BODY_EMPTY");
    }

    if (content.decisionId !== compiled.decision.aggregateId) {
      reasons.push("CONTENT_DECISION_MISMATCH");
    }

    const expectedContentFingerprint = contentFingerprint({
      decisionId: compiled.decision.aggregateId,
      scopeId: input.scopeId,
      contextId: input.contextId,
      title: content.title,
      body: content.body,
    });

    if (compiled.fingerprint !== expectedContentFingerprint) {
      reasons.push("CONTENT_FINGERPRINT_MISMATCH");
    }

    const currentDecision =
      this.store.get<DecisionPayload>(
        "DECISION",
        compiled.decision.aggregateId,
      );

    if (!currentDecision) {
      reasons.push("DECISION_NOT_FOUND");
    } else {
      lineage.push(
        lineageOf(currentDecision, "DECISION"),
      );

      if (
        currentDecision.version !==
        compiled.decision.version
      ) {
        reasons.push("DECISION_VERSION_MISMATCH");
      }

      if (
        currentDecision.fingerprint !==
        compiled.decision.fingerprint
      ) {
        reasons.push("DECISION_FINGERPRINT_CHANGED");
      }
    }

    const decisionValidation =
      this.decisionValidator.validate({
        decisionId: compiled.decision.aggregateId,
        scopeId: input.scopeId,
        contextId: input.contextId,
      });

    reasons.push(...decisionValidation.reasons);

    for (const item of decisionValidation.lineage) {
      if (!hasLineage(lineage, item)) {
        lineage.push(item);
      }
    }

    const scope =
      this.store.get<ScopePayload>(
        "SCOPE",
        input.scopeId,
      );

    if (!scope) {
      reasons.push("SCOPE_NOT_FOUND");
    } else {
      const scopeLink = lineageOf(
        scope,
        "SCOPE",
      );

      if (!hasLineage(lineage, scopeLink)) {
        lineage.push(scopeLink);
      }

      if (scope.state !== "REGISTERED") {
        reasons.push("SCOPE_NOT_REGISTERED");
      }
    }

    const context =
      this.store.get<ContextPayload>(
        "CONTEXT",
        input.contextId,
      );

    if (!context) {
      reasons.push("CONTEXT_NOT_FOUND");
    } else {
      const contextLink = lineageOf(
        context,
        "CONTEXT",
      );

      if (!hasLineage(lineage, contextLink)) {
        lineage.push(contextLink);
      }

      if (context.state !== "REGISTERED") {
        reasons.push("CONTEXT_NOT_REGISTERED");
      }

      if (
        context.payload.scopeId !==
        input.scopeId
      ) {
        reasons.push("CONTEXT_SCOPE_MISMATCH");
      }
    }

    const requiresReview =
      decisionValidation.reasons.some(
        (reason) =>
          reason.includes("REQUIRES_REVIEW") ||
          reason.includes("NOT_VERIFIED"),
      );

    const status =
      reasons.length === 0
        ? "ELIGIBLE"
        : requiresReview
          ? "REQUIRES_REVIEW"
          : "BLOCKED";

    return immutable({
      eligible: status === "ELIGIBLE",
      status,
      contentId: content.id,
      decisionId: compiled.decision.aggregateId,
      scopeId: input.scopeId,
      contextId: input.contextId,
      fingerprint: compiled.fingerprint,
      reasons,
      lineage,
    });
  }

  assert(
    input: PublicationEligibilityInput,
  ): void {
    const result = this.evaluate(input);

    invariant(
      result.eligible,
      "V8_PUBLICATION_ELIGIBILITY_BLOCKED",
      result.reasons.join(","),
    );
  }
}