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
  decisionId,
} from "../domain/primitives.js";

import {
  createContent,
  type Content,
  type ContentProvenance,
  type ContentProvenanceKind,
  isStructuralContentLine,
} from "../domain/content.js";

import {
  DecisionValidator,
} from "../decision-validation/validator.js";

import type {
  ContentCompilerInput,
  CompiledContent,
} from "./types.js";

interface DecisionPayload {
  readonly problemId: string;
  readonly knowledgeIds: readonly string[];
  readonly outcome: string;
  readonly status: "APPROVED";
  readonly fingerprint: string;
}

interface ProblemPayload {
  readonly contextId: string;
  readonly question: string;
  readonly constraints: readonly string[];
}

interface ContextPayload {
  readonly scopeId: string;
  readonly purpose: string;
  readonly variables: Readonly<
    Record<string, string>
  >;
}

interface KnowledgePayload {
  readonly proposition: string;
  readonly claimIds: readonly string[];
}

interface ClaimPayload {
  readonly statement: string;
  readonly evidenceIds: readonly string[];

  readonly scope?: string;
  readonly conditions?: readonly string[];
  readonly units?: readonly string[];
  readonly confidence?:
    | "HIGH"
    | "MEDIUM"
    | "LOW";
  readonly epistemicLevel?: string;
  readonly isUniversal?: boolean;
}

function lineageOf(
  record: FoundationRecord,
  type: LineageLink["type"],
): LineageLink {
  return {
    type,
    id:
      record.aggregateId,
    version:
      record.version,
    fingerprint:
      record.fingerprint,
  };
}

function uniqueSorted(
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

function deterministicBody(
  problem: ProblemPayload,
  decision: DecisionPayload,
  context: ContextPayload,
  knowledge:
    readonly FoundationRecord<KnowledgePayload>[],
): string {
  const knowledgeLines =
    knowledge
      .map(
        (record) =>
          record.payload.proposition
            .trim(),
      )
      .sort()
      .map(
        (proposition) =>
          `- ${proposition}`,
      )
      .join("\n");

  const constraintLines =
    problem.constraints.length > 0
      ? problem.constraints
          .map((constraint) =>
            constraint.trim(),
          )
          .sort()
          .map(
            (constraint) =>
              `- ${constraint}`,
          )
          .join("\n")
      : "- None specified.";

  const variableLines =
    Object.entries(
      context.variables,
    )
      .sort(
        ([a], [b]) =>
          a.localeCompare(b),
      )
      .map(
        ([key, value]) =>
          `- ${key}: ${value}`,
      )
      .join("\n") ||
    "- None specified.";

  return [
    "Problem",
    problem.question.trim(),
    "",
    "Decision",
    decision.outcome.trim(),
    "",
    "Verified knowledge",
    knowledgeLines,
    "",
    "Context",
    `Purpose: ${context.purpose.trim()}`,
    `Context ID: ${context.scopeId}`,
    variableLines,
    "",
    "Constraints",
    constraintLines,
  ].join("\n");
}

function normalizeAssertionText(
  line: string,
): string {
  return line.trim();
}

function createProvenanceRecord(
  ordinal: number,
  text: string,
  kind: ContentProvenanceKind,
  knowledgeIds: readonly string[],
  claimIds: readonly string[],
  evidenceIds: readonly string[],
): ContentProvenance {
  const normalizedText =
    normalizeAssertionText(
      text,
    );

  invariant(
    normalizedText.length > 0,
    "V8_CONTENT_COMPILER_EMPTY_ASSERTION",
    `Compiled assertion ${ordinal} is empty.`,
  );

  const normalizedKnowledgeIds =
    uniqueSorted(
      knowledgeIds,
    );

  const normalizedClaimIds =
    uniqueSorted(
      claimIds,
    );

  const normalizedEvidenceIds =
    uniqueSorted(
      evidenceIds,
    );

  invariant(
    normalizedKnowledgeIds.length >
      0,
    "V8_CONTENT_COMPILER_ASSERTION_NO_KNOWLEDGE",
    `Compiled assertion ${ordinal} has no Knowledge lineage.`,
  );

  invariant(
    normalizedClaimIds.length >
      0,
    "V8_CONTENT_COMPILER_ASSERTION_NO_CLAIM",
    `Compiled assertion ${ordinal} has no Claim lineage.`,
  );

  invariant(
    normalizedEvidenceIds.length >
      0,
    "V8_CONTENT_COMPILER_ASSERTION_NO_EVIDENCE",
    `Compiled assertion ${ordinal} has no Evidence lineage.`,
  );

  return {
    ordinal,

    text:
      normalizedText,

    fingerprint:
      contentFingerprint(
        normalizedText,
      ),

    kind,

    knowledgeIds:
      normalizedKnowledgeIds,

    claimIds:
      normalizedClaimIds,

    evidenceIds:
      normalizedEvidenceIds,
  };
}

export class ContentCompiler {
  private readonly validator:
    DecisionValidator;

  constructor(
    private readonly store:
      FoundationStore,
  ) {
    this.validator =
      new DecisionValidator(
        store,
      );
  }

  compile(
    input: ContentCompilerInput,
  ): CompiledContent {
    const title =
      input.title.trim();

    invariant(
      title.length > 0,
      "V8_CONTENT_COMPILER_EMPTY_TITLE",
      "Content title cannot be empty.",
    );

    const decision =
      this.store.get<DecisionPayload>(
        "DECISION",
        input.decisionId,
      );

    invariant(
      decision !== null &&
        decision.state ===
          "APPROVED",
      "V8_CONTENT_COMPILER_DECISION_NOT_APPROVED",
      "Content compilation requires an approved Decision.",
    );

    const problem =
      this.store.get<ProblemPayload>(
        "PROBLEM",
        decision.payload.problemId,
      );

    invariant(
      problem !== null &&
        problem.state ===
          "REGISTERED",
      "V8_CONTENT_COMPILER_PROBLEM_NOT_REGISTERED",
      "Content compilation requires a registered Problem.",
    );

    invariant(
      problem.payload.contextId ===
        input.contextId,
      "V8_CONTENT_COMPILER_CONTEXT_MISMATCH",
      "Problem context does not match compiler context.",
    );

    this.validator.assert({
      decisionId:
        input.decisionId,

      scopeId:
        input.scopeId,

      contextId:
        input.contextId,
    });

    const context =
      this.store.get<ContextPayload>(
        "CONTEXT",
        input.contextId,
      );

    invariant(
      context !== null &&
        context.state ===
          "REGISTERED",
      "V8_CONTENT_COMPILER_CONTEXT_NOT_REGISTERED",
      "Content compilation requires a registered Context.",
    );

    invariant(
      context.payload.scopeId ===
        input.scopeId,
      "V8_CONTENT_COMPILER_SCOPE_MISMATCH",
      "Context scope does not match compiler scope.",
    );

    const knowledge =
      decision.payload.knowledgeIds.map(
        (knowledgeId) => {
          const record =
            this.store.get<KnowledgePayload>(
              "KNOWLEDGE",
              knowledgeId,
            );

          invariant(
            record !== null &&
              record.state ===
                "VERIFIED",
            "V8_CONTENT_COMPILER_KNOWLEDGE_NOT_VERIFIED",
            `Knowledge ${knowledgeId} must be verified.`,
          );

          invariant(
            record.payload
              .claimIds.length >
              0,
            "V8_CONTENT_COMPILER_KNOWLEDGE_NO_CLAIMS",
            `Knowledge ${knowledgeId} has no Claims.`,
          );

          return record;
        },
      );

    const claimIds =
      uniqueSorted(
        knowledge.flatMap(
          (record) =>
            record.payload
              .claimIds,
        ),
      );

    const claimRecords =
      claimIds.map(
        (claimId) => {
          const record =
            this.store.get<ClaimPayload>(
              "CLAIM",
              claimId,
            );

          invariant(
            record !== null &&
              record.state ===
                "VERIFIED",
            "V8_CONTENT_COMPILER_CLAIM_NOT_VERIFIED",
            `Claim ${claimId} must be verified.`,
          );

          invariant(
            record.payload
              .evidenceIds.length >
              0,
            "V8_CONTENT_COMPILER_CLAIM_NO_EVIDENCE",
            `Claim ${claimId} has no Evidence.`,
          );

          return record;
        },
      );

    const evidenceIds =
      uniqueSorted(
        claimRecords.flatMap(
          (record) =>
            record.payload
              .evidenceIds,
        ),
      );

    const evidenceRecords =
      evidenceIds.map(
        (evidenceId) => {
          const record =
            this.store.get(
              "EVIDENCE",
              evidenceId,
            );

          invariant(
            record !== null &&
              record.state ===
                "VERIFIED",
            "V8_CONTENT_COMPILER_EVIDENCE_NOT_VERIFIED",
            `Evidence ${evidenceId} must be verified.`,
          );

          return record;
        },
      );

    const body =
      deterministicBody(
        problem.payload,
        decision.payload,
        context.payload,
        knowledge,
      );

    const knowledgeIdStrings =
      knowledge.map(
        (record) =>
          record.aggregateId,
      );

    const allClaimIds =
      uniqueSorted(
        claimRecords.map(
          (record) =>
            record.aggregateId,
        ),
      );

    const allEvidenceIds =
      uniqueSorted(
        evidenceRecords.map(
          (record) =>
            record.aggregateId,
        ),
      );

    /*
     * The compiler creates provenance from the exact deterministic
     * body it is about to publish.
     *
     * Every non-structural line is therefore covered before Content
     * is constructed.
     */
    const bodyAssertions =
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
      bodyAssertions.length >
        0,
      "V8_CONTENT_COMPILER_NO_ASSERTIONS",
      "Compiled content contains no auditable assertions.",
    );

    const provenance: ContentProvenance[] =
      [];

    for (
      let index = 0;
      index <
        bodyAssertions.length;
      index += 1
    ) {
      const assertion =
        bodyAssertions[index];

      let kind:
        ContentProvenanceKind =
        "CONTEXT";

      if (
        assertion ===
        problem.payload.question.trim()
      ) {
        kind =
          "QUESTION";
      } else if (
        assertion ===
        decision.payload.outcome.trim()
      ) {
        kind =
          "DECISION";
      } else if (
        assertion.startsWith(
          "- ",
        ) &&
        knowledge.some(
          (record) =>
            `- ${record.payload.proposition.trim()}` ===
            assertion,
        )
      ) {
        kind =
          "KNOWLEDGE";
      } else if (
        assertion.startsWith(
          "- ",
        ) &&
        problem.payload.constraints.some(
          (constraint) =>
            `- ${constraint.trim()}` ===
            assertion,
        )
      ) {
        kind =
          "CONSTRAINT";
      }

      let assertionKnowledgeIds =
        knowledgeIdStrings;

      let assertionClaimIds =
        allClaimIds;

      let assertionEvidenceIds =
        allEvidenceIds;

      /*
       * Knowledge assertions receive the smallest possible
       * epistemic closure: exactly the Knowledge -> Claim ->
       * Evidence chain belonging to that Knowledge.
       */
      if (
        kind ===
        "KNOWLEDGE"
      ) {
        const knowledgeRecord =
          knowledge.find(
            (record) =>
              `- ${record.payload.proposition.trim()}` ===
              assertion,
          );

        invariant(
          knowledgeRecord !==
            undefined,
          "V8_CONTENT_COMPILER_KNOWLEDGE_PROVENANCE_NOT_FOUND",
          `Knowledge provenance source not found for assertion ${index}.`,
        );

        assertionKnowledgeIds = [
          knowledgeRecord.aggregateId,
        ];

        const knowledgeClaimIds =
          uniqueSorted(
            knowledgeRecord
              .payload
              .claimIds,
          );

        assertionClaimIds =
          knowledgeClaimIds;

        assertionEvidenceIds =
          uniqueSorted(
            knowledgeClaimIds.flatMap(
              (id) => {
                const claim =
                  claimRecords.find(
                    (record) =>
                      record.aggregateId ===
                      id,
                  );

                invariant(
                  claim !==
                    undefined,
                  "V8_CONTENT_COMPILER_KNOWLEDGE_CLAIM_NOT_FOUND",
                  `Claim ${id} required by Knowledge ${knowledgeRecord.aggregateId} was not found.`,
                );

                return claim
                  .payload
                  .evidenceIds;
              },
            ),
          );
      }

      provenance.push(
        createProvenanceRecord(
          index,
          assertion,
          kind,
          assertionKnowledgeIds,
          assertionClaimIds,
          assertionEvidenceIds,
        ),
      );
    }

    invariant(
      provenance.length ===
        bodyAssertions.length,
      "V8_CONTENT_COMPILER_PROVENANCE_COVERAGE_FAILED",
      "Not every compiled content assertion received provenance.",
    );

    const content =
      createContent({
        decisionId:
          decisionId(
            decision.aggregateId,
          ),

        title,

        body,

        provenance,
      });

    const fingerprint =
      contentFingerprint({
        decisionId:
          decision.aggregateId,

        scopeId:
          input.scopeId,

        contextId:
          input.contextId,

        title:
          content.title,

        body:
          content.body,

        provenance:
          content.provenance,
      });

    const lineage:
      LineageLink[] = [
        lineageOf(
          decision,
          "DECISION",
        ),

        lineageOf(
          problem,
          "PROBLEM",
        ),

        lineageOf(
          context,
          "CONTEXT",
        ),

        ...knowledge.map(
          (record) =>
            lineageOf(
              record,
              "KNOWLEDGE",
            ),
        ),

        ...claimRecords.map(
          (record) =>
            lineageOf(
              record,
              "CLAIM",
            ),
        ),

        ...evidenceRecords.map(
          (record) =>
            lineageOf(
              record,
              "EVIDENCE",
            ),
        ),
      ];

    return immutable({
      content,
      fingerprint,
      lineage,
      decision,
    });
  }
}