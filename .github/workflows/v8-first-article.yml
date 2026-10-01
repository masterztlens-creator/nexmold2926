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
  readonly searchProvider?: SearchProvider;
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
        | "HIGH"
        | "MEDIUM"
        | "LOW" =
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

      const units =
        typeof item.unit === "string" &&
        item.unit.trim()
          ? [
              item.unit.trim(),
            ]
          : undefined;

      candidates.push({
        statement,
        evidenceIds: [
          this.evidenceIds[index],
        ],
        epistemicLevel,
        confidence,
        ...(units
          ? {
              units,
            }
          : {}),
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

function canonicalEvidenceId(
  sourceId: string,
  snapshotId: string,
  snapshotContentHash: string,
  evidence: EvidencePayload,
): string {
  return evidenceId(
    contentFingerprint({
      source:
        sourceId,
      snapshotId,
      snapshotContentHash,

      locator:
        evidence.locator,
      excerpt:
        evidence.excerpt,

      page:
        evidence.page,
      printedPage:
        evidence.printedPage,

      section:
        evidence.section,
      table:
        evidence.table,
      row:
        evidence.row,

      parameter:
        evidence.parameter,
      value:
        evidence.value,
      unit:
        evidence.unit,

      materialManufacturer:
        evidence.materialManufacturer,
      materialGrade:
        evidence.materialGrade,

      testMethod:
        evidence.testMethod,
      testCondition:
        evidence.testCondition,
      flowDirection:
        evidence.flowDirection,

      extractionConfidence:
        evidence.extractionConfidence ?? "LOW",
    }),
  ).toString();
}

/*
 * Runtime Evidence Topic Selection
 *
 * Acquisition persists the complete Evidence inventory for every fetched
 * Internet page. That inventory is intentionally broader than the Evidence
 * set used by one Article Runtime execution.
 *
 * Runtime selection MUST therefore be driven by the Problem.question.
 *
 * Selection contract:
 *
 *   Problem.question
 *        ↓
 *   normalized semantic terms / phrases
 *        ↓
 *   Evidence semantic fields
 *        ↓
 *   deterministic relevance score
 *        ↓
 *   one canonical Evidence per acquisition
 *
 * The selector never falls back to "the first Evidence".
 *
 * This is important because an Internet document may contain multiple
 * independent topics. For example:
 *
 *   "Wall Thickness"
 *   "Maximum Dimensions"
 *   "Draft Angle"
 *   "Material Selection"
 *
 * are all legitimate Evidence topics on one manufacturing page, but they
 * are NOT interchangeable.
 *
 * The selector is intentionally conservative:
 *
 *   - exact multi-word topic phrases receive substantially more weight
 *   - section / table / parameter matches receive higher weight than
 *     incidental excerpt matches
 *   - generic phrases that occur throughout the Evidence inventory receive
 *     less weight through deterministic document-frequency weighting
 *   - at least one meaningful topic phrase must match
 *   - no topic-relevant Evidence means FAIL CLOSED
 *
 * No Evidence is deleted or mutated by this function.
 */

const TOPIC_STOP_WORDS = new Set([
  "a",
  "about",
  "an",
  "and",
  "are",
  "be",
  "by",
  "can",
  "does",
  "for",
  "from",
  "how",
  "in",
  "into",
  "is",
  "of",
  "on",
  "or",
  "should",
  "that",
  "the",
  "their",
  "this",
  "to",
  "under",
  "using",
  "use",
  "used",
  "what",
  "when",
  "which",
  "with",
  "within",
];

const TOPIC_SEARCH_FIELDS: readonly {
  readonly key: keyof EvidencePayload;
  readonly weight: number;
}[] = [
  {
    key: "section",
    weight: 8,
  },
  {
    key: "table",
    weight: 7,
  },
  {
    key: "parameter",
    weight: 7,
  },
  {
    key: "row",
    weight: 5,
  },
  {
    key: "excerpt",
    weight: 4,
  },
  {
    key: "locator",
    weight: 2,
  },
];

interface TopicPhrase {
  readonly value: string;
  readonly tokenCount: number;
}

interface EvidenceRelevance {
  readonly score: number;
  readonly phraseMatches: readonly string[];
  readonly tokenMatches: readonly string[];
}

function normalizeTopicText(
  value: string,
): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(
      /[^\p{L}\p{N}]+/gu,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function topicTokens(
  value: string,
): readonly string[] {
  return normalizeTopicText(
    value,
  )
    .split(" ")
    .filter(
      (token) =>
        token.length > 1 &&
        !TOPIC_STOP_WORDS.has(token),
    );
}

function uniqueStrings(
  values: readonly string[],
): readonly string[] {
  return [
    ...new Set(
      values.filter(
        (value) =>
          value.length > 0,
      ),
    ),
  ];
}

function buildTopicPhrases(
  question: string,
): readonly TopicPhrase[] {
  const tokens =
    topicTokens(question);

  const phrases: TopicPhrase[] = [];

  /*
   * Longer phrases are considered first because they generally represent
   * more specific concepts than individual words or short phrases.
   *
   * Example:
   *
   *   plastic injection molding wall thickness
   *
   * yields:
   *
   *   plastic injection molding wall
   *   injection molding wall thickness
   *   plastic injection molding
   *   injection molding
   *   wall thickness
   *
   * The selector later weights these according to actual Evidence frequency,
   * so a ubiquitous "injection molding" phrase cannot automatically outrank
   * a specific "wall thickness" topic.
   */
  for (
    let size = 4;
    size >= 2;
    size -= 1
  ) {
    for (
      let start = 0;
      start + size <= tokens.length;
      start += 1
    ) {
      const phrase =
        tokens
          .slice(
            start,
            start + size,
          )
          .join(" ");

      phrases.push({
        value: phrase,
        tokenCount: size,
      });
    }
  }

  return uniqueStrings(
    phrases.map(
      (phrase) =>
        phrase.value,
    ),
  ).map(
    (value) => ({
      value,
      tokenCount:
        value.split(" ").length,
    }),
  );
}

function evidenceSearchText(
  evidence: EvidencePayload,
): string {
  return normalizeTopicText(
    [
      evidence.section,
      evidence.table,
      evidence.parameter,
      evidence.row,
      evidence.excerpt,
      evidence.locator,
    ]
      .filter(
        (
          value,
        ): value is string =>
          typeof value === "string" &&
          value.trim().length > 0,
      )
      .join(" "),
  );
}

function evidenceFieldText(
  evidence: EvidencePayload,
  key: keyof EvidencePayload,
): string {
  const value =
    evidence[key];

  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return normalizeTopicText(
    value,
  );
}

function phraseDocumentFrequency(
  evidenceInventory:
    readonly EvidencePayload[][],
  phrase: string,
): number {
  let frequency = 0;

  for (
    const evidenceList of evidenceInventory
  ) {
    for (
      const evidence of evidenceList
    ) {
      const text =
        evidenceSearchText(
          evidence,
        );

      if (
        text.includes(
          phrase,
        )
      ) {
        frequency += 1;
      }
    }
  }

  return frequency;
}

function tokenDocumentFrequency(
  evidenceInventory:
    readonly EvidencePayload[][],
  token: string,
): number {
  let frequency = 0;

  for (
    const evidenceList of evidenceInventory
  ) {
    for (
      const evidence of evidenceList
    ) {
      const tokens =
        new Set(
          topicTokens(
            evidenceSearchText(
              evidence,
            ),
          ),
        );

      if (
        tokens.has(token)
      ) {
        frequency += 1;
      }
    }
  }

  return frequency;
}

function phraseSpecificityWeight(
  phrase: TopicPhrase,
  documentCount: number,
  totalEvidenceCount: number,
): number {
  if (
    documentCount <= 0 ||
    totalEvidenceCount <= 0
  ) {
    return 0;
  }

  /*
   * Deterministic inverse-frequency weighting.
   *
   * A phrase present in nearly every Evidence record is weak evidence of
   * topical relevance. A phrase occurring in only one or two records is
   * substantially more discriminative.
   *
   * The token-count multiplier favors specific multi-word concepts.
   */
  const rarity =
    Math.log(
      (
        totalEvidenceCount + 1
      ) /
        (
          documentCount + 1
        ),
    );

  return (
    rarity *
    (
      4 +
      phrase.tokenCount * 4
    )
  );
}

function tokenSpecificityWeight(
  documentCount: number,
  totalEvidenceCount: number,
): number {
  if (
    documentCount <= 0 ||
    totalEvidenceCount <= 0
  ) {
    return 0;
  }

  return Math.log(
    (
      totalEvidenceCount + 1
    ) /
      (
        documentCount + 1
      ),
  );
}

function scoreEvidence(
  evidence: EvidencePayload,
  topicPhrases: readonly TopicPhrase[],
  questionTokens: readonly string[],
  phraseFrequency:
    ReadonlyMap<string, number>,
  tokenFrequency:
    ReadonlyMap<string, number>,
  totalEvidenceCount: number,
): EvidenceRelevance {
  const normalizedFields =
    TOPIC_SEARCH_FIELDS.map(
      (field) => ({
        key:
          field.key,
        weight:
          field.weight,
        text:
          evidenceFieldText(
            evidence,
            field.key,
          ),
      }),
    );

  const fullText =
    evidenceSearchText(
      evidence,
    );

  let score = 0;

  const phraseMatches: string[] = [];
  const tokenMatches: string[] = [];

  for (
    const phrase of topicPhrases
  ) {
    if (
      !fullText.includes(
        phrase.value,
      )
    ) {
      continue;
    }

    const documentCount =
      phraseFrequency.get(
        phrase.value,
      ) ?? 0;

    const specificity =
      phraseSpecificityWeight(
        phrase,
        documentCount,
        totalEvidenceCount,
      );

    /*
     * The phrase must carry a meaningful signal even when the phrase is
     * common. Multi-word exact matches therefore receive a deterministic
     * base weight in addition to their rarity weight.
     */
    const basePhraseWeight =
      12 +
      phrase.tokenCount * 8;

    score +=
      basePhraseWeight +
      specificity;

    phraseMatches.push(
      phrase.value,
    );

    for (
      const field of normalizedFields
    ) {
      if (
        field.text.includes(
          phrase.value,
        )
      ) {
        score +=
          field.weight *
          (
            2 +
            phrase.tokenCount
          );
      }
    }
  }

  for (
    const token of questionTokens
  ) {
    if (
      fullText
        .split(" ")
        .includes(token)
    ) {
      const documentCount =
        tokenFrequency.get(
          token,
        ) ?? 0;

      score +=
        1 +
        tokenSpecificityWeight(
          documentCount,
          totalEvidenceCount,
        );

      tokenMatches.push(
        token,
      );
    }
  }

  /*
   * Exact semantic-field matches receive a final deterministic bonus.
   *
   * This prevents a topic phrase that merely happens to occur in a long
   * excerpt from outranking a matching section/parameter heading.
   */
  for (
    const phrase of topicPhrases
  ) {
    for (
      const field of normalizedFields
    ) {
      if (
        field.text ===
        phrase.value
      ) {
        score +=
          field.weight *
          (
            4 +
            phrase.tokenCount
          );
      }
    }
  }

  return {
    score,
    phraseMatches:
      uniqueStrings(
        phraseMatches,
      ),
    tokenMatches:
      uniqueStrings(
        tokenMatches,
      ),
  };
}

function selectRuntimeEvidence(
  acquisitions:
    readonly ResearchAcquisitionResult["acquisitions"][number][],
  question: string,
): readonly {
  readonly id: string;
  readonly payload: EvidencePayload;
}[] {
  const evidenceInventory =
    acquisitions.map(
      (record) =>
        record.acquisition.evidence,
    );

  const totalEvidenceCount =
    evidenceInventory.reduce(
      (
        total,
        evidence,
      ) =>
        total +
        evidence.length,
      0,
    );

  invariant(
    totalEvidenceCount > 0,
    "V8_ARTICLE_RUNTIME_NO_EVIDENCE",
    "Runtime Evidence selection received an empty Evidence inventory.",
  );

  const topicPhrases =
    buildTopicPhrases(
      question,
    );

  const questionTokens =
    topicTokens(
      question,
    );

  invariant(
    topicPhrases.length > 0 &&
      questionTokens.length > 0,
    "V8_ARTICLE_RUNTIME_INVALID_TOPIC",
    "Problem.question does not contain a selectable semantic topic.",
  );

  const phraseFrequency =
    new Map<string, number>();

  for (
    const phrase of topicPhrases
  ) {
    phraseFrequency.set(
      phrase.value,
      phraseDocumentFrequency(
        evidenceInventory,
        phrase.value,
      ),
    );
  }

  const tokenFrequency =
    new Map<string, number>();

  for (
    const token of questionTokens
  ) {
    tokenFrequency.set(
      token,
      tokenDocumentFrequency(
        evidenceInventory,
        token,
      ),
    );
  }

  const selected: {
    id: string;
    payload: EvidencePayload;
  }[] = [];

  const selectedIds =
    new Set<string>();

  for (
    const record of acquisitions
  ) {
    let selectedForAcquisition:
      | {
          id: string;
          payload: EvidencePayload;
          score: number;
          phraseMatches:
            readonly string[];
          tokenMatches:
            readonly string[];
          evidenceIndex: number;
        }
      | undefined;

    for (
      let evidenceIndex = 0;
      evidenceIndex <
        record.acquisition.evidence.length;
      evidenceIndex += 1
    ) {
      const payload =
        record.acquisition.evidence[
          evidenceIndex
        ];

      const id =
        canonicalEvidenceId(
          record.acquisition.sourceId,
          record.acquisition.snapshotId,
          record.acquisition.snapshot.contentHash,
          payload,
        );

      if (
        selectedIds.has(id)
      ) {
        continue;
      }

      const relevance =
        scoreEvidence(
          payload,
          topicPhrases,
          questionTokens,
          phraseFrequency,
          tokenFrequency,
          totalEvidenceCount,
        );

      /*
       * A meaningful topic phrase is mandatory.
       *
       * Generic token overlap alone is not sufficient because a page may
       * contain broad manufacturing terminology around several unrelated
       * parameters.
       */
      if (
        relevance.phraseMatches.length ===
        0
      ) {
        continue;
      }

      if (
        selectedForAcquisition ===
          undefined ||
        relevance.score >
          selectedForAcquisition.score
      ) {
        selectedForAcquisition = {
          id,
          payload,
          score:
            relevance.score,
          phraseMatches:
            relevance.phraseMatches,
          tokenMatches:
            relevance.tokenMatches,
          evidenceIndex,
        };
      }
    }

    invariant(
      selectedForAcquisition !==
        undefined,
      "V8_ARTICLE_RUNTIME_NO_TOPIC_RELEVANT_EVIDENCE",
      [
        `Acquisition ${record.candidateUrl} produced no Evidence relevant to Problem.question.`,
        `question=${question}`,
      ].join(" "),
    );

    /*
     * Deterministic diagnostic only. No external state is changed.
     *
     * Keeping the selected semantic signal visible makes an incorrect
     * publication artifact diagnosable without weakening the fail-closed
     * contract.
     */
    console.debug(
      "[V8-ARTICLE-RUNTIME][EVIDENCE-SELECTION]",
      JSON.stringify({
        candidateUrl:
          record.candidateUrl,
        question,
        selectedEvidenceId:
          selectedForAcquisition.id,
        score:
          selectedForAcquisition.score,
        phraseMatches:
          selectedForAcquisition.phraseMatches,
        tokenMatches:
          selectedForAcquisition.tokenMatches,
        evidenceIndex:
          selectedForAcquisition.evidenceIndex,
      }),
    );

    selectedIds.add(
      selectedForAcquisition.id,
    );

    selected.push({
      id:
        selectedForAcquisition.id,
      payload:
        selectedForAcquisition.payload,
    });
  }

  invariant(
    selected.length ===
      acquisitions.length,
    "V8_ARTICLE_RUNTIME_EVIDENCE_SELECTION_INCOMPLETE",
    "Runtime Evidence selection did not produce one topic-relevant canonical Evidence record per acquisition.",
  );

  return selected;
}

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

  if (
    acquisition.acquisitions.length ===
    0
  ) {
    console.error(
      "[V8-21][ACQUISITION-DIAGNOSTIC]",
    );

    console.error(
      `queries=${acquisition.plan.sourceQueries.length}`,
    );

    console.error(
      `discoveryCandidates=${acquisition.discovery.candidates.length}`,
    );

    console.error(
      `searchErrors=${acquisition.searchErrors.length}`,
    );

    for (
      let index = 0;
      index <
        acquisition.searchErrors.length;
      index += 1
    ) {
      const error =
        acquisition.searchErrors[index];

      console.error(
        `[V8-21][SEARCH-ERROR][${index + 1}] query=${error.query ?? ""}`,
      );

      console.error(
        `[V8-21][SEARCH-ERROR][${index + 1}] error=${error.error}`,
      );
    }

    console.error(
      `fetchErrors=${acquisition.fetchErrors.length}`,
    );

    for (
      let index = 0;
      index <
        acquisition.fetchErrors.length;
      index += 1
    ) {
      const error =
        acquisition.fetchErrors[index];

      console.error(
        `[V8-21][FETCH-ERROR][${index + 1}] url=${error.url ?? ""}`,
      );

      console.error(
        `[V8-21][FETCH-ERROR][${index + 1}] error=${error.error}`,
      );
    }

    invariant(
      false,
      "V8_ARTICLE_RUNTIME_NO_ACQUISITION",
      [
        "Internet acquisition produced no successful acquisition records.",
        `queries=${acquisition.plan.sourceQueries.length}`,
        `discoveryCandidates=${acquisition.discovery.candidates.length}`,
        `searchErrors=${acquisition.searchErrors.length}`,
        `fetchErrors=${acquisition.fetchErrors.length}`,
      ].join("; "),
    );
  }

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

  /*
   * The Foundation retains the complete Evidence inventory.
   *
   * Runtime Truth Production uses one deterministic topic-relevant canonical
   * Evidence aggregate per acquisition rather than promoting the entire
   * extraction inventory into Claims and Knowledge.
   *
   * Critically, this selection is driven by Problem.question rather than
   * extractor order.
   */
  const selectedEvidence =
    selectRuntimeEvidence(
      acquisition.acquisitions,
      input.problem.question,
    );

  const evidenceIds =
    selectedEvidence.map(
      (item) => item.id,
    );

  const selectedEvidencePayloads =
    selectedEvidence.map(
      (item) => item.payload,
    );

  invariant(
    evidenceIds.length > 0 &&
      evidenceIds.length ===
        acquisition.acquisitions.length &&
      evidenceIds.length ===
        selectedEvidencePayloads.length,
    "V8_ARTICLE_RUNTIME_EVIDENCE_ID_MAPPING_FAILED",
    "Runtime Evidence selection and identity mapping failed.",
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
    verifiedEvidenceIds.length ===
      acquisition.acquisitions.length,
    "V8_ARTICLE_RUNTIME_VERIFIED_EVIDENCE_COUNT_MISMATCH",
    "The number of verified runtime Evidence records does not match the number of acquisitions.",
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

  invariant(
    verifiedPayloads.length ===
      selectedEvidencePayloads.length,
    "V8_ARTICLE_RUNTIME_SELECTED_EVIDENCE_LOOKUP_MISMATCH",
    "Verified Evidence payload count does not match selected runtime Evidence count.",
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

  if (
    truth.rejectedCandidates.length >
    0
  ) {
    console.error(
      "[V8-TRUTH-PRODUCER][DIAGNOSTIC]",
    );

    console.error(
      `candidates=${verifiedPayloads.length}`,
    );

    console.error(
      `claims=${truth.claims.length}`,
    );

    console.error(
      `knowledge=${truth.knowledge.length}`,
    );

    console.error(
      `rejectedCandidates=${truth.rejectedCandidates.length}`,
    );

    for (
      let index = 0;
      index <
        truth.rejectedCandidates.length;
      index += 1
    ) {
      const rejected =
        truth.rejectedCandidates[index];

      console.error(
        `[V8-TRUTH-PRODUCER][REJECTED][${index + 1}]`,
      );

      console.error(
        `statement=${rejected.statement}`,
      );

      console.error(
        `reason=${rejected.reason}`,
      );
    }
  }

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
                  canonicalEvidenceId(
                    item.acquisition.sourceId,
                    item.acquisition.snapshotId,
                    item.acquisition.snapshot.contentHash,
                    evidence,
                  ),
              ),
          }),
        ),
      selectedRuntimeEvidenceIds:
        evidenceIds,
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