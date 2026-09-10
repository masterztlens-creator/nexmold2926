import { immutable, invariant } from "../constitution/invariants.js";
import { contentFingerprint } from "../foundation/hash.js";
import type {
  FoundationRecord,
  FoundationStore,
  LineageLink,
} from "../foundation/types.js";
import { decisionId } from "../domain/primitives.js";
import { createContent, type Content } from "../domain/content.js";
import { decisionId } from "../domain/primitives.js";
import { DecisionValidator } from "../decision-validation/validator.js";
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
  readonly variables: Readonly<Record<string, string>>;
}

interface KnowledgePayload {
  readonly proposition: string;
  readonly claimIds: readonly string[];
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

function deterministicBody(
  problem: ProblemPayload,
  decision: DecisionPayload,
  context: ContextPayload,
  knowledge: readonly FoundationRecord<KnowledgePayload>[],
): string {
  const knowledgeLines = knowledge
    .map((record) => record.payload.proposition.trim())
    .sort()
    .map((proposition) => `- ${proposition}`)
    .join("\n");

  const constraintLines =
    problem.constraints.length > 0
      ? problem.constraints
          .map((constraint) => constraint.trim())
          .sort()
          .map((constraint) => `- ${constraint}`)
          .join("\n")
      : "- None specified.";

  const variableLines =
    Object.entries(context.variables)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n") || "- None specified.";

  return [
    `Problem`,
    problem.question.trim(),
    ``,
    `Decision`,
    decision.outcome.trim(),
    ``,
    `Verified knowledge`,
    knowledgeLines,
    ``,
    `Context`,
    `Purpose: ${context.purpose.trim()}`,
    `Context ID: ${context.scopeId}`,
    variableLines,
    ``,
    `Constraints`,
    constraintLines,
  ].join("\n");
}

export class ContentCompiler {
  private readonly validator: DecisionValidator;

  constructor(
    private readonly store: FoundationStore,
  ) {
    this.validator = new DecisionValidator(store);
  }

  compile(input: ContentCompilerInput): CompiledContent {
    const title = input.title.trim();

    invariant(
      title.length > 0,
      "V8_CONTENT_COMPILER_EMPTY_TITLE",
      "Content title cannot be empty.",
    );

    this.validator.assert({
      decisionId: input.decisionId,
      scopeId: input.scopeId,
      contextId: input.contextId,
    });

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

    const knowledge = decision.payload.knowledgeIds.map(
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

        return record;
      },
    );

    const body = deterministicBody(
      problem.payload,
      decision.payload,
      context.payload,
      knowledge,
    );

    const content = createContent({
      decisionId: decisionId(decision.aggregateId),
      title,
      body,
    });

    const fingerprint = contentFingerprint({
      decisionId: decision.aggregateId,
      scopeId: input.scopeId,
      contextId: input.contextId,
      title: content.title,
      body: content.body,
    });

    const lineage: LineageLink[] = [
      lineageOf(decision, "DECISION"),
      lineageOf(problem, "PROBLEM"),
      lineageOf(context, "CONTEXT"),
      ...knowledge.map((record) =>
        lineageOf(record, "KNOWLEDGE"),
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