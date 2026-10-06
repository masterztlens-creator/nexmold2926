import {
  immutable,
  invariant,
} from "../constitution/invariants.js";

import {
  contentId,
  decisionId,
  nonEmpty,
  type ContentId,
  type DecisionId,
} from "./primitives.js";

import {
  contentFingerprint,
} from "../foundation/hash.js";

export type ContentProvenanceKind =
  | "QUESTION"
  | "DECISION"
  | "KNOWLEDGE"
  | "CONTEXT"
  | "CONSTRAINT";

/*
 * ============================================================
 * CONTENT PROVENANCE CONTRACT
 * ============================================================
 *
 * Provenance is divided into two epistemic classes:
 *
 *   STRUCTURAL
 *     QUESTION
 *     DECISION
 *     CONTEXT
 *     CONSTRAINT
 *
 *   EVIDENTIARY
 *     KNOWLEDGE
 *
 * Structural assertions MUST NOT be assigned unrelated
 * Knowledge / Claim / Evidence lineage merely to satisfy a
 * cardinality requirement.
 *
 * Evidentiary assertions MUST carry the complete minimal:
 *
 *   Knowledge -> Claim -> Evidence
 *
 * closure belonging to that Knowledge assertion.
 *
 * The following fields therefore have distinct meanings:
 *
 *   problemIds
 *       Structural source for QUESTION and CONSTRAINT.
 *
 *   decisionIds
 *       Structural source for DECISION.
 *
 *   contextIds
 *       Structural source for CONTEXT.
 *
 *   knowledgeIds
 *   claimIds
 *   evidenceIds
 *       Epistemic source closure for KNOWLEDGE.
 *
 * There is intentionally no constraintIds field because V8 does
 * not currently model a Constraint as an independent Foundation
 * aggregate. A constraint is therefore bound to its registered
 * Problem and exact assertion text.
 */

export interface ContentProvenance {
  readonly ordinal: number;
  readonly text: string;
  readonly fingerprint: string;
  readonly kind: ContentProvenanceKind;

  /*
   * Structural lineage.
   */
  readonly problemIds: readonly string[];
  readonly decisionIds: readonly string[];
  readonly contextIds: readonly string[];

  /*
   * Evidentiary lineage.
   *
   * These arrays MUST be empty for structural provenance kinds.
   *
   * KNOWLEDGE assertions MUST contain the minimal:
   *
   *   Knowledge -> Claim -> Evidence
   *
   * closure.
   */
  readonly knowledgeIds: readonly string[];
  readonly claimIds: readonly string[];
  readonly evidenceIds: readonly string[];
}

export interface Content {
  id: ContentId;
  decisionId: DecisionId;
  title: string;
  body: string;

  /*
   * Every auditable content assertion emitted by the compiler
   * carries immutable provenance.
   *
   * Structural assertions are bound to their structural aggregate.
   * Knowledge assertions are bound to their epistemic closure.
   *
   * No assertion is permitted to acquire unrelated Evidence merely
   * because Evidence exists elsewhere in the Decision closure.
   */
  readonly provenance: readonly ContentProvenance[];
}

function normalizeIds(
  values: readonly string[],
): readonly string[] {
  return immutable(
    [
      ...new Set(
        values
          .map((value) =>
            value.trim(),
          )
          .filter(
            (value) =>
              value.length > 0,
          ),
      ),
    ].sort(),
  );
}

function validateProvenance(
  provenance:
    readonly ContentProvenance[],
): readonly ContentProvenance[] {
  const normalized =
    provenance.map(
      (item, index) => {
        invariant(
          Number.isInteger(
            item.ordinal,
          ) &&
            item.ordinal >= 0,
          "V8_CONTENT_PROVENANCE_INVALID_ORDINAL",
          "Content provenance ordinal must be a non-negative integer.",
        );

        invariant(
          item.ordinal === index,
          "V8_CONTENT_PROVENANCE_NON_CONTIGUOUS",
          "Content provenance ordinals must be contiguous and deterministic.",
        );

        const text =
          nonEmpty(
            item.text,
            "content.provenance.text",
          );

        const fingerprint =
          nonEmpty(
            item.fingerprint,
            "content.provenance.fingerprint",
          );

        const problemIds =
          normalizeIds(
            item.problemIds,
          );

        const decisionIds =
          normalizeIds(
            item.decisionIds,
          );

        const contextIds =
          normalizeIds(
            item.contextIds,
          );

        const knowledgeIds =
          normalizeIds(
            item.knowledgeIds,
          );

        const claimIds =
          normalizeIds(
            item.claimIds,
          );

        const evidenceIds =
          normalizeIds(
            item.evidenceIds,
          );

        invariant(
          [
            "QUESTION",
            "DECISION",
            "KNOWLEDGE",
            "CONTEXT",
            "CONSTRAINT",
          ].includes(
            item.kind,
          ),
          "V8_CONTENT_PROVENANCE_INVALID_KIND",
          `Content provenance assertion ${index} has an invalid provenance kind.`,
        );

        /*
         * ========================================================
         * STRUCTURAL PROVENANCE
         * ========================================================
         */

        if (
          item.kind ===
          "QUESTION"
        ) {
          invariant(
            problemIds.length ===
              1,
            "V8_CONTENT_PROVENANCE_QUESTION_PROBLEM_CARDINALITY",
            `QUESTION provenance assertion ${index} must reference exactly one Problem.`,
          );

          invariant(
            decisionIds.length ===
              0 &&
              contextIds.length ===
                0 &&
              knowledgeIds.length ===
                0 &&
              claimIds.length ===
                0 &&
              evidenceIds.length ===
                0,
            "V8_CONTENT_PROVENANCE_QUESTION_HAS_FOREIGN_LINEAGE",
            `QUESTION provenance assertion ${index} contains lineage belonging to another provenance class.`,
          );
        }

        if (
          item.kind ===
          "DECISION"
        ) {
          invariant(
            decisionIds.length ===
              1,
            "V8_CONTENT_PROVENANCE_DECISION_CARDINALITY",
            `DECISION provenance assertion ${index} must reference exactly one Decision.`,
          );

          invariant(
            problemIds.length ===
              0 &&
              contextIds.length ===
                0 &&
              knowledgeIds.length ===
                0 &&
              claimIds.length ===
                0 &&
              evidenceIds.length ===
                0,
            "V8_CONTENT_PROVENANCE_DECISION_HAS_FOREIGN_LINEAGE",
            `DECISION provenance assertion ${index} contains lineage belonging to another provenance class.`,
          );
        }

        if (
          item.kind ===
          "CONTEXT"
        ) {
          invariant(
            contextIds.length ===
              1,
            "V8_CONTENT_PROVENANCE_CONTEXT_CARDINALITY",
            `CONTEXT provenance assertion ${index} must reference exactly one Context.`,
          );

          invariant(
            problemIds.length ===
              0 &&
              decisionIds.length ===
                0 &&
              knowledgeIds.length ===
                0 &&
              claimIds.length ===
                0 &&
              evidenceIds.length ===
                0,
            "V8_CONTENT_PROVENANCE_CONTEXT_HAS_FOREIGN_LINEAGE",
            `CONTEXT provenance assertion ${index} contains lineage belonging to another provenance class.`,
          );
        }

        if (
          item.kind ===
          "CONSTRAINT"
        ) {
          invariant(
            problemIds.length ===
              1,
            "V8_CONTENT_PROVENANCE_CONSTRAINT_PROBLEM_CARDINALITY",
            `CONSTRAINT provenance assertion ${index} must reference exactly one Problem.`,
          );

          invariant(
            decisionIds.length ===
              0 &&
              contextIds.length ===
                0 &&
              knowledgeIds.length ===
                0 &&
              claimIds.length ===
                0 &&
              evidenceIds.length ===
                0,
            "V8_CONTENT_PROVENANCE_CONSTRAINT_HAS_FOREIGN_LINEAGE",
            `CONSTRAINT provenance assertion ${index} contains lineage belonging to another provenance class.`,
          );
        }

        /*
         * ========================================================
         * EVIDENTIARY PROVENANCE
         * ========================================================
         */

        if (
          item.kind ===
          "KNOWLEDGE"
        ) {
          invariant(
            knowledgeIds.length >
              0,
            "V8_CONTENT_PROVENANCE_KNOWLEDGE_NO_KNOWLEDGE",
            `KNOWLEDGE provenance assertion ${index} has no Knowledge lineage.`,
          );

          invariant(
            claimIds.length >
              0,
            "V8_CONTENT_PROVENANCE_KNOWLEDGE_NO_CLAIM",
            `KNOWLEDGE provenance assertion ${index} has no Claim lineage.`,
          );

          invariant(
            evidenceIds.length >
              0,
            "V8_CONTENT_PROVENANCE_KNOWLEDGE_NO_EVIDENCE",
            `KNOWLEDGE provenance assertion ${index} has no Evidence lineage.`,
          );

          invariant(
            problemIds.length ===
              0 &&
              decisionIds.length ===
                0 &&
              contextIds.length ===
                0,
            "V8_CONTENT_PROVENANCE_KNOWLEDGE_HAS_STRUCTURAL_LINEAGE",
            `KNOWLEDGE provenance assertion ${index} contains structural lineage.`,
          );
        }

        return immutable({
          ordinal:
            index,

          text,

          fingerprint,

          kind:
            item.kind,

          problemIds,

          decisionIds,

          contextIds,

          knowledgeIds,

          claimIds,

          evidenceIds,
        });
      },
    );

  return immutable(
    normalized,
  );
}

export function createContent(
  input: Omit<
    Content,
    "id" | "provenance"
  > & {
    id?: string;
    provenance?: readonly ContentProvenance[];
  },
): Readonly<Content> {
  invariant(
    input.decisionId.trim().length > 0,
    "V8_CONTENT_NO_DECISION",
    "Content must reference an existing Decision.",
  );

  const body =
    nonEmpty(
      input.body,
      "content.body",
    );

  const provenance =
    validateProvenance(
      input.provenance ?? [],
    );

  /*
   * Content body and provenance must agree structurally.
   *
   * A compiled Content object without provenance remains allowed
   * at the low-level domain factory for compatibility with historical
   * domain fixtures.
   *
   * Production compilers MUST provide provenance.
   */
  if (
    provenance.length > 0
  ) {
    const expectedAssertions =
      body
        .split("\n")
        .map((line) =>
          line.trim(),
        )
        .filter(
          (line) =>
            line.length > 0 &&
            !isStructuralContentLine(
              line,
            ),
        );

    invariant(
      expectedAssertions.length ===
        provenance.length,
      "V8_CONTENT_PROVENANCE_BODY_COVERAGE_MISMATCH",
      [
        "Content provenance count does not match the number of",
        "non-structural content assertions in the compiled body.",
      ].join(" "),
    );

    for (
      let index = 0;
      index <
        provenance.length;
      index += 1
    ) {
      invariant(
        provenance[index].text ===
          expectedAssertions[index],
        "V8_CONTENT_PROVENANCE_TEXT_MISMATCH",
        `Content provenance assertion ${index} does not match the compiled body.`,
      );

      invariant(
        provenance[index].fingerprint ===
          contentFingerprint(
            expectedAssertions[index],
          ),
        "V8_CONTENT_PROVENANCE_FINGERPRINT_MISMATCH",
        `Content provenance fingerprint mismatch at assertion ${index}.`,
      );
    }
  }

  return immutable({
    id: contentId(
      input.id ??
        `content:${input.decisionId}:${input.title}`,
    ),

    decisionId:
      decisionId(
        input.decisionId,
      ),

    title:
      nonEmpty(
        input.title,
        "content.title",
      ),

    body,

    provenance,
  });
}

/*
 * Structural lines are presentation structure rather than factual
 * assertions.
 *
 * These labels do not need independent Evidence because they are
 * presentation markers. The actual Problem, Decision, Context,
 * Constraint and Knowledge values remain auditable assertions.
 */
export function isStructuralContentLine(
  line: string,
): boolean {
  const normalized =
    line.trim();

  if (
    normalized.length ===
    0
  ) {
    return true;
  }

  return (
    normalized ===
      "Problem" ||
    normalized ===
      "Decision" ||
    normalized ===
      "Verified knowledge" ||
    normalized ===
      "Context" ||
    normalized ===
      "Constraints"
  );
}