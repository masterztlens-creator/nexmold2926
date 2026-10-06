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

export interface ContentProvenance {
  readonly ordinal: number;
  readonly text: string;
  readonly fingerprint: string;
  readonly kind: ContentProvenanceKind;

  /*
   * Structural lineage.
   *
   * QUESTION / CONSTRAINT assertions bind to exactly one Problem.
   * CONTEXT assertions bind to exactly one Context.
   * DECISION assertions bind to exactly one Decision.
   *
   * There is deliberately no constraintIds field because V8 does
   * not model Constraint as an independent aggregate in this layer.
   */
  readonly problemIds: readonly string[];
  readonly decisionIds: readonly string[];
  readonly contextIds: readonly string[];

  /*
   * Epistemic lineage.
   *
   * Only KNOWLEDGE assertions require the complete
   *
   *   Knowledge → Claim → Evidence
   *
   * closure.
   *
   * Structural assertions must not manufacture Knowledge, Claim or
   * Evidence references merely to satisfy a provenance contract.
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
   * Every content assertion emitted by the compiler carries an
   * immutable provenance record.
   *
   * Provenance has two deliberately separate dimensions:
   *
   *   structural lineage
   *     QUESTION / CONSTRAINT → Problem
   *     CONTEXT              → Context
   *     DECISION             → Decision
   *
   *   epistemic lineage
   *     KNOWLEDGE → Claim → Evidence
   *
   * This separation is essential. Structural presentation assertions
   * are not Evidence-backed factual assertions and must not be made
   * to appear epistemic merely to satisfy an old provenance contract.
   *
   * Therefore:
   *
   *   source evidence
   *        ↓
   *   verified claim
   *        ↓
   *   verified knowledge
   *        ↓
   *   approved decision
   *        ↓
   *   deterministic content
   *        ↓
   *   exact content assertion
   *
   * remains inspectable after compilation without introducing false
   * epistemic lineage.
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

function validateExactlyOneStructuralId(
  values: readonly string[],
  code: string,
  label: string,
  index: number,
): readonly string[] {
  const normalized =
    normalizeIds(
      values,
    );

  invariant(
    normalized.length === 1,
    code,
    `Content provenance assertion ${index} must bind exactly one ${label}.`,
  );

  return normalized;
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

        switch (
          item.kind
        ) {
          case "QUESTION":
            invariant(
              problemIds.length ===
                1,
              "V8_CONTENT_PROVENANCE_QUESTION_NO_PROBLEM",
              `QUESTION assertion ${index} must bind exactly one Problem.`,
            );

            invariant(
              decisionIds.length ===
                0,
              "V8_CONTENT_PROVENANCE_QUESTION_DECISION",
              `QUESTION assertion ${index} must not bind a Decision.`,
            );

            invariant(
              contextIds.length ===
                0,
              "V8_CONTENT_PROVENANCE_QUESTION_CONTEXT",
              `QUESTION assertion ${index} must not bind a Context.`,
            );

            invariant(
              knowledgeIds.length ===
                0,
              "V8_CONTENT_PROVENANCE_QUESTION_KNOWLEDGE",
              `QUESTION assertion ${index} must not bind Knowledge.`,
            );

            invariant(
              claimIds.length ===
                0,
              "V8_CONTENT_PROVENANCE_QUESTION_CLAIM",
              `QUESTION assertion ${index} must not bind Claim.`,
            );

            invariant(
              evidenceIds.length ===
                0,
              "V8_CONTENT_PROVENANCE_QUESTION_EVIDENCE",
              `QUESTION assertion ${index} must not bind Evidence.`,
            );

            break;

          case "CONSTRAINT":
            invariant(
              problemIds.length ===
                1,
              "V8_CONTENT_PROVENANCE_CONSTRAINT_NO_PROBLEM",
              `CONSTRAINT assertion ${index} must bind exactly one Problem.`,
            );

            invariant(
              decisionIds.length ===
                0,
              "V8_CONTENT_PROVENANCE_CONSTRAINT_DECISION",
              `CONSTRAINT assertion ${index} must not bind a Decision.`,
            );

            invariant(
              contextIds.length ===
                0,
              "V8_CONTENT_PROVENANCE_CONSTRAINT_CONTEXT",
              `CONSTRAINT assertion ${index} must not bind a Context.`,
            );

            invariant(
              knowledgeIds.length ===
                0,
              "V8_CONTENT_PROVENANCE_CONSTRAINT_KNOWLEDGE",
              `CONSTRAINT assertion ${index} must not bind Knowledge.`,
            );

            invariant(
              claimIds.length ===
                0,
              "V8_CONTENT_PROVENANCE_CONSTRAINT_CLAIM",
              `CONSTRAINT assertion ${index} must not bind Claim.`,
            );

            invariant(
              evidenceIds.length ===
                0,
              "V8_CONTENT_PROVENANCE_CONSTRAINT_EVIDENCE",
              `CONSTRAINT assertion ${index} must not bind Evidence.`,
            );

            break;

          case "CONTEXT":
            invariant(
              problemIds.length ===
                0,
              "V8_CONTENT_PROVENANCE_CONTEXT_PROBLEM",
              `CONTEXT assertion ${index} must not bind a Problem.`,
            );

            invariant(
              decisionIds.length ===
                0,
              "V8_CONTENT_PROVENANCE_CONTEXT_DECISION",
              `CONTEXT assertion ${index} must not bind a Decision.`,
            );

            invariant(
              contextIds.length ===
                1,
              "V8_CONTENT_PROVENANCE_CONTEXT_NO_CONTEXT",
              `CONTEXT assertion ${index} must bind exactly one Context.`,
            );

            invariant(
              knowledgeIds.length ===
                0,
              "V8_CONTENT_PROVENANCE_CONTEXT_KNOWLEDGE",
              `CONTEXT assertion ${index} must not bind Knowledge.`,
            );

            invariant(
              claimIds.length ===
                0,
              "V8_CONTENT_PROVENANCE_CONTEXT_CLAIM",
              `CONTEXT assertion ${index} must not bind Claim.`,
            );

            invariant(
              evidenceIds.length ===
                0,
              "V8_CONTENT_PROVENANCE_CONTEXT_EVIDENCE",
              `CONTEXT assertion ${index} must not bind Evidence.`,
            );

            break;

          case "DECISION":
            invariant(
              problemIds.length ===
                0,
              "V8_CONTENT_PROVENANCE_DECISION_PROBLEM",
              `DECISION assertion ${index} must not bind a Problem.`,
            );

            invariant(
              decisionIds.length ===
                1,
              "V8_CONTENT_PROVENANCE_DECISION_NO_DECISION",
              `DECISION assertion ${index} must bind exactly one Decision.`,
            );

            invariant(
              contextIds.length ===
                0,
              "V8_CONTENT_PROVENANCE_DECISION_CONTEXT",
              `DECISION assertion ${index} must not bind a Context.`,
            );

            invariant(
              knowledgeIds.length ===
                0,
              "V8_CONTENT_PROVENANCE_DECISION_KNOWLEDGE",
              `DECISION assertion ${index} must not bind Knowledge.`,
            );

            invariant(
              claimIds.length ===
                0,
              "V8_CONTENT_PROVENANCE_DECISION_CLAIM",
              `DECISION assertion ${index} must not bind Claim.`,
            );

            invariant(
              evidenceIds.length ===
                0,
              "V8_CONTENT_PROVENANCE_DECISION_EVIDENCE",
              `DECISION assertion ${index} must not bind Evidence.`,
            );

            break;

          case "KNOWLEDGE":
            invariant(
              problemIds.length ===
                0,
              "V8_CONTENT_PROVENANCE_KNOWLEDGE_PROBLEM",
              `KNOWLEDGE assertion ${index} must not bind a Problem.`,
            );

            invariant(
              decisionIds.length ===
                0,
              "V8_CONTENT_PROVENANCE_KNOWLEDGE_DECISION",
              `KNOWLEDGE assertion ${index} must not bind a Decision.`,
            );

            invariant(
              contextIds.length ===
                0,
              "V8_CONTENT_PROVENANCE_KNOWLEDGE_CONTEXT",
              `KNOWLEDGE assertion ${index} must not bind a Context.`,
            );

            invariant(
              knowledgeIds.length >
                0,
              "V8_CONTENT_PROVENANCE_NO_KNOWLEDGE",
              `KNOWLEDGE assertion ${index} has no Knowledge lineage.`,
            );

            invariant(
              claimIds.length >
                0,
              "V8_CONTENT_PROVENANCE_NO_CLAIM",
              `KNOWLEDGE assertion ${index} has no Claim lineage.`,
            );

            invariant(
              evidenceIds.length >
                0,
              "V8_CONTENT_PROVENANCE_NO_EVIDENCE",
              `KNOWLEDGE assertion ${index} has no Evidence lineage.`,
            );

            break;

          default:
            invariant(
              false,
              "V8_CONTENT_PROVENANCE_UNKNOWN_KIND",
              `Content provenance assertion ${index} has an unsupported provenance kind.`,
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
   * A compiled Content object without provenance is still allowed at
   * the low-level domain factory for compatibility with historical
   * domain fixtures.
   *
   * Production compilers are required to provide provenance.
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
 * These lines do not need independent Evidence because the following
 * content assertions carry the actual epistemic lineage.
 */
export function isStructuralContentLine(
  line: string,
): boolean {
  const normalized =
    line.trim();

  if (
    normalized.length === 0
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