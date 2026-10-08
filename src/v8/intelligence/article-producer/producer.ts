import type {
  Opportunity,
  KeywordRecord,
} from "../shared.js";

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
  ArticleRuntimeInput,
  ArticleRuntimeResult,
} from "../../runtime/article-runtime.js";

import {
  runV8ArticleRuntime,
} from "../../runtime/article-runtime.js";

import type {
  FoundationStore,
} from "../../foundation/types.js";

import type {
  PageFetcher,
  SearchProvider,
} from "../../acquisition/types.js";

import type {
  AuditActor,
} from "../../foundation/types.js";

import type {
  ResearchSeed,
} from "../research-planner/self-owned-seed-resolver.js";


/*
 * ============================================================
 * V8 ARTICLE PRODUCER
 * ============================================================
 *
 * Producer boundary:
 *
 *   Keyword Universe
 *          ↓
 *   Opportunity
 *          ↓
 *   Ranking
 *          ↓
 *   Published Topic Exclusion
 *          ↓
 *   Next Topic
 *          ↓
 *   ArticleRuntimeInput
 *          ↓
 *   runV8ArticleRuntime()
 *
 * This module intentionally does NOT:
 *
 *   - replace Article Runtime
 *   - modify Final Gate
 *   - modify Next Gate
 *   - modify Release / LKG
 *   - infer Internet URLs from keywords
 *   - fabricate demand signals
 *   - treat acquisition as evidence
 *
 * Internet acquisition remains owned by the existing
 * research-planner / self-owned-crawl boundary.
 */


/*
 * ============================================================
 * PUBLIC TYPES
 * ============================================================
 */

export interface ArticleProducerOpportunityInput {
  readonly keyword: KeywordRecord;
  readonly signals: OpportunitySignals;
}

export interface ArticleProducerInput {
  readonly keywordExpansion: KeywordExpansionInput;

  /*
   * Opportunity signals MUST come from an upstream intelligence
   * boundary. The Producer never invents demand, competition,
   * authority gap, relevance, or conversion values.
   */
  readonly opportunitySignals:
    readonly ArticleProducerOpportunityInput[];

  /*
   * These values identify topics that have already been produced.
   *
   * They are semantic topic identities, NOT publication slugs.
   *
   * A slug is derived only after a topic has been selected.
   */
  readonly publishedTopics?: readonly string[];

  /*
   * Article Runtime dependencies.
   */
  readonly pageFetcher: PageFetcher;
  readonly searchProvider?: SearchProvider;
  readonly store?: FoundationStore;
  readonly actor?: AuditActor;

  /*
   * Self-owned research seeds are supplied explicitly.
   *
   * A Producer may not infer URLs from a keyword.
   */
  readonly researchSeeds:
    readonly ResearchSeed[];

  readonly scope: ArticleRuntimeInput["scope"];
  readonly context: ArticleRuntimeInput["context"];

  /*
   * Allows the caller to provide deterministic problem constraints
   * without coupling the Producer to a particular article.
   */
  readonly problemConstraints?:
    readonly string[];

  /*
   * Optional explicit article title.
   *
   * When omitted, the title is generated deterministically from
   * the selected opportunity keyword.
   */
  readonly title?: string;

  readonly acquisition?:
    ArticleRuntimeInput["acquisition"];
}


export interface ArticleProducerSelection {
  readonly opportunity: Opportunity;
  readonly rank: number;
  readonly topicKey: string;
  readonly title: string;
}


export interface ArticleProducerResult {
  readonly selection: ArticleProducerSelection;
  readonly runtimeInput: ArticleRuntimeInput;
  readonly runtime: ArticleRuntimeResult;
}


export interface ArticleProducerPlan {
  readonly keywords: readonly KeywordRecord[];
  readonly opportunities: readonly Opportunity[];
  readonly ranked: readonly Opportunity[];
  readonly eligible: readonly Opportunity[];
  readonly selection: ArticleProducerSelection;
}


/*
 * ============================================================
 * NORMALIZATION
 * ============================================================
 */

function normalizeTopicKey(
  value: string,
): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}


function requireNonEmpty(
  value: string,
  label: string,
): string {
  const normalized =
    value.trim();

  if (
    normalized.length === 0
  ) {
    throw new Error(
      `V8_ARTICLE_PRODUCER_${label.toUpperCase()}_EMPTY`,
    );
  }

  return normalized;
}


/*
 * ============================================================
 * TOPIC IDENTITY
 * ============================================================
 *
 * Topic identity is deliberately based on normalized semantic
 * keyword text.
 *
 * It is NOT:
 *
 *   - article slug
 *   - URL
 *   - Content fingerprint
 *   - Decision ID
 *
 * Those are downstream identities.
 */

export function topicKey(
  opportunity: Opportunity,
): string {
  return normalizeTopicKey(
    opportunity.keyword.normalized ||
      opportunity.keyword.keyword,
  );
}


export function isPublishedTopic(
  opportunity: Opportunity,
  publishedTopics: readonly string[],
): boolean {
  const key =
    topicKey(
      opportunity,
    );

  return publishedTopics.some(
    (published) =>
      normalizeTopicKey(
        published,
      ) === key,
  );
}


/*
 * ============================================================
 * OPPORTUNITY CONSTRUCTION
 * ============================================================
 */

export function buildOpportunities(
  input: ArticleProducerOpportunityInput[],
): readonly Opportunity[] {
  const opportunities =
    input.map(
      (item) =>
        scoreOpportunity(
          item.keyword,
          item.signals,
        ),
    );

  return Object.freeze(
    opportunities,
  );
}


/*
 * ============================================================
 * NEXT TOPIC SELECTION
 * ============================================================
 */

export function selectNextArticleOpportunity(
  opportunities: readonly Opportunity[],
  publishedTopics: readonly string[] = [],
): ArticleProducerSelection {
  const ranked =
    rankOpportunities(
      opportunities,
    );

  const eligible =
    ranked.filter(
      (opportunity) =>
        !isPublishedTopic(
          opportunity,
          publishedTopics,
        ),
    );

  if (
    eligible.length === 0
  ) {
    throw new Error(
      "V8_ARTICLE_PRODUCER_NO_ELIGIBLE_TOPIC",
    );
  }

  const selected =
    eligible[0];

  if (
    selected.score < 0.65
  ) {
    throw new Error(
      "V8_ARTICLE_PRODUCER_TOP_TOPIC_BELOW_PUBLICATION_THRESHOLD",
    );
  }

  const rank =
    ranked.findIndex(
      (candidate) =>
        candidate ===
        selected,
    ) + 1;

  const keyword =
    requireNonEmpty(
      selected.keyword.keyword,
      "KEYWORD",
    );

  return Object.freeze({
    opportunity:
      selected,

    rank,

    topicKey:
      topicKey(
        selected,
      ),

    title:
      `${keyword}: engineering guide`,
  });
}


/*
 * ============================================================
 * PRODUCER PLAN
 * ============================================================
 */

export function planNextArticle(
  input: ArticleProducerInput,
): ArticleProducerPlan {
  const keywords =
    buildKeywordUniverse(
      input.keywordExpansion,
    );

  if (
    keywords.length === 0
  ) {
    throw new Error(
      "V8_ARTICLE_PRODUCER_EMPTY_KEYWORD_UNIVERSE",
    );
  }

  const keywordByTopic =
    new Map<string, KeywordRecord>();

  for (
    const keyword of
      keywords
  ) {
    keywordByTopic.set(
      normalizeTopicKey(
        keyword.normalized ||
          keyword.keyword,
      ),
      keyword,
    );
  }

  const opportunityInputs:
    ArticleProducerOpportunityInput[] =
    [];

  for (
    const item of
      input.opportunitySignals
  ) {
    const key =
      normalizeTopicKey(
        item.keyword.normalized ||
          item.keyword.keyword,
      );

    const universeKeyword =
      keywordByTopic.get(
        key,
      );

    if (
      universeKeyword ===
      undefined
    ) {
      throw new Error(
        [
          "V8_ARTICLE_PRODUCER_OPPORTUNITY_OUTSIDE_KEYWORD_UNIVERSE",
          key,
        ].join(":"),
      );
    }

    opportunityInputs.push({
      keyword:
        universeKeyword,

      signals:
        item.signals,
    });
  }

  if (
    opportunityInputs.length ===
    0
  ) {
    throw new Error(
      "V8_ARTICLE_PRODUCER_NO_OPPORTUNITY_SIGNALS",
    );
  }

  const opportunities =
    buildOpportunities(
      opportunityInputs,
    );

  const ranked =
    rankOpportunities(
      opportunities,
    );

  const eligible =
    ranked.filter(
      (opportunity) =>
        !isPublishedTopic(
          opportunity,
          input.publishedTopics ??
            [],
        ),
    );

  const selection =
    selectNextArticleOpportunity(
      opportunities,
      input.publishedTopics ??
        [],
    );

  return Object.freeze({
    keywords,

    opportunities,

    ranked,

    eligible,

    selection,
  });
}


/*
 * ============================================================
 * RUNTIME INPUT CONSTRUCTION
 * ============================================================
 */

export function createArticleRuntimeInput(
  input: ArticleProducerInput,
  selection: ArticleProducerSelection,
): ArticleRuntimeInput {
  const keyword =
    requireNonEmpty(
      selection.opportunity.keyword.keyword,
      "KEYWORD",
    );

  const title =
    input.title?.trim() ||
    selection.title;

  if (
    title.length ===
    0
  ) {
    throw new Error(
      "V8_ARTICLE_PRODUCER_TITLE_EMPTY",
    );
  }

  const question =
    `How should ${keyword} be evaluated and applied in engineering practice?`;

  return {
    opportunity:
      selection.opportunity,

    searchProvider:
      input.searchProvider,

    pageFetcher:
      input.pageFetcher,

    store:
      input.store,

    actor:
      input.actor,

    acquisition:
      input.acquisition ??
      {
        actorId:
          input.actor?.id ??
          "v8:article-producer",
        researchSeeds:
          input.researchSeeds,
      },

    scope:
      input.scope,

    context:
      input.context,

    problem: {
      question,

      constraints:
        input.problemConstraints ??
        [
          "Use only verified evidence.",
          "Do not fabricate unsupported engineering values.",
          "Fail closed when authoritative evidence is insufficient.",
        ],
    },

    title,
  };
}


/*
 * ============================================================
 * FULL PRODUCTION EXECUTION
 * ============================================================
 */

export async function produceNextArticle(
  input: ArticleProducerInput,
): Promise<ArticleProducerResult> {
  const plan =
    planNextArticle(
      input,
    );

  const runtimeInput =
    createArticleRuntimeInput(
      input,
      plan.selection,
    );

  const runtime =
    await runV8ArticleRuntime(
      runtimeInput,
    );

  return Object.freeze({
    selection:
      plan.selection,

    runtimeInput,

    runtime,
  });
}