import {
  createScope,
  type Scope,
} from "../domain/scope.js";

import {
  createContext,
  type Context,
} from "../domain/context.js";

import {
  createProblem,
  type Problem,
} from "../domain/problem.js";

import {
  createDecision,
} from "../domain/decision.js";

import {
  knowledgeId,
  evidenceId,
  type KnowledgeId,
} from "../domain/primitives.js";

import type {
  ClaimEpistemicLevel,
} from "../domain/claim.js";

import {
  FoundationService,
} from "../foundation/service.js";

import {
  InMemoryFoundationStore,
} from "../foundation/store.js";

import type {
  AuditActor,
  EvidencePayload,
  FoundationStore,
} from "../foundation/types.js";

import {
  TruthProducer,
  type ClaimInterpreter,
  type TruthProducerInput,
  type ClaimCandidate,
} from "../intelligence/truth-producer/index.js";

import {
  ContentCompiler,
} from "../content-compiler/compiler.js";

import {
  runResearchAcquisition,
  type ResearchAcquisitionConfig,
  type ResearchAcquisitionResult,
} from "../intelligence/research-planner/acquisition-runner.js";

import type {
  SearchProvider,
  PageFetcher,
} from "../acquisition/types.js";

import type {
  Opportunity,
} from "../intelligence/shared.js";

import {
  contentFingerprint,
} from "../foundation/hash.js";

import {
  invariant,
} from "../constitution/invariants.js";

import type {
  Content,
} from "../domain/content.js";

export interface ArticleRuntimeInput {
  readonly opportunity: Opportunity;
  readonly searchProvider: SearchProvider;
  readonly pageFetcher: PageFetcher;
  readonly store?: FoundationStore;
  readonly actor?: AuditActor;
  readonly acquisition?: ResearchAcquisitionConfig;
  readonly scope: ScopeInput;
  readonly context: ContextInput;
  readonly problem: ProblemInput;
  readonly title: string;
}

export interface ScopeInput {
  readonly id?: string;
  readonly geography: string;
  readonly industries: readonly string[];
  readonly languages: readonly string[];
}

export interface ContextInput {
  readonly id?: string;
  readonly purpose: string;
  readonly variables?: Readonly<Record<string, string>>;
}

export interface ProblemInput {
  readonly id?: string;
  readonly question: string;
  readonly constraints?: readonly string[];
}

export interface ArticleRuntimeResult {
  readonly acquisition: ResearchAcquisitionResult;
  readonly verifiedEvidenceIds: readonly string[];
  readonly claimIds: readonly string[];
  readonly knowledgeIds: readonly string[];
  readonly scopeId: string;
  readonly contextId: string;
  readonly problemId: string;
  readonly decisionId: string;
  readonly content: Content;
  readonly fingerprint: string;
}

export class ConservativeClaimInterpreter
  implements ClaimInterpreter
{
  private readonly evidenceIds: readonly string[];

  constructor(
    evidenceIds: readonly string[],
  ) {
    this.evidenceIds = [
      ...evidenceIds,
    ];
  }

  interpret(
    evidence: readonly EvidencePayload[],
  ): readonly ClaimCandidate[] {
    invariant(
      evidence.length ===
        this.evidenceIds.length,
      "V8_ARTICLE_RUNTIME_EVIDENCE_MAPPING_MISMATCH",
      "Evidence payload count does not match Evidence ID count.",
    );

    const candidates: ClaimCandidate[] = [];

    for (
      let index = 0;
      index < evidence.length;
      index += 1
    ) {
      const item =
        evidence[index];

      const statement =
        item.excerpt.trim();

      if (!statement) {
        continue;
      }

      const confidence:
        "HIGH" |
        "MEDIUM" |
        "LOW" =
        item.extractionConfidence ===
        "HIGH"
          ? "HIGH"
          : item.extractionConfidence ===
              "MEDIUM"
            ? "MEDIUM"
            : "LOW";

      const epistemicLevel:
        ClaimEpistemicLevel =
        "OBSERVATION";

      candidates.push({
        statement,
        evidenceIds: [
          this.evidenceIds[index],
        ],
        epistemicLevel,
        confidence,
        isUniversal: false,
      });
    }

    return candidates;
  }
}

const DEFAULT_ACTOR: AuditActor = {
  id: "v8:article-runtime",
  role: "SYSTEM",
};

export async function runV8ArticleRuntime(
  input: ArticleRuntimeInput,
): Promise<ArticleRuntimeResult> {
  const actor =
    input.actor ??
    DEFAULT_ACTOR;

  const store =
    input.store ??
    new InMemoryFoundationStore();

  const service =
    new FoundationService(store);

  const acquisition =
    await runResearchAcquisition(
      input.opportunity,
      input.searchProvider,
      input.pageFetcher,
      store,
      {
        ...input.acquisition,
        actorId:
          input.acquisition?.actorId ??
          actor.id,
      },
    );

  invariant(
    acquisition.acquisitions.length > 0,
    "V8_ARTICLE_RUNTIME_NO_ACQUISITION",
    "No Internet acquisition result was produced.",
  );

  const evidencePayloads =
    acquisition.acquisitions.flatMap(
      (record) =>
        record.acquisition.evidence,
    );

  invariant(
    evidencePayloads.length > 0,
    "V8_ARTICLE_RUNTIME_NO_EVIDENCE",
    "Internet acquisition produced no Evidence records.",
  );

  const evidenceIds =
    acquisition.acquisitions.flatMap(
      (record) =>
        record.acquisition.evidence.map(
          (evidence) =>
            evidenceId(
              contentFingerprint({
                source:
                  record.acquisition.sourceId,
                snapshotId:
                  record.acquisition.snapshotId,
                snapshotContentHash:
                  record.acquisition.snapshot.contentHash,
                locator:
                  evidence.locator,
                excerpt:
                  evidence.excerpt,
                parameter:
                  evidence.parameter,
                value:
                  evidence.value,
                unit:
                  evidence.unit,
              }),
            ).toString(),
        ),
    );

  invariant(
    evidenceIds.length ===
      evidencePayloads.length,
    "V8_ARTICLE_RUNTIME_EVIDENCE_ID_MAPPING_FAILED",
    "Evidence identity mapping failed.",
  );

  const verifiedEvidenceIds:
    string[] = [];

  for (
    const id of evidenceIds
  ) {
    const record =
      store.get<EvidencePayload>(
        "EVIDENCE",
        id,
      );

    invariant(
      record !== null,
      "V8_ARTICLE_RUNTIME_EVIDENCE_NOT_PERSISTED",
      `Evidence ${id} is not present in the Foundation store.`,
    );

    const verified =
      service.verifyEvidence(
        id,
        actor,
        "V8 article runtime evidence verification",
      );

    invariant(
      verified.state ===
        "VERIFIED",
      "V8_ARTICLE_RUNTIME_EVIDENCE_NOT_VERIFIED",
      `Evidence ${id} did not reach VERIFIED state.`,
    );

    verifiedEvidenceIds.push(
      id,
    );
  }

  invariant(
    verifiedEvidenceIds.length > 0,
    "V8_ARTICLE_RUNTIME_NO_VERIFIED_EVIDENCE",
    "No Evidence record reached VERIFIED state.",
  );

  const verifiedPayloads =
    verifiedEvidenceIds.map(
      (id) => {
        const record =
          store.get<EvidencePayload>(
            "EVIDENCE",
            id,
          );

        invariant(
          record !== null &&
            record.state ===
              "VERIFIED",
          "V8_ARTICLE_RUNTIME_EVIDENCE_LOOKUP_FAILED",
          `Verified Evidence ${id} could not be reloaded.`,
        );

        return record.payload;
      },
    );

  const interpreter =
    new ConservativeClaimInterpreter(
      verifiedEvidenceIds,
    );

  const truthProducer =
    new TruthProducer(
      service,
      interpreter,
    );

  const truthInput:
    TruthProducerInput = {
    evidence:
      verifiedPayloads,
    actor: {
      id: actor.id,
      role: actor.role,
    },
  };

  const truth =
    truthProducer.produce(
      truthInput,
    );

  invariant(
    truth.claims.length > 0,
    "V8_ARTICLE_RUNTIME_NO_CLAIMS",
    "Verified Evidence produced no admissible Claims.",
  );

  invariant(
    truth.knowledge.length > 0,
    "V8_ARTICLE_RUNTIME_NO_KNOWLEDGE",
    "Verified Claims produced no Knowledge records.",
  );

  const scope =
    createScope({
      id:
        input.scope.id ??
        `scope:v8:${contentFingerprint({
          geography:
            input.scope.geography,
          industries:
            input.scope.industries,
          languages:
            input.scope.languages,
        })}`,
      geography:
        input.scope.geography,
      industries:
        input.scope.industries,
      languages:
        input.scope.languages,
    });

  const scopeRecord =
    service.registerScope(
      scope,
      actor,
      "V8 article runtime scope registration",
    );

  const context =
    createContext({
      id:
        input.context.id ??
        `context:v8:${contentFingerprint({
          scopeId:
            scope.id,
          purpose:
            input.context.purpose,
          variables:
            input.context.variables ??
            {},
        })}`,
      scopeId:
        scope.id,
      purpose:
        input.context.purpose,
      variables:
        input.context.variables ??
        {},
    });

  const contextRecord =
    service.registerContext(
      context,
      actor,
      "V8 article runtime context registration",
    );

  const problem =
    createProblem({
      id:
        input.problem.id ??
        `problem:v8:${contentFingerprint({
          contextId:
            context.id,
          question:
            input.problem.question,
          constraints:
            input.problem.constraints ??
            [],
        })}`,
      contextId:
        context.id,
      question:
        input.problem.question,
      constraints:
        input.problem.constraints ??
        [],
    });

  const problemRecord =
    service.registerProblem(
      problem,
      actor,
      "V8 article runtime problem registration",
    );

  const knowledgeIds:
    readonly KnowledgeId[] =
    truth.knowledge.map(
      (id) =>
        knowledgeId(id),
    );

  invariant(
    knowledgeIds.length > 0,
    "V8_ARTICLE_RUNTIME_NO_KNOWLEDGE_IDS",
    "No Knowledge IDs are available for Decision creation.",
  );

  const decisionFingerprint =
    contentFingerprint({
      problemId:
        problem.id,
      knowledgeIds,
      scopeId:
        scope.id,
      contextId:
        context.id,
      title:
        input.title,
    });

  const decision =
    createDecision({
      id:
        `decision:v8:${decisionFingerprint}`,
      problemId:
        problem.id,
      knowledgeIds,
      outcome:
        "Compile evidence-backed content from the verified knowledge associated with this problem.",
      status:
        "APPROVED",
    });

  const decisionRecord =
    service.createDecision(
      decision,
      scope.id,
      context.id,
      actor,
      "V8 article runtime decision approval",
    );

  invariant(
    decisionRecord.state ===
      "APPROVED",
    "V8_ARTICLE_RUNTIME_DECISION_NOT_APPROVED",
    "The runtime Decision did not reach APPROVED state.",
  );

  const compiler =
    new ContentCompiler(
      store,
    );

  const compiled =
    compiler.compile({
      decisionId:
        decision.id,
      scopeId:
        scope.id,
      contextId:
        context.id,
      title:
        input.title,
    });

  const fingerprint =
    contentFingerprint({
      acquisition:
        acquisition.acquisitions.map(
          (item) => ({
            candidateUrl:
              item.candidateUrl,
            evidenceIds:
              item.acquisition.evidence.map(
                (evidence) =>
                  evidenceId(
                    contentFingerprint({
                      source:
                        item.acquisition.sourceId,
                      snapshotId:
                        item.acquisition.snapshotId,
                      snapshotContentHash:
                        item.acquisition.snapshot.contentHash,
                      locator:
                        evidence.locator,
                      excerpt:
                        evidence.excerpt,
                      parameter:
                        evidence.parameter,
                      value:
                        evidence.value,
                      unit:
                        evidence.unit,
                    }),
                  ).toString(),
              ),
          }),
        ),
      verifiedEvidenceIds,
      claimIds:
        truth.claims,
      knowledgeIds:
        knowledgeIds.map(
          (id) =>
            String(id),
        ),
      scopeId:
        scope.id,
      contextId:
        context.id,
      problemId:
        problem.id,
      decisionId:
        decision.id,
      contentFingerprint:
        compiled.fingerprint,
    });

  return {
    acquisition,

    verifiedEvidenceIds:
      [
        ...verifiedEvidenceIds,
      ],

    claimIds:
      [
        ...truth.claims,
      ],

    knowledgeIds:
      knowledgeIds.map(
        (id) =>
          String(id),
      ),

    scopeId:
      scopeRecord.aggregateId,

    contextId:
      contextRecord.aggregateId,

    problemId:
      problemRecord.aggregateId,

    decisionId:
      decisionRecord.aggregateId,

    content:
      compiled.content,

    fingerprint,
  };
}