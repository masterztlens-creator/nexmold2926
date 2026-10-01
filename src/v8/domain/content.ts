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
   * Every non-structural content assertion emitted by the compiler
   * carries an immutable provenance record.
   *
   * This is deliberately stored on Content rather than inferred later
   * from the final Markdown artifact.
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
   * remains inspectable after compilation.
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
          knowledgeIds.length > 0,
          "V8_CONTENT_PROVENANCE_NO_KNOWLEDGE",
          `Content provenance assertion ${index} has no Knowledge lineage.`,
        );

        invariant(
          claimIds.length > 0,
          "V8_CONTENT_PROVENANCE_NO_CLAIM",
          `Content provenance assertion ${index} has no Claim lineage.`,
        );

        invariant(
          evidenceIds.length > 0,
          "V8_CONTENT_PROVENANCE_NO_EVIDENCE",
          `Content provenance assertion ${index} has no Evidence lineage.`,
        );

        return immutable({
          ordinal:
            index,
          text,
          fingerprint,
          kind:
            item.kind,
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