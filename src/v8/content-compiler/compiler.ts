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
    id: record.aggregateId,
    version: record.version,
    fingerprint: record.fingerprint,
  };
}

function uniqueSorted(
  values: readonly string[],
): readonly string[] {
  return immutable(
    [
      ...new Set(
        values
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      ),
    ].sort(),
  );
}

/**
 * Normalize text for deterministic presentation without changing
 * the underlying verified proposition.
 *
 * This function intentionally does not paraphrase technical claims.
 * Any wording change to a verified proposition would require a
 * separate claim-transformation and verification step.
 */
function normalizeArticleText(
  value: string,
): string {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(" ")
    .trim();
}

function assertUniquePropositions(
  knowledge:
    readonly FoundationRecord<KnowledgePayload>[],
): void {
  const normalized = knowledge.map(
    (record) =>
      normalizeArticleText(
        record.payload.proposition,
      ),
  );

  invariant(
    normalized.every(
      (proposition) =>
        proposition.length > 0,
    ),
    "V8_CONTENT_COMPILER_EMPTY_KNOWLEDGE_PROPOSITION",
    "Verified Knowledge must contain non-empty propositions.",
  );

  invariant(
    new Set(normalized).size === normalized.length,
    "V8_CONTENT_COMPILER_DUPLICATE_KNOWLEDGE_PROPOSITION",
    "Distinct Knowledge records cannot compile to duplicate article assertions.",
  );
}

/**
 * Build a readable, deterministic technical article body.
 *
 * Important invariants:
 *
 * 1. The compiler does not invent engineering facts or causal claims.
 * 2. Verified Knowledge propositions retain their exact wording,
 *    apart from whitespace normalization.
 * 3. Every Knowledge paragraph can be resolved to one exact
 *    Knowledge aggregate and its Claim -> Evidence closure.
 * 4. Structural statements remain separate from epistemic claims.
 * 5. Output order is deterministic for identical inputs.
 *
 * This is an evidence-constrained article composition layer, not a
 * free-form text generator. It improves readability through narrative
 * organization and paragraph presentation without silently rewriting
 * the technical meaning of verified source material.
 */
function deterministicBody(
  problem: ProblemPayload,
  decision: DecisionPayload,
  context: ContextPayload,
  knowledge:
    readonly FoundationRecord<KnowledgePayload>[],
): string {
  assertUniquePropositions(knowledge);

  const question =
    normalizeArticleText(
      problem.question,
    );

  const outcome =
    normalizeArticleText(
      decision.outcome,
    );

  const purpose =
    normalizeArticleText(
      context.purpose,
    );

  invariant(
    question.length > 0,
    "V8_CONTENT_COMPILER_EMPTY_PROBLEM_QUESTION",
    "The engineering article requires a non-empty Problem question.",
  );

  invariant(
    outcome.length > 0,
    "V8_CONTENT_COMPILER_EMPTY_DECISION_OUTCOME",
    "The engineering article requires a non-empty approved Decision outcome.",
  );

  invariant(
    knowledge.length > 0,
    "V8_CONTENT_COMPILER_NO_VERIFIED_KNOWLEDGE",
    "The engineering article requires at least one verified Knowledge record.",
  );

  const knowledgeParagraphs =
    knowledge
      .map((record) => ({
        id: record.aggregateId,
        proposition: normalizeArticleText(
          record.payload.proposition,
        ),
      }))
      .sort((left, right) => {
        const byText =
          left.proposition.localeCompare(
            right.proposition,
          );

        return byText !== 0
          ? byText
          : left.id.localeCompare(right.id);
      })
      .map(
        ({ proposition }) => proposition,
      );

  const constraintParagraphs =
    uniqueSorted(
      problem.constraints.map(
        normalizeArticleText,
      ),
    );

  const contextParagraphs = [
    purpose.length > 0
      ? `Purpose: ${purpose}`
      : "",
    ...Object.entries(
      context.variables,
    )
      .map(([key, value]) => ({
        key: key.trim(),
        value: normalizeArticleText(value),
      }))
      .filter(
        ({ key, value }) =>
          key.length > 0 &&
          value.length > 0,
      )
      .sort(
        (left, right) =>
          left.key.localeCompare(right.key),
      )
      .map(
        ({ key, value }) =>
          `${key}: ${value}`,
      ),
  ].filter(
    (line) => line.length > 0,
  );

  /*
   * Preserve the existing structural section markers in this file.
   * The provenance parser and domain-level Content factory recognize
   * these exact markers as structural lines.
   *
   * Verified propositions and constraints are rendered as paragraphs,
   * rather than "- field: value" entries. No unsupported explanatory
   * claims are inserted between source-backed propositions.
   */
  return [
    "Problem",
    question,
    "",
    "Decision",
    outcome,
    "",
    "Verified knowledge",
    ...knowledgeParagraphs,
    "",
    "Context",
    ...(
      contextParagraphs.length > 0
        ? contextParagraphs
        : ["No additional context was specified."]
    ),
    "",
    "Constraints",
    ...(
      constraintParagraphs.length > 0
        ? constraintParagraphs
        : ["No explicit constraints were specified."]
    ),
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
    normalizeAssertionText(text);

  invariant(
    normalizedText.length > 0,
    "V8_CONTENT_COMPILER_EMPTY_ASSERTION",
    `Compiled assertion ${ordinal} is empty.`,
  );

  const normalizedProblemIds =
    uniqueSorted(problemIds);

  const normalizedDecisionIds =
    uniqueSorted(decisionIds);

  const normalizedContextIds =
    uniqueSorted(contextIds);

  const normalizedKnowledgeIds =
    uniqueSorted(knowledgeIds);

  const normalizedClaimIds =
    uniqueSorted(claimIds);

  const normalizedEvidenceIds =
    uniqueSorted(evidenceIds);

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
    text: normalizedText,
    fingerprint: contentFingerprint(normalizedText),
    kind,
    problemIds: normalizedProblemIds,
    decisionIds: normalizedDecisionIds,
    contextIds: normalizedContextIds,
    knowledgeIds: normalizedKnowledgeIds,
    claimIds: normalizedClaimIds,
    evidenceIds: normalizedEvidenceIds,
  };
}
export class ContentCompiler {
  private readonly validator: DecisionValidator;

  constructor(
    private readonly store: FoundationStore,
  ) {
    this.validator = new DecisionValidator(store);
  }

  compile(
    input: ContentCompilerInput,
  ): CompiledContent {
    const title = input.title.trim();

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
        decision.state === "APPROVED",
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
        problem.state === "REGISTERED",
      "V8_CONTENT_COMPILER_PROBLEM_NOT_REGISTERED",
      "Content compilation requires a registered Problem.",
    );

    invariant(
      problem.payload.contextId === input.contextId,
      "V8_CONTENT_COMPILER_CONTEXT_MISMATCH",
      "Problem context does not match compiler context.",
    );

    this.validator.assert({
      decisionId: input.decisionId,
      scopeId: input.scopeId,
      contextId: input.contextId,
    });

    const context =
      this.store.get<ContextPayload>(
        "CONTEXT",
        input.contextId,
      );

    invariant(
      context !== null &&
        context.state === "REGISTERED",
      "V8_CONTENT_COMPILER_CONTEXT_NOT_REGISTERED",
      "Content compilation requires a registered Context.",
    );

    invariant(
      context.payload.scopeId === input.scopeId,
      "V8_CONTENT_COMPILER_SCOPE_MISMATCH",
      "Context scope does not match compiler scope.",
    );

    /*
     * Resolve and validate the complete epistemic chain before
     * generating any article content.
     *
     * No content is emitted from an unverified Knowledge, Claim,
     * or Evidence record.
     */
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
              record.state === "VERIFIED",
            "V8_CONTENT_COMPILER_KNOWLEDGE_NOT_VERIFIED",
            `Knowledge ${knowledgeId} must be verified.`,
          );

          invariant(
            normalizeArticleText(
              record.payload.proposition,
            ).length > 0,
            "V8_CONTENT_COMPILER_EMPTY_KNOWLEDGE_PROPOSITION",
            `Knowledge ${knowledgeId} has an empty proposition.`,
          );

          invariant(
            record.payload.claimIds.length > 0,
            "V8_CONTENT_COMPILER_KNOWLEDGE_NO_CLAIMS",
            `Knowledge ${knowledgeId} has no Claims.`,
          );

          return record;
        },
      );

    invariant(
      knowledge.length > 0,
      "V8_CONTENT_COMPILER_NO_VERIFIED_KNOWLEDGE",
      "Content compilation requires at least one verified Knowledge record.",
    );

    assertUniquePropositions(knowledge);

    /*
     * Resolve every Claim referenced by the approved Decision's
     * Knowledge set. Claim IDs are canonicalized for deterministic
     * fingerprinting and lineage output.
     */
    const claimIds =
      uniqueSorted(
        knowledge.flatMap(
          (record) => record.payload.claimIds,
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
              record.state === "VERIFIED",
            "V8_CONTENT_COMPILER_CLAIM_NOT_VERIFIED",
            `Claim ${claimId} must be verified.`,
          );

          invariant(
            normalizeArticleText(
              record.payload.statement,
            ).length > 0,
            "V8_CONTENT_COMPILER_EMPTY_CLAIM",
            `Claim ${claimId} has an empty statement.`,
          );

          invariant(
            record.payload.evidenceIds.length > 0,
            "V8_CONTENT_COMPILER_CLAIM_NO_EVIDENCE",
            `Claim ${claimId} has no Evidence.`,
          );

          return record;
        },
      );

    /*
     * Each Knowledge record must point only to Claims that were
     * resolved from the same approved Decision knowledge set.
     */
    const resolvedClaimIds =
      new Set(
        claimRecords.map(
          (record) => record.aggregateId,
        ),
      );

    for (const record of knowledge) {
      for (const claimId of record.payload.claimIds) {
        invariant(
          resolvedClaimIds.has(claimId),
          "V8_CONTENT_COMPILER_KNOWLEDGE_CLAIM_NOT_RESOLVED",
          `Knowledge ${record.aggregateId} references unresolved Claim ${claimId}.`,
        );
      }
    }

    /*
     * Resolve and verify all Evidence referenced by the selected
     * Claims. Evidence IDs are deduplicated only at the aggregate
     * level; individual Knowledge provenance will still point to
     * its own exact Claim set and corresponding Evidence closure.
     */
    const evidenceIds =
      uniqueSorted(
        claimRecords.flatMap(
          (record) => record.payload.evidenceIds,
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
              record.state === "VERIFIED",
            "V8_CONTENT_COMPILER_EVIDENCE_NOT_VERIFIED",
            `Evidence ${evidenceId} must be verified.`,
          );

          return record;
        },
      );

    const resolvedEvidenceIds =
      new Set(
        evidenceRecords.map(
          (record) => record.aggregateId,
        ),
      );

    for (const record of claimRecords) {
      for (const evidenceId of record.payload.evidenceIds) {
        invariant(
          resolvedEvidenceIds.has(evidenceId),
          "V8_CONTENT_COMPILER_CLAIM_EVIDENCE_NOT_RESOLVED",
          `Claim ${record.aggregateId} references unresolved Evidence ${evidenceId}.`,
        );
      }
    }

    /*
     * Compose the body only after the full lineage graph has passed
     * validation.
     *
     * The body contains readable paragraph statements instead of
     * bullet-prefixed database fields. The source-backed proposition
     * text is preserved, not paraphrased.
     */
    const body =
      deterministicBody(
        problem.payload,
        decision.payload,
        context.payload,
        knowledge,
      );

    const bodyAssertions =
      body
        .split("\n")
        .map((line) => line.trim())
        .filter(
          (line) =>
            line.length > 0 &&
            !isStructuralContentLine(line),
        );

    invariant(
      bodyAssertions.length > 0,
      "V8_CONTENT_COMPILER_NO_ASSERTIONS",
      "Compiled content contains no auditable assertions.",
    );

    /*
     * Classify each body assertion by its actual section.
     *
     * This deliberately does not infer provenance from matching
     * wording alone. An identical sentence appearing in different
     * sections must not silently change its lineage category.
     */
    type BodySection =
      | "PROBLEM"
      | "DECISION"
      | "KNOWLEDGE"
      | "CONTEXT"
      | "CONSTRAINTS"
      | "NONE";

    const provenance: ContentProvenance[] = [];

    let section: BodySection = "NONE";

    for (const line of body.split("\n")) {
      const assertion = line.trim();

      if (assertion.length === 0) {
        continue;
      }

      if (isStructuralContentLine(assertion)) {
        switch (assertion) {
          case "Problem":
            section = "PROBLEM";
            break;

          case "Decision":
            section = "DECISION";
            break;

          case "Verified knowledge":
            section = "KNOWLEDGE";
            break;

          case "Context":
            section = "CONTEXT";
            break;

          case "Constraints":
            section = "CONSTRAINTS";
            break;
        }

        continue;
      }

      let kind: ContentProvenanceKind;

      switch (section) {
        case "PROBLEM":
          invariant(
            assertion ===
              normalizeArticleText(
                problem.payload.question,
              ),
            "V8_CONTENT_COMPILER_PROBLEM_SECTION_MISMATCH",
            "Compiled Problem assertion does not match the registered Problem question.",
          );

          kind = "QUESTION";
          break;

        case "DECISION":
          invariant(
            assertion ===
              normalizeArticleText(
                decision.payload.outcome,
              ),
            "V8_CONTENT_COMPILER_DECISION_SECTION_MISMATCH",
            "Compiled Decision assertion does not match the approved Decision outcome.",
          );

          kind = "DECISION";
          break;

        case "KNOWLEDGE":
          invariant(
            knowledge.some(
              (record) =>
                normalizeArticleText(
                  record.payload.proposition,
                ) === assertion,
            ),
            "V8_CONTENT_COMPILER_KNOWLEDGE_SECTION_MISMATCH",
            "Compiled Knowledge assertion does not match a verified Knowledge proposition.",
          );

          kind = "KNOWLEDGE";
          break;

        case "CONTEXT":
          kind = "CONTEXT";
          break;

        case "CONSTRAINTS":
          invariant(
            problem.payload.constraints.some(
              (constraint) =>
                normalizeArticleText(constraint) ===
                assertion,
            ) ||
              assertion ===
                "No explicit constraints were specified.",
            "V8_CONTENT_COMPILER_CONSTRAINT_SECTION_MISMATCH",
            "Compiled Constraint assertion does not match a registered Problem constraint.",
          );

          kind = "CONSTRAINT";
          break;

        default:
          invariant(
            false,
            "V8_CONTENT_COMPILER_ASSERTION_OUTSIDE_SECTION",
            "Compiled assertion is outside a recognized content section.",
          );
      }

      let assertionProblemIds: readonly string[] = [];
      let assertionDecisionIds: readonly string[] = [];
      let assertionContextIds: readonly string[] = [];
      let assertionKnowledgeIds: readonly string[] = [];
      let assertionClaimIds: readonly string[] = [];
      let assertionEvidenceIds: readonly string[] = [];

      /*
       * Structural assertions carry structural lineage only.
       * They must not inherit unrelated epistemic references from
       * the surrounding Decision.
       */
      if (
        kind === "QUESTION" ||
        kind === "CONSTRAINT"
      ) {
        assertionProblemIds = [
          problem.aggregateId,
        ];
      } else if (kind === "DECISION") {
        assertionDecisionIds = [
          decision.aggregateId,
        ];
      } else if (kind === "CONTEXT") {
        assertionContextIds = [
          context.aggregateId,
        ];
      }

      /*
       * Knowledge assertions must resolve to one exact Knowledge
       * aggregate, then to that aggregate's own Claims and Evidence.
       */
      if (kind === "KNOWLEDGE") {
        const knowledgeRecord =
          knowledge.find(
            (record) =>
              normalizeArticleText(
                record.payload.proposition,
              ) === assertion,
          );

        invariant(
          knowledgeRecord !== undefined,
          "V8_CONTENT_COMPILER_KNOWLEDGE_PROVENANCE_NOT_FOUND",
          `Knowledge provenance source not found for assertion ${provenance.length}.`,
        );

        assertionKnowledgeIds = [
          knowledgeRecord.aggregateId,
        ];

        assertionClaimIds =
          uniqueSorted(
            knowledgeRecord.payload.claimIds,
          );

        invariant(
          assertionClaimIds.length > 0,
          "V8_CONTENT_COMPILER_KNOWLEDGE_PROVENANCE_NO_CLAIMS",
          `Knowledge assertion ${provenance.length} has no Claim lineage.`,
        );

        assertionEvidenceIds =
          uniqueSorted(
            assertionClaimIds.flatMap(
              (claimId) => {
                const claim =
                  claimRecords.find(
                    (record) =>
                      record.aggregateId === claimId,
                  );

                invariant(
                  claim !== undefined,
                  "V8_CONTENT_COMPILER_KNOWLEDGE_CLAIM_NOT_FOUND",
                  `Claim ${claimId} required by Knowledge ${knowledgeRecord.aggregateId} was not found.`,
                );

                return claim.payload.evidenceIds;
              },
            ),
          );

        invariant(
          assertionEvidenceIds.length > 0,
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
    /*
     * Fail closed if even one body assertion lacks provenance.
     * The body and provenance must remain positionally aligned.
     */
    invariant(
      provenance.length === bodyAssertions.length,
      "V8_CONTENT_COMPILER_PROVENANCE_COVERAGE_FAILED",
      "Not every compiled content assertion received provenance.",
    );

    for (
      let index = 0;
      index < bodyAssertions.length;
      index += 1
    ) {
      const assertion = bodyAssertions[index];
      const record = provenance[index];

      invariant(
        record !== undefined &&
          record.ordinal === index &&
          record.text === assertion,
        "V8_CONTENT_COMPILER_PROVENANCE_ORDER_MISMATCH",
        `Content provenance does not match body assertion ${index}.`,
      );

      invariant(
        record.fingerprint ===
          contentFingerprint(assertion),
        "V8_CONTENT_COMPILER_PROVENANCE_FINGERPRINT_MISMATCH",
        `Content provenance fingerprint mismatch at assertion ${index}.`,
      );

      if (record.kind === "KNOWLEDGE") {
        invariant(
          record.knowledgeIds.length === 1 &&
            record.claimIds.length > 0 &&
            record.evidenceIds.length > 0,
          "V8_CONTENT_COMPILER_INCOMPLETE_KNOWLEDGE_LINEAGE",
          `Knowledge assertion ${index} does not contain a complete Knowledge -> Claim -> Evidence lineage.`,
        );

        for (const claimId of record.claimIds) {
          const claim = claimRecords.find(
            (candidate) =>
              candidate.aggregateId === claimId,
          );

          invariant(
            claim !== undefined &&
              claim.state === "VERIFIED",
            "V8_CONTENT_COMPILER_LINEAGE_CLAIM_NOT_VERIFIED",
            `Knowledge assertion ${index} references an unverified or missing Claim ${claimId}.`,
          );

          invariant(
            claim.payload.evidenceIds.every(
              (evidenceId) =>
                record.evidenceIds.includes(evidenceId),
            ),
            "V8_CONTENT_COMPILER_LINEAGE_EVIDENCE_INCOMPLETE",
            `Knowledge assertion ${index} omits Evidence referenced by Claim ${claimId}.`,
          );
        }

        for (const evidenceId of record.evidenceIds) {
          const evidence = evidenceRecords.find(
            (candidate) =>
              candidate.aggregateId === evidenceId,
          );

          invariant(
            evidence !== undefined &&
              evidence.state === "VERIFIED",
            "V8_CONTENT_COMPILER_LINEAGE_EVIDENCE_NOT_VERIFIED",
            `Knowledge assertion ${index} references unverified or missing Evidence ${evidenceId}.`,
          );
        }
      }
    }

    /*
     * createContent validates the domain-level body/provenance
     * contract again. Keep this independent validation: compiler
     * correctness must not depend on the caller trusting this method.
     */
    const content: Readonly<Content> =
      createContent({
        decisionId: decisionId(
          decision.aggregateId,
        ),
        title,
        body,
        provenance,
      });

    /*
     * The fingerprint commits to the exact content and all provenance
     * fields. Any change in title, body, lineage, or assertion order
     * produces a different fingerprint.
     */
    const fingerprint =
      contentFingerprint({
        decisionId: decision.aggregateId,
        scopeId: input.scopeId,
        contextId: input.contextId,
        title: content.title,
        body: content.body,
        provenance: content.provenance,
      });

    /*
     * Aggregate-level lineage describes the full set of verified
     * records used by this compilation.
     *
     * Assertion-level provenance remains narrower: each Knowledge
     * assertion carries only its own Knowledge -> Claim -> Evidence
     * closure. The aggregate lineage must not replace that closure.
     */
    const lineage: LineageLink[] = [
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

    /*
     * Reject duplicate aggregate lineage entries and guarantee
     * deterministic ordering without altering the individual
     * assertion provenance.
     */
    const lineageKeys = lineage.map(
      (link) =>
        `${link.type}:${link.id}:${link.version}:${link.fingerprint}`,
    );

    invariant(
      new Set(lineageKeys).size === lineageKeys.length,
      "V8_CONTENT_COMPILER_DUPLICATE_LINEAGE",
      "Compiled content contains duplicate aggregate lineage entries.",
    );

    const orderedLineage =
      immutable(
        [...lineage].sort(
          (left, right) => {
            const byType =
              left.type.localeCompare(right.type);

            if (byType !== 0) {
              return byType;
            }

            const byId =
              left.id.localeCompare(right.id);

            if (byId !== 0) {
              return byId;
            }

            const byVersion =
              left.version - right.version;

            if (byVersion !== 0) {
              return byVersion;
            }

            return left.fingerprint.localeCompare(
              right.fingerprint,
            );
          },
        ),
      );

    return immutable({
      content,
      fingerprint,
      lineage: orderedLineage,
      decision,
    });
  }
}