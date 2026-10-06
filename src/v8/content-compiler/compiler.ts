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
  problemIds: readonly string[],
  decisionIds: readonly string[],
  contextIds: readonly string[],
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

  const normalizedProblemIds =
    uniqueSorted(
      problemIds,
    );

  const normalizedDecisionIds =
    uniqueSorted(
      decisionIds,
    );

  const normalizedContextIds =
    uniqueSorted(
      contextIds,
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

  switch (kind) {
    case "QUESTION":
    case "CONSTRAINT":
      invariant(
        normalizedProblemIds.length === 1,
        "V8_CONTENT_COMPILER_ASSERTION_NO_PROBLEM",
        `Compiled assertion ${ordinal} kind=${kind} must bind exactly one Problem.`,
      );

      invariant(
        normalizedDecisionIds.length === 0,
        "V8_CONTENT_COMPILER_ASSERTION_UNEXPECTED_DECISION",
        `Compiled assertion ${ordinal} kind=${kind} must not bind a Decision.`,
      );

      invariant(
        normalizedContextIds.length === 0,
        "V8_CONTENT_COMPILER_ASSERTION_UNEXPECTED_CONTEXT",
        `Compiled assertion ${ordinal} kind=${kind} must not bind a Context.`,
      );

      invariant(
        normalizedKnowledgeIds.length === 0,
        "V8_CONTENT_COMPILER_ASSERTION_UNEXPECTED_KNOWLEDGE",
        `Compiled assertion ${ordinal} kind=${kind} must not bind Knowledge.`,
      );

      invariant(
        normalizedClaimIds.length === 0,
        "V8_CONTENT_COMPILER_ASSERTION_UNEXPECTED_CLAIM",
        `Compiled assertion ${ordinal} kind=${kind} must not bind Claim.`,
      );

      invariant(
        normalizedEvidenceIds.length === 0,
        "V8_CONTENT_COMPILER_ASSERTION_UNEXPECTED_EVIDENCE",
        `Compiled assertion ${ordinal} kind=${kind} must not bind Evidence.`,
      );

      break;

    case "DECISION":
      invariant(
        normalizedDecisionIds.length === 1,
        "V8_CONTENT_COMPILER_ASSERTION_NO_DECISION",
        `Compiled assertion ${ordinal} kind=DECISION must bind exactly one Decision.`,
      );

      invariant(
        normalizedProblemIds.length === 0,
        "V8_CONTENT_COMPILER_ASSERTION_UNEXPECTED_PROBLEM",
        `Compiled assertion ${ordinal} kind=DECISION must not bind a Problem.`,
      );

      invariant(
        normalizedContextIds.length === 0,
        "V8_CONTENT_COMPILER_ASSERTION_UNEXPECTED_CONTEXT",
        `Compiled assertion ${ordinal} kind=DECISION must not bind a Context.`,
      );

      invariant(
        normalizedKnowledgeIds.length === 0,
        "V8_CONTENT_COMPILER_ASSERTION_UNEXPECTED_KNOWLEDGE",
        `Compiled assertion ${ordinal} kind=DECISION must not bind Knowledge.`,
      );

      invariant(
        normalizedClaimIds.length === 0,
        "V8_CONTENT_COMPILER_ASSERTION_UNEXPECTED_CLAIM",
        `Compiled assertion ${ordinal} kind=DECISION must not bind Claim.`,
      );

      invariant(
        normalizedEvidenceIds.length === 0,
        "V8_CONTENT_COMPILER_ASSERTION_UNEXPECTED_EVIDENCE",
        `Compiled assertion ${ordinal} kind=DECISION must not bind Evidence.`,
      );

      break;

    case "CONTEXT":
      invariant(
        normalizedContextIds.length === 1,
        "V8_CONTENT_COMPILER_ASSERTION_NO_CONTEXT",
        `Compiled assertion ${ordinal} kind=CONTEXT must bind exactly one Context.`,
      );

      invariant(
        normalizedProblemIds.length === 0,
        "V8_CONTENT_COMPILER_ASSERTION_UNEXPECTED_PROBLEM",
        `Compiled assertion ${ordinal} kind=CONTEXT must not bind a Problem.`,
      );

      invariant(
        normalizedDecisionIds.length === 0,
        "V8_CONTENT_COMPILER_ASSERTION_UNEXPECTED_DECISION",
        `Compiled assertion ${ordinal} kind=CONTEXT must not bind a Decision.`,
      );

      invariant(
        normalizedKnowledgeIds.length === 0,
        "V8_CONTENT_COMPILER_ASSERTION_UNEXPECTED_KNOWLEDGE",
        `Compiled assertion ${ordinal} kind=CONTEXT must not bind Knowledge.`,
      );

      invariant(
        normalizedClaimIds.length === 0,
        "V8_CONTENT_COMPILER_ASSERTION_UNEXPECTED_CLAIM",
        `Compiled assertion ${ordinal} kind=CONTEXT must not bind Claim.`,
      );

      invariant(
        normalizedEvidenceIds.length === 0,
        "V8_CONTENT_COMPILER_ASSERTION_UNEXPECTED_EVIDENCE",
        `Compiled assertion ${ordinal} kind=CONTEXT must not bind Evidence.`,
      );

      break;

    case "KNOWLEDGE":
      invariant(
        normalizedProblemIds.length === 0,
        "V8_CONTENT_COMPILER_ASSERTION_UNEXPECTED_PROBLEM",
        `Compiled assertion ${ordinal} kind=KNOWLEDGE must not bind a Problem.`,
      );

      invariant(
        normalizedDecisionIds.length === 0,
        "V8_CONTENT_COMPILER_ASSERTION_UNEXPECTED_DECISION",
        `Compiled assertion ${ordinal} kind=KNOWLEDGE must not bind a Decision.`,
      );

      invariant(
        normalizedContextIds.length === 0,
        "V8_CONTENT_COMPILER_ASSERTION_UNEXPECTED_CONTEXT",
        `Compiled assertion ${ordinal} kind=KNOWLEDGE must not bind a Context.`,
      );

      invariant(
        normalizedKnowledgeIds.length > 0,
        "V8_CONTENT_COMPILER_ASSERTION_NO_KNOWLEDGE",
        `Compiled assertion ${ordinal} has no Knowledge lineage.`,
      );

      invariant(
        normalizedClaimIds.length > 0,
        "V8_CONTENT_COMPILER_ASSERTION_NO_CLAIM",
        `Compiled assertion ${ordinal} has no Claim lineage.`,
      );

      invariant(
        normalizedEvidenceIds.length > 0,
        "V8_CONTENT_COMPILER_ASSERTION_NO_EVIDENCE",
        `Compiled assertion ${ordinal} has no Evidence lineage.`,
      );

      break;

    default:
      invariant(
        false,
        "V8_CONTENT_COMPILER_ASSERTION_UNKNOWN_KIND",
        `Unsupported provenance kind for compiled assertion ${ordinal}.`,
      );
  }

  return {
    ordinal,

    text:
      normalizedText,

    fingerprint:
      contentFingerprint(
        normalizedText,
      ),

    kind,

    problemIds:
      normalizedProblemIds,

    decisionIds:
      normalizedDecisionIds,

    contextIds:
      normalizedContextIds,

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

    /*
     * The compiler creates provenance from the exact deterministic
     * body it is about to publish.
     *
     * Every non-structural line must receive provenance.
     *
     * Provenance is intentionally minimal:
     *
     *   KNOWLEDGE
     *     -> exact Knowledge
     *     -> exact Claims
     *     -> exact Evidence
     *
     *   QUESTION
     *     -> Problem
     *
     *   DECISION
     *     -> Decision
     *
     *   CONSTRAINT
     *     -> Problem
     *
     *   CONTEXT
     *     -> Context
     *
     * Problem / Decision / Constraint / Context assertions MUST NOT
     * inherit unrelated Knowledge / Claim / Evidence IDs merely because
     * those aggregates participate in the same Decision.
     *
     * This prevents aggregate-level lineage from being mistaken for
     * assertion-level evidentiary support.
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

    type BodySection =
      | "PROBLEM"
      | "DECISION"
      | "KNOWLEDGE"
      | "CONTEXT"
      | "CONSTRAINTS"
      | "NONE";

    let section: BodySection =
      "NONE";

    /*
     * Classification is driven by the deterministic body section,
     * not by assertion text alone.
     *
     * This is critical for fail-closed provenance:
     *
     *   - identical text in different sections remains semantically
     *     distinct;
     *   - "- None specified." under Constraints is CONSTRAINT;
     *   - context variable lines cannot accidentally become Knowledge;
     *   - a constraint cannot accidentally become Knowledge merely
     *     because its text matches a Knowledge proposition.
     */
    for (const line of body.split("\n")) {
      const normalizedLine =
        line.trim();

      if (
        normalizedLine ===
        "Problem"
      ) {
        section =
          "PROBLEM";
        continue;
      }

      if (
        normalizedLine ===
        "Decision"
      ) {
        section =
          "DECISION";
        continue;
      }

      if (
        normalizedLine ===
        "Verified knowledge"
      ) {
        section =
          "KNOWLEDGE";
        continue;
      }

      if (
        normalizedLine ===
        "Context"
      ) {
        section =
          "CONTEXT";
        continue;
      }

      if (
        normalizedLine ===
        "Constraints"
      ) {
        section =
          "CONSTRAINTS";
        continue;
      }

      if (
        normalizedLine.length ===
        0
      ) {
        continue;
      }

      if (
        isStructuralContentLine(
          normalizedLine,
        )
      ) {
        continue;
      }

      const assertion =
        normalizedLine;

      let kind:
        ContentProvenanceKind;

      switch (section) {
        case "PROBLEM":
          invariant(
            assertion ===
              problem.payload.question.trim(),
            "V8_CONTENT_COMPILER_PROBLEM_SECTION_MISMATCH",
            "Compiled Problem assertion does not match the registered Problem question.",
          );

          kind =
            "QUESTION";

          break;

        case "DECISION":
          invariant(
            assertion ===
              decision.payload.outcome.trim(),
            "V8_CONTENT_COMPILER_DECISION_SECTION_MISMATCH",
            "Compiled Decision assertion does not match the approved Decision outcome.",
          );

          kind =
            "DECISION";

          break;

        case "KNOWLEDGE":
          invariant(
            assertion.startsWith(
              "- ",
            ),
            "V8_CONTENT_COMPILER_KNOWLEDGE_SECTION_MISMATCH",
            "Compiled Knowledge assertion must use the deterministic list representation.",
          );

          kind =
            "KNOWLEDGE";

          break;

        case "CONTEXT":
          kind =
            "CONTEXT";

          break;

        case "CONSTRAINTS":
          invariant(
            assertion.startsWith(
              "- ",
            ),
            "V8_CONTENT_COMPILER_CONSTRAINT_SECTION_MISMATCH",
            "Compiled Constraint assertion must use the deterministic list representation.",
          );

          kind =
            "CONSTRAINT";

          break;

        default:
          invariant(
            false,
            "V8_CONTENT_COMPILER_ASSERTION_OUTSIDE_SECTION",
            "Compiled assertion is outside a recognized content section.",
          );
      }

      let assertionProblemIds:
        readonly string[] = [];

      let assertionDecisionIds:
        readonly string[] = [];

      let assertionContextIds:
        readonly string[] = [];

      let assertionKnowledgeIds:
        readonly string[] = [];

      let assertionClaimIds:
        readonly string[] = [];

      let assertionEvidenceIds:
        readonly string[] = [];

      /*
       * Structural provenance is represented by its actual aggregate.
       *
       * QUESTION / CONSTRAINT
       *     -> current Problem
       *
       * DECISION
       *     -> current Decision
       *
       * CONTEXT
       *     -> current Context
       *
       * No unrelated epistemic lineage is attached.
       */
      if (
        kind ===
          "QUESTION" ||
        kind ===
          "CONSTRAINT"
      ) {
        assertionProblemIds = [
          problem.aggregateId,
        ];
      } else if (
        kind ===
        "DECISION"
      ) {
        assertionDecisionIds = [
          decision.aggregateId,
        ];
      } else if (
        kind ===
        "CONTEXT"
      ) {
        assertionContextIds = [
          context.aggregateId,
        ];
      }

      /*
       * Knowledge assertions receive the smallest possible epistemic
       * closure: exactly the Knowledge -> Claim -> Evidence chain
       * belonging to that Knowledge.
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
          `Knowledge provenance source not found for assertion ${provenance.length}.`,
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

        invariant(
          knowledgeClaimIds.length >
            0,
          "V8_CONTENT_COMPILER_KNOWLEDGE_PROVENANCE_NO_CLAIMS",
          `Knowledge assertion ${provenance.length} has no Claim lineage.`,
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

        invariant(
          assertionEvidenceIds.length >
            0,
          "V8_CONTENT_COMPILER_KNOWLEDGE_PROVENANCE_NO_EVIDENCE",
          `Knowledge assertion ${provenance.length} has no Evidence lineage.`,
        );
      }

      provenance.push(
        createProvenanceRecord(
          provenance.length,
          assertion,
          kind,
          assertionProblemIds,
          assertionDecisionIds,
          assertionContextIds,
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