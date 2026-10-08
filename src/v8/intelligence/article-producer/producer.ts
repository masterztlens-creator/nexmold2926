import {
  HttpPageFetcher,
} from "../../acquisition/page-fetcher.js";

import type {
  PageFetcher,
} from "../../acquisition/types.js";

import {
  InMemoryFoundationStore,
} from "../../foundation/store.js";

import type {
  FoundationStore,
} from "../../foundation/types.js";

import {
  runV8ArticleRuntime,
  type ArticleRuntimeResult,
  type ContextInput,
  type ProblemInput,
  type ScopeInput,
} from "../../runtime/article-runtime.js";

import {
  buildKeywordUniverse,
  type KeywordExpansionInput,
} from "../keyword-universe/universe.js";

import {
  rankOpportunities,
  scoreOpportunity,
  type OpportunitySignals,
} from "../opportunity/score.js";

import type {
  KeywordRecord,
  Opportunity,
  SearchIntent,
} from "../shared.js";

import type {
  ResearchSeed,
} from "../research-planner/self-owned-seed-resolver.js";

import {
  slugify,
} from "../shared.js";

import type {
  AuditActor,
} from "../../foundation/types.js";


/*
 * ============================================================
 * NEXMOLD V8 ARTICLE PRODUCER
 * ============================================================
 *
 * Producer is the repeatable upstream orchestration boundary
 * between V8 topic intelligence and Article Runtime.
 *
 * Contract:
 *
 *   Topic Inputs
 *       ↓
 *   Keyword Universe
 *       ↓
 *   Opportunity Scoring
 *       ↓
 *   Deterministic Ranking
 *       ↓
 *   Existing Topic Exclusion
 *       ↓
 *   Next Topic Selection
 *       ↓
 *   ArticleRuntimeInput
 *       ↓
 *   Article Runtime
 *       ↓
 *   Evidence → Claim → Knowledge → Decision → Content
 *
 * Producer MUST NOT:
 *
 *   - manufacture Evidence
 *   - manufacture Claims
 *   - manufacture Knowledge
 *   - manufacture Decisions
 *   - bypass Article Runtime
 *   - infer URLs from keywords
 *   - silently reuse a produced topic
 *
 * Producer MAY:
 *
 *   - expand a controlled keyword universe
 *   - score opportunities
 *   - rank opportunities
 *   - exclude already-produced topic identities
 *   - select the next eligible topic
 *   - construct deterministic Runtime inputs
 *   - provide explicit V8-owned Research Seeds
 *
 * The actual factual truth boundary remains Article Runtime.
 */


/*
 * ============================================================
 * PUBLIC TYPES
 * ============================================================
 */

export interface ArticleProducerTopicInput {
  readonly seeds: readonly string[];
  readonly modifiers?: readonly string[];
  readonly questions?: readonly string[];
  readonly related?: readonly string[];

  readonly market?: string;
  readonly language?: string;

  /*
   * Opportunity signals are supplied by the intelligence boundary.
   *
   * Producer never invents demand or authority measurements.
   */
  readonly signals: OpportunitySignals;

  /*
   * Explicit Internet acquisition entry points.
   *
   * A URL MUST be supplied explicitly.
   * Producer never constructs a URL from a keyword.
   */
  readonly researchSeeds: readonly ResearchSeed[];
}

export interface ArticleProducerTopic {
  readonly keyword: KeywordRecord;
  readonly opportunity: Opportunity;
  readonly researchSeeds: readonly ResearchSeed[];
  readonly slug: string;
}

export interface ArticleProducerExistingArticle {
  readonly slug: string;
  readonly primaryKeyword?: string;
}

export interface ArticleProducerInput {
  readonly cycleId: string;

  readonly topics: readonly ArticleProducerTopicInput[];

  readonly existingArticles?: readonly ArticleProducerExistingArticle[];

  readonly producedTopics?: readonly string[];

  readonly pageFetcher?: PageFetcher;
  readonly store?: FoundationStore;
  readonly actor?: AuditActor;

  readonly scope: ScopeInput;
  readonly context: ContextInput;
  readonly problemFactory?: (
    topic: ArticleProducerTopic,
  ) => ProblemInput;

  readonly titleFactory?: (
    topic: ArticleProducerTopic,
  ) => string;

  readonly minimumScore?: number;
  readonly maximumCandidates?: number;

  readonly acquisition?: {
    readonly maxQueries?: number;
    readonly maxCandidates?: number;
    readonly maxPages?: number;
    readonly maxDepth?: number;
    readonly sameHostOnly?: boolean;
    readonly signal?: AbortSignal;
  };
}

export interface ArticleProducerSelection {
  readonly cycleId: string;

  readonly ranked: readonly ArticleProducerTopic[];

  readonly excluded: readonly {
    readonly topic: ArticleProducerTopic;
    readonly reason: "ALREADY_PRODUCED";
  }[];

  readonly blocked: readonly {
    readonly topic: ArticleProducerTopic;
    readonly reason:
      | "BELOW_SCORE_THRESHOLD"
      | "NO_RESEARCH_SEEDS";
  }[];

  readonly selected: ArticleProducerTopic | null;
}

export interface ArticleProducerResult {
  readonly selection: ArticleProducerSelection;
  readonly runtime: ArticleRuntimeResult | null;
}


/*
 * ============================================================
 * DETERMINISTIC NORMALIZATION
 * ============================================================
 */

function normalizeTopicIdentity(
  value: string,
): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function topicSlug(
  keyword: string,
): string {
  return slugify(keyword);
}


/*
 * ============================================================
 * TITLE / PROBLEM DEFAULTS
 * ============================================================
 */

function defaultTitle(
  topic: ArticleProducerTopic,
): string {
  const keyword =
    topic.keyword.keyword
      .trim();

  if (!keyword) {
    throw new Error(
      "V8_ARTICLE_PRODUCER_EMPTY_TOPIC_TITLE",
    );
  }

  return `${keyword}: engineering guide`;
}

function defaultProblem(
  topic: ArticleProducerTopic,
): ProblemInput {
  const keyword =
    topic.keyword.keyword
      .trim();

  return {
    question:
      `What evidence-backed engineering information can V8 state about ${keyword}?`,

    constraints: [
      "VERIFIED evidence only",
      "No unsupported factual injection",
      "All article content must remain traceable to acquired Internet Evidence",
      "Unresolved contradictions must not be silently merged",
    ],
  };
}


/*
 * ============================================================
 * TOPIC → OPPORTUNITY
 * ============================================================
 */

function expandTopic(
  input: ArticleProducerTopicInput,
): readonly KeywordRecord[] {
  const universeInput:
    KeywordExpansionInput = {
    seeds:
      input.seeds,

    ...(input.modifiers
      ? {
          modifiers:
            input.modifiers,
        }
      : {}),

    ...(input.questions
      ? {
          questions:
            input.questions,
        }
      : {}),

    ...(input.related
      ? {
          related:
            input.related,
        }
      : {}),

    ...(input.market
      ? {
          market:
            input.market,
        }
      : {}),

    ...(input.language
      ? {
          language:
            input.language,
        }
      : {}),
  };

  return buildKeywordUniverse(
    universeInput,
  );
}

function createTopicsFromInput(
  input: ArticleProducerTopicInput,
): readonly ArticleProducerTopic[] {
  const keywords =
    expandTopic(input);

  if (
    keywords.length ===
    0
  ) {
    throw new Error(
      "V8_ARTICLE_PRODUCER_EMPTY_KEYWORD_UNIVERSE",
    );
  }

  /*
   * The first keyword is the controlled seed.
   *
   * Signals belong to the topic intelligence input rather
   * than being recalculated independently for every expansion.
   *
   * This preserves deterministic producer behavior until the
   * future V8 Internet Intelligence layer supplies per-keyword
   * demand/relevance signals.
   */
  return Object.freeze(
    keywords.map(
      (
        keyword,
      ) => {
        const opportunity =
          scoreOpportunity(
            keyword,
            input.signals,
          );

        return Object.freeze({
          keyword,
          opportunity,
          researchSeeds:
            Object.freeze([
              ...input.researchSeeds,
            ]),
          slug:
            topicSlug(
              keyword.keyword,
            ),
        });
      },
    ),
  );
}


/*
 * ============================================================
 * EXISTING TOPIC IDENTITY
 * ============================================================
 *
 * A produced article is identified by semantic topic identity,
 * not merely by a URL slug and not merely by one keyword string.
 *
 * The identity set contains:
 *
 *   1. normalized primary keyword
 *   2. normalized generated slug
 *   3. explicitly persisted producer topic identities
 *
 * This prevents:
 *
 *   "wall thickness"
 *   "wall-thickness"
 *   "plastic injection molding wall thickness"
 *
 * from being treated as unrelated merely because their string
 * representation differs.
 */

function buildProducedIdentitySet(
  existingArticles:
    readonly ArticleProducerExistingArticle[],
  producedTopics:
    readonly string[],
): ReadonlySet<string> {
  const identities =
    new Set<string>();

  for (
    const article of
      existingArticles
  ) {
    const slug =
      normalizeTopicIdentity(
        article.slug,
      );

    if (slug) {
      identities.add(
        slug,
      );
    }

    if (
      article.primaryKeyword
    ) {
      const keyword =
        normalizeTopicIdentity(
          article.primaryKeyword,
        );

      if (keyword) {
        identities.add(
          keyword,
        );

        identities.add(
          normalizeTopicIdentity(
            topicSlug(
              article.primaryKeyword,
            ),
          ),
        );
      }
    }
  }

  for (
    const topic of
      producedTopics
  ) {
    const normalized =
      normalizeTopicIdentity(
        topic,
      );

    if (!normalized) {
      continue;
    }

    identities.add(
      normalized,
    );

    identities.add(
      normalizeTopicIdentity(
        topicSlug(
          topic,
        ),
      ),
    );
  }

  return identities;
}

function isAlreadyProduced(
  topic: ArticleProducerTopic,
  identities: ReadonlySet<string>,
): boolean {
  const keyword =
    normalizeTopicIdentity(
      topic.keyword.keyword,
    );

  const normalized =
    normalizeTopicIdentity(
      topic.keyword.normalized,
    );

  const slug =
    normalizeTopicIdentity(
      topic.slug,
    );

  return (
    identities.has(keyword) ||
    identities.has(normalized) ||
    identities.has(slug)
  );
}


/*
 * ============================================================
 * TOPIC SELECTION
 * ============================================================
 */

function selectNextTopic(
  input: ArticleProducerInput,
): ArticleProducerSelection {
  const allTopics:
    ArticleProducerTopic[] =
    [];

  for (
    const topicInput of
      input.topics
  ) {
    const topics =
      createTopicsFromInput(
        topicInput,
      );

    allTopics.push(
      ...topics,
    );
  }

  const ranked =
    rankOpportunities(
      allTopics.map(
        (topic) =>
          topic.opportunity,
      ),
    );

  const topicByOpportunity =
    new Map<string, ArticleProducerTopic>();

  for (
    const topic of
      allTopics
  ) {
    const key =
      [
        topic.keyword.normalized,
        topic.slug,
      ].join(
        "\u001f",
      );

    topicByOpportunity.set(
      key,
      topic,
    );
  }

  const rankedTopics:
    ArticleProducerTopic[] =
    [];

  for (
    const opportunity of
      ranked
  ) {
    const topic =
      allTopics.find(
        (candidate) =>
          candidate.keyword.normalized ===
            opportunity.keyword.normalized &&
          candidate.opportunity.score ===
            opportunity.score,
      );

    if (
      topic
    ) {
      rankedTopics.push(
        topic,
      );
    }
  }

  const identities =
    buildProducedIdentitySet(
      input.existingArticles ??
        [],
      input.producedTopics ??
        [],
    );

  const excluded:
    {
      topic: ArticleProducerTopic;
      reason: "ALREADY_PRODUCED";
    }[] =
    [];

  const blocked:
    {
      topic: ArticleProducerTopic;
      reason:
        | "BELOW_SCORE_THRESHOLD"
        | "NO_RESEARCH_SEEDS";
    }[] =
    [];

  const minimumScore =
    input.minimumScore ??
    0.65;

  const eligible:
    ArticleProducerTopic[] =
    [];

  for (
    const topic of
      rankedTopics
  ) {
    if (
      isAlreadyProduced(
        topic,
        identities,
      )
    ) {
      excluded.push({
        topic,
        reason:
          "ALREADY_PRODUCED",
      });

      continue;
    }

    if (
      topic.opportunity.score <
      minimumScore
    ) {
      blocked.push({
        topic,
        reason:
          "BELOW_SCORE_THRESHOLD",
      });

      continue;
    }

    if (
      topic.researchSeeds.length ===
      0
    ) {
      blocked.push({
        topic,
        reason:
          "NO_RESEARCH_SEEDS",
      });

      continue;
    }

    eligible.push(
      topic,
    );
  }

  const selected =
    eligible[0] ??
    null;

  return Object.freeze({
    cycleId:
      input.cycleId,

    ranked:
      Object.freeze(
        rankedTopics,
      ),

    excluded:
      Object.freeze(
        excluded,
      ),

    blocked:
      Object.freeze(
        blocked,
      ),

    selected,
  });
}


/*
 * ============================================================
 * PRODUCER EXECUTION
 * ============================================================
 */

export async function runArticleProducer(
  input: ArticleProducerInput,
): Promise<ArticleProducerResult> {
  if (
    !input.cycleId.trim()
  ) {
    throw new Error(
      "V8_ARTICLE_PRODUCER_CYCLE_ID_REQUIRED",
    );
  }

  if (
    input.topics.length ===
    0
  ) {
    throw new Error(
      "V8_ARTICLE_PRODUCER_NO_TOPICS",
    );
  }

  const selection =
    selectNextTopic(
      input,
    );

  if (
    selection.selected ===
    null
  ) {
    return Object.freeze({
      selection,
      runtime:
        null,
    });
  }

  const selected =
    selection.selected;

  const fetcher =
    input.pageFetcher ??
    new HttpPageFetcher({
      timeoutMs:
        20_000,

      maxBytes:
        5_000_000,
    });

  const store =
    input.store ??
    new InMemoryFoundationStore();

  const actor =
    input.actor ??
    Object.freeze({
      id:
        "v8:article-producer",

      role:
        "SYSTEM" as const,
    });

  const title =
    input.titleFactory
      ? input.titleFactory(
          selected,
        )
      : defaultTitle(
          selected,
        );

  const problem =
    input.problemFactory
      ? input.problemFactory(
          selected,
        )
      : defaultProblem(
          selected,
        );

  const runtime =
    await runV8ArticleRuntime({
      opportunity:
        selected.opportunity,

      searchProvider:
        undefined,

      pageFetcher:
        fetcher,

      store,

      actor,

      acquisition:
        {
          actorId:
            actor.id,

          researchSeeds:
            selected.researchSeeds,

          ...(input.acquisition
            ? {
                ...input.acquisition,
              }
            : {}),
        },

      scope:
        input.scope,

      context:
        input.context,

      problem,

      title,
    });

  return Object.freeze({
    selection,
    runtime,
  });
}


/*
 * ============================================================
 * PURE SELECTION EXPORT
 * ============================================================
 *
 * This function intentionally performs no Internet access.
 *
 * It exists so tests and future gates can validate:
 *
 *   keyword → opportunity → ranking → exclusion
 *
 * independently from:
 *
 *   Internet → Evidence → Claim → Knowledge → Decision → Content
 */

export function selectNextArticleTopic(
  input: ArticleProducerInput,
): ArticleProducerSelection {
  return selectNextTopic(
    input,
  );
}


/*
 * ============================================================
 * SINGLE-TOPIC CONVENIENCE FACTORY
 * ============================================================
 *
 * This keeps callers from constructing KeywordRecord or
 * Opportunity objects manually.
 *
 * All semantic information still enters through the existing
 * V8 Keyword Universe and Opportunity scorer.
 */

export function createArticleProducerTopic(
  input: ArticleProducerTopicInput,
): ArticleProducerTopic {
  const topics =
    createTopicsFromInput(
      input,
    );

  if (
    topics.length ===
    0
  ) {
    throw new Error(
      "V8_ARTICLE_PRODUCER_TOPIC_CREATION_FAILED",
    );
  }

  /*
   * Deterministically choose the highest-scoring keyword
   * within this controlled topic input.
   */
  const ranked =
    rankOpportunities(
      topics.map(
        (topic) =>
          topic.opportunity,
      ),
    );

  const winner =
    ranked[0];

  if (
    !winner
  ) {
    throw new Error(
      "V8_ARTICLE_PRODUCER_TOPIC_NO_WINNER",
    );
  }

  const topic =
    topics.find(
      (candidate) =>
        candidate.keyword.normalized ===
        winner.keyword.normalized,
    );

  if (
    !topic
  ) {
    throw new Error(
      "V8_ARTICLE_PRODUCER_TOPIC_WINNER_MAPPING_FAILED",
    );
  }

  return topic;
}


/*
 * ============================================================
 * PRODUCER INVARIANTS
 * ============================================================
 */

export function assertArticleProducerSelection(
  selection: ArticleProducerSelection,
): void {
  if (
    selection.selected ===
    null
  ) {
    return;
  }

  const selected =
    selection.selected;

  if (
    !selection.ranked.some(
      (topic) =>
        topic.keyword.normalized ===
        selected.keyword.normalized,
    )
  ) {
    throw new Error(
      "V8_ARTICLE_PRODUCER_SELECTED_TOPIC_NOT_RANKED",
    );
  }

  if (
    selection.excluded.some(
      (item) =>
        item.topic.keyword.normalized ===
        selected.keyword.normalized,
    )
  ) {
    throw new Error(
      "V8_ARTICLE_PRODUCER_SELECTED_TOPIC_ALREADY_EXCLUDED",
    );
  }

  if (
    selection.blocked.some(
      (item) =>
        item.topic.keyword.normalized ===
        selected.keyword.normalized,
    )
  ) {
    throw new Error(
      "V8_ARTICLE_PRODUCER_SELECTED_TOPIC_BLOCKED",
    );
  }

  if (
    selected.researchSeeds.length ===
    0
  ) {
    throw new Error(
      "V8_ARTICLE_PRODUCER_SELECTED_TOPIC_HAS_NO_RESEARCH_SEEDS",
    );
  }
}
