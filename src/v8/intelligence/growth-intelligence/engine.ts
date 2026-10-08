import {
  clamp,
  normalizeText,
  slugify,
} from "../shared.js";
import type {
  KeywordRecord,
  Opportunity,
} from "../shared.js";
import {
  createMarketSignal,
  createDerivedMarketSignals,
  filterSignalsForIndustry,
  filterSignalsForMarket,
} from "../market/signals.js";
import {
  discoverNiches,
  rankDiscoveredNiches,
  assertNicheDiscoveryResult,
} from "../niche/discovery.js";
import {
  assertNicheOpportunityInvariant,
} from "../niche/scoring.js";
import type {
  ContentOpportunity,
  GrowthFeedback,
  GrowthIntelligenceInput,
  GrowthIntelligenceInvariantReport,
  GrowthIntelligenceResult,
  GrowthMetric,
  GrowthSignal,
  IndustryProfile,
  MarketProfile,
  Niche,
  NicheOpportunity,
  TopicCandidate,
} from "./types.js";

export interface GrowthIntelligenceEngineOptions {
  readonly minimumNicheScore?: number;
  readonly minimumEvidenceConfidence?: number;
  readonly maximumNiches?: number;
  readonly maximumTopicsPerNiche?: number;
  readonly now?: string;
}

export interface GrowthIntelligenceEngineInput {
  readonly cycleId: string;
  readonly industry: IndustryProfile;
  readonly markets: readonly MarketProfile[];
  readonly keywords: readonly KeywordRecord[];
  readonly opportunities?: readonly Opportunity[];
  readonly signals?: readonly GrowthSignal[];
  readonly existingNiches?: readonly Niche[];
  readonly existingTopics?: readonly string[];
  readonly publishedSlugs?: readonly string[];
  readonly feedback?: readonly GrowthFeedback[];
}

const DEFAULT_MINIMUM_NICHE_SCORE = 0.65;
const DEFAULT_MINIMUM_EVIDENCE_CONFIDENCE = 0.6;
const DEFAULT_MAXIMUM_NICHES = 25;
const DEFAULT_MAXIMUM_TOPICS_PER_NICHE = 20;
const DEFAULT_TIMESTAMP =
  "1970-01-01T00:00:00.000Z";

function stableHash(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;

  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;

    first ^= code;
    first = Math.imul(
      first,
      0x01000193,
    );

    second ^= code;
    second = Math.imul(
      second,
      0x01000193,
    );
  }

  return `${(first >>> 0)
    .toString(16)
    .padStart(8, "0")}${(second >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}

function normalizeTimestamp(
  value?: string,
): string {
  if (!value) {
    return DEFAULT_TIMESTAMP;
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return DEFAULT_TIMESTAMP;
  }

  return new Date(parsed).toISOString();
}

function normalizeCycleId(
  cycleId: string,
): string {
  const normalized =
    normalizeText(cycleId);

  if (!normalized) {
    throw new Error(
      "V8 growth intelligence requires a non-empty cycleId",
    );
  }

  return normalized;
}

function normalizeNumber(
  value: number | undefined,
): number {
  if (!Number.isFinite(value ?? 0)) {
    return 0;
  }

  return clamp(value ?? 0);
}

function uniqueSorted(
  values: readonly string[],
): string[] {
  return [
    ...new Set(
      values
        .map(normalizeText)
        .filter(Boolean),
    ),
  ].sort();
}

function normalizeIndustry(
  industry: IndustryProfile,
): IndustryProfile {
  const industryId =
    normalizeText(
      industry.industryId,
    );

  const name =
    normalizeText(industry.name);

  if (!industryId) {
    throw new Error(
      "V8 growth intelligence requires industry.industryId",
    );
  }

  if (!name) {
    throw new Error(
      "V8 growth intelligence requires industry.name",
    );
  }

  return {
    ...industry,
    industryId,
    name,
    description:
      industry.description
        ? normalizeText(
            industry.description,
          )
        : undefined,
    capabilities: uniqueSorted(
      industry.capabilities,
    ),
    products: uniqueSorted(
      industry.products,
    ),
    services: uniqueSorted(
      industry.services,
    ),
    targetMarkets: uniqueSorted(
      industry.targetMarkets,
    ),
    targetAudiences: uniqueSorted(
      industry.targetAudiences,
    ),
    languages: uniqueSorted(
      industry.languages,
    ),
    markets: uniqueSorted(
      industry.markets,
    ),
    exclusions: uniqueSorted(
      industry.exclusions,
    ),
    version:
      normalizeText(
        industry.version,
      ) || "1",
  };
}

function normalizeMarkets(
  markets: readonly MarketProfile[],
): MarketProfile[] {
  const seen = new Set<string>();
  const output: MarketProfile[] = [];

  for (const market of markets) {
    const marketId =
      normalizeText(
        market.marketId,
      );

    if (!marketId) {
      continue;
    }

    if (seen.has(marketId)) {
      continue;
    }

    seen.add(marketId);

    output.push({
      ...market,
      marketId,
      industryId:
        normalizeText(
          market.industryId,
        ),
      name:
        normalizeText(
          market.name,
        ),
      region:
        market.region
          ? normalizeText(
              market.region,
            )
          : undefined,
      country:
        market.country
          ? normalizeText(
              market.country,
            )
          : undefined,
      language:
        market.language
          ? normalizeText(
              market.language,
            )
          : undefined,
      audienceSegments:
        uniqueSorted(
          market.audienceSegments,
        ),
      capabilityFit:
        normalizeNumber(
          market.capabilityFit,
        ),
      commercialFit:
        normalizeNumber(
          market.commercialFit,
        ),
    });
  }

  return output.sort(
    (left, right) =>
      left.marketId.localeCompare(
        right.marketId,
      ),
  );
}

function normalizeKeywords(
  keywords: readonly KeywordRecord[],
): KeywordRecord[] {
  const seen =
    new Map<
      string,
      KeywordRecord
    >();

  for (const keyword of keywords) {
    const value =
      normalizeText(
        keyword.keyword,
      );

    const normalized =
      normalizeText(
        keyword.normalized ||
          keyword.keyword,
      );

    if (!value || !normalized) {
      continue;
    }

    const normalizedKeyword: KeywordRecord =
      {
        ...keyword,
        keyword: value,
        normalized,
        terms: uniqueSorted(
          keyword.terms,
        ),
        language:
          keyword.language
            ? normalizeText(
                keyword.language,
              )
            : undefined,
        market:
          keyword.market
            ? normalizeText(
                keyword.market,
              )
            : undefined,
        parent:
          keyword.parent
            ? normalizeText(
                keyword.parent,
              )
            : undefined,
      };

    const existing =
      seen.get(normalized);

    if (!existing) {
      seen.set(
        normalized,
        normalizedKeyword,
      );
      continue;
    }

    const merged: KeywordRecord =
      {
        ...existing,
        terms: uniqueSorted([
          ...existing.terms,
          ...normalizedKeyword.terms,
        ]),
      };

    if (
      normalizedKeyword.source ===
        "DISCOVERY" &&
      existing.source !==
        "DISCOVERY"
    ) {
      seen.set(
        normalized,
        {
          ...normalizedKeyword,
          keyword:
            existing.keyword,
          normalized,
          terms:
            merged.terms,
        },
      );
      continue;
    }

    seen.set(
      normalized,
      merged,
    );
  }

  return [
    ...seen.values(),
  ].sort(
    (left, right) =>
      left.normalized.localeCompare(
        right.normalized,
      ) ||
      left.source.localeCompare(
        right.source,
      ),
  );
}

function normalizeOpportunities(
  opportunities: readonly Opportunity[],
): Opportunity[] {
  const seen =
    new Map<
      string,
      Opportunity
    >();

  for (const opportunity of opportunities) {
    const normalized =
      normalizeText(
        opportunity.keyword
          .normalized ||
          opportunity.keyword
            .keyword,
      );

    if (!normalized) {
      continue;
    }

    const existing =
      seen.get(normalized);

    if (
      !existing ||
      opportunity.score >
        existing.score
    ) {
      seen.set(
        normalized,
        opportunity,
      );
    }
  }

  return [
    ...seen.values(),
  ].sort(
    (left, right) =>
      right.score -
        left.score ||
      left.keyword.normalized.localeCompare(
        right.keyword.normalized,
      ),
  );
}

function normalizeSignals(
  signals: readonly GrowthSignal[],
  timestamp: string,
): GrowthSignal[] {
  const seen =
    new Map<
      string,
      GrowthSignal
    >();

  for (const signal of signals) {
    const subject =
      normalizeText(
        signal.subject,
      );

    if (!subject) {
      continue;
    }

    const observedAt =
      normalizeTimestamp(
        signal.observedAt ||
          timestamp,
      );

    const normalized =
      createMarketSignal({
        signalId:
          normalizeText(
            signal.signalId,
          ) || undefined,
        type: signal.type,
        source:
          normalizeText(
            signal.source,
          ) || "V8",
        observedAt,
        subject,
        marketId:
          signal.marketId
            ? normalizeText(
                signal.marketId,
              )
            : undefined,
        industryId:
          signal.industryId
            ? normalizeText(
                signal.industryId,
              )
            : undefined,
        value:
          normalizeNumber(
            signal.value,
          ),
        confidence:
          normalizeNumber(
            signal.confidence,
          ),
        evidenceRefs:
          signal.evidenceRefs,
        metadata:
          signal.metadata,
      });

    const existing =
      seen.get(
        normalized.signalId,
      );

    if (
      !existing ||
      normalized.confidence >
        existing.confidence
    ) {
      seen.set(
        normalized.signalId,
        normalized,
      );
    }
  }

  return [
    ...seen.values(),
  ].sort(
    (left, right) =>
      left.signalId.localeCompare(
        right.signalId,
      ),
  );
}

function normalizeFeedback(
  feedback: readonly GrowthFeedback[],
): GrowthFeedback[] {
  return feedback
    .filter(
      (item) =>
        Boolean(
          normalizeText(
            item.feedbackId,
          ),
        ),
    )
    .map(
      (item): GrowthFeedback => ({
        ...item,
        feedbackId:
          normalizeText(
            item.feedbackId,
          ),
        subjectId:
          normalizeText(
            item.subjectId,
          ),
        scoreDelta:
          Number.isFinite(
            item.scoreDelta,
          )
            ? item.scoreDelta
            : 0,
        observedAt:
          normalizeTimestamp(
            item.observedAt,
          ),
      }),
    )
    .sort(
      (left, right) =>
        left.feedbackId.localeCompare(
          right.feedbackId,
        ),
    );
}

function metricToSignalType(
  metric: GrowthMetric,
): GrowthSignal["type"] | undefined {
  switch (metric.type) {
    case "IMPRESSIONS":
      return "SEARCH_DEMAND";

    case "CLICKS":
      return "TRAFFIC";

    case "CTR":
      return "TRAFFIC";

    case "RANK":
      return "SEARCH_GROWTH";

    case "SESSIONS":
      return "TRAFFIC";

    case "ENGAGEMENT":
      return "ENGAGEMENT";

    case "INQUIRIES":
      return "INQUIRY";

    case "QUALIFIED_LEADS":
      return "QUALIFIED_LEAD";

    case "CONVERSIONS":
      return "CONVERSION";

    case "REVENUE":
      return "CONVERSION";

    default:
      return undefined;
  }
}

function metricToNormalizedValue(
  metric: GrowthMetric,
): number {
  const value = Math.abs(
    Number.isFinite(
      metric.value,
    )
      ? metric.value
      : 0,
  );

  switch (metric.type) {
    case "CTR":
      return clamp(value);

    case "RANK":
      return clamp(
        1 /
          Math.max(
            value,
            1,
          ),
      );

    case "IMPRESSIONS":
    case "CLICKS":
    case "SESSIONS":
    case "ENGAGEMENT":
    case "INQUIRIES":
    case "QUALIFIED_LEADS":
    case "CONVERSIONS":
    case "REVENUE":
      return clamp(
        value /
          (value + 100),
      );

    default:
      return 0;
  }
}

function createFeedbackSignals(
  feedback: readonly GrowthFeedback[],
): GrowthSignal[] {
  const output: GrowthSignal[] =
    [];

  for (const item of feedback) {
    for (const metric of item.metrics) {
      const type =
        metricToSignalType(
          metric,
        );

      if (!type) {
        continue;
      }

      const observedAt =
        normalizeTimestamp(
          metric.observedAt,
        );

      const signalId =
        `feedback-signal:${stableHash(
          [
            item.feedbackId,
            metric.metricId,
            metric.subjectId,
            metric.value,
            observedAt,
          ].join("::"),
        )}`;

      output.push(
        createMarketSignal({
          signalId,
          type,
          source:
            normalizeText(
              metric.source,
            ) || "V8_FEEDBACK",
          observedAt,
          subject:
            metric.subjectId,
          value:
            metricToNormalizedValue(
              metric,
            ),
          confidence:
            normalizeNumber(
              metric.confidence,
            ),
          evidenceRefs: [],
          metadata: {
            metricId:
              metric.metricId,
            feedbackId:
              item.feedbackId,
            rawValue:
              Number.isFinite(
                metric.value,
              )
                ? metric.value
                : 0,
          },
        }),
      );
    }
  }

  return output.sort(
    (left, right) =>
      left.signalId.localeCompare(
        right.signalId,
      ),
  );
}

function mergeSignals(
  ...sets: readonly (
    | readonly GrowthSignal[]
  )[]
): GrowthSignal[] {
  const seen =
    new Map<
      string,
      GrowthSignal
    >();

  for (const set of sets) {
    for (const signal of set) {
      const existing =
        seen.get(
          signal.signalId,
        );

      if (
        !existing ||
        signal.confidence >
          existing.confidence
      ) {
        seen.set(
          signal.signalId,
          signal,
        );
      }
    }
  }

  return [
    ...seen.values(),
  ].sort(
    (left, right) =>
      left.signalId.localeCompare(
        right.signalId,
      ),
  );
}

function filterIndustryAndMarkets(
  signals: readonly GrowthSignal[],
  industry: IndustryProfile,
  markets: readonly MarketProfile[],
): GrowthSignal[] {
  const industrySignals =
    filterSignalsForIndustry(
      signals,
      industry,
    );

  if (markets.length === 0) {
    return [
      ...industrySignals,
    ].sort(
      (left, right) =>
        left.signalId.localeCompare(
          right.signalId,
        ),
    );
  }

  const selected =
    new Map<
      string,
      GrowthSignal
    >();

  for (const market of markets) {
    for (const signal of filterSignalsForMarket(
      industrySignals,
      market,
    )) {
      selected.set(
        signal.signalId,
        signal,
      );
    }
  }

  for (const signal of industrySignals) {
    if (
      signal.industryId &&
      !signal.marketId
    ) {
      selected.set(
        signal.signalId,
        signal,
      );
    }
  }

  return [
    ...selected.values(),
  ].sort(
    (left, right) =>
      left.signalId.localeCompare(
        right.signalId,
      ),
  );
}

function normalizeTopicKey(
  topic: TopicCandidate,
): string {
  return normalizeText(
    topic.normalizedKeyword ||
      topic.keyword,
  );
}

function topicExists(
  topic: TopicCandidate,
  existingTopics: ReadonlySet<string>,
  publishedSlugs: ReadonlySet<string>,
): boolean {
  const normalized =
    normalizeTopicKey(topic);

  const slug =
    slugify(topic.keyword);

  return (
    existingTopics.has(
      normalized,
    ) ||
    existingTopics.has(slug) ||
    publishedSlugs.has(slug)
  );
}

function buildContentOpportunities(
  topics: readonly TopicCandidate[],
  existingTopics: ReadonlySet<string>,
  publishedSlugs: ReadonlySet<string>,
  maximumTopicsPerNiche: number,
): ContentOpportunity[] {
  const grouped =
    new Map<
      string,
      TopicCandidate[]
    >();

  for (const topic of topics) {
    if (
      topicExists(
        topic,
        existingTopics,
        publishedSlugs,
      )
    ) {
      continue;
    }

    const current =
      grouped.get(
        topic.nicheId,
      ) ?? [];

    grouped.set(
      topic.nicheId,
      [
        ...current,
        topic,
      ],
    );
  }

  const output: ContentOpportunity[] =
    [];

  for (const [
    nicheId,
    nicheTopics,
  ] of grouped.entries()) {
    const selected =
      [...nicheTopics]
        .sort(
          (left, right) =>
            right.opportunity
              .score -
              left.opportunity
                .score ||
            right.opportunity
              .conversionPotential -
              left.opportunity
                .conversionPotential ||
            left.normalizedKeyword.localeCompare(
              right.normalizedKeyword,
            ),
        )
        .slice(
          0,
          maximumTopicsPerNiche,
        );

    for (const topic of selected) {
      const commercialBoost =
        topic.commercialIntent ===
        "VERY_HIGH"
          ? 0.15
          : topic.commercialIntent ===
              "HIGH"
            ? 0.1
            : topic.commercialIntent ===
                "MEDIUM"
              ? 0.05
              : 0;

      const score =
        clamp(
          topic.opportunity
            .score +
            commercialBoost,
        );

      const decision =
        score >= 0.65
          ? "PURSUE"
          : score >= 0.52
            ? "WATCH"
            : "REJECT";

      const contentOpportunityId =
        `content-opportunity:${slugify(
          topic.keyword,
        ) || stableHash(
          `${nicheId}::${topic.topicId}`,
        )}`;

      output.push({
        contentOpportunityId,
        nicheId,
        topicId:
          topic.topicId,
        primaryKeyword:
          topic.keyword,
        intent:
          topic.intent,
        commercialIntent:
          topic.commercialIntent,
        score,
        reasons: [
          ...topic.opportunity
            .reasons,
          `niche=${nicheId}`,
          `commercial-intent=${topic.commercialIntent}`,
        ],
        evidenceIds: [
          ...topic.evidenceIds,
        ],
        decision,
      });
    }
  }

  return output.sort(
    (left, right) =>
      right.score -
        left.score ||
      left.primaryKeyword.localeCompare(
        right.primaryKeyword,
      ) ||
      left.contentOpportunityId.localeCompare(
        right.contentOpportunityId,
      ),
  );
}

function commercialIntentFromValue(
  value: number,
): "NONE" | "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH" {
  if (value >= 0.8) {
    return "VERY_HIGH";
  }

  if (value >= 0.6) {
    return "HIGH";
  }

  if (value >= 0.4) {
    return "MEDIUM";
  }

  if (value >= 0.15) {
    return "LOW";
  }

  return "NONE";
}

function buildNiches(
  opportunities: readonly NicheOpportunity[],
  industry: IndustryProfile,
  evidence: readonly {
    readonly evidenceId: string;
    readonly nicheId: string;
  }[],
  timestamp: string,
): GrowthIntelligenceResult["niches"] {
  return opportunities.map(
    (opportunity) => {
      const evidenceIds =
        evidence
          .filter(
            (item) =>
              item.nicheId ===
              opportunity.nicheId,
          )
          .map(
            (item) =>
              item.evidenceId,
          )
          .sort();

      const canonical =
        JSON.stringify({
          industryId:
            industry.industryId,
          nicheId:
            opportunity.nicheId,
          name:
            opportunity.name,
          score:
            opportunity.score,
          decision:
            opportunity.decision,
          evidenceIds,
        });

      return {
        nicheId:
          opportunity.nicheId,
        industryId:
          industry.industryId,
        name:
          opportunity.name,
        normalizedName:
          opportunity.normalizedName,
        description:
          `Validated growth niche for ${industry.name}: ${opportunity.name}.`,
        lifecycle:
          opportunity.lifecycle,
        decision:
          opportunity.decision,
        score:
          opportunity.score,
        opportunityId:
          opportunity.opportunityId,
        evidenceIds,
        keywordIds:
          opportunity.keywordIds,
        marketIds:
          opportunity.marketIds,
        commercialIntent:
          commercialIntentFromValue(
            opportunity.components
              .commercialIntent,
          ),
        createdAt:
          timestamp,
        updatedAt:
          timestamp,
        fingerprint:
          `niche:v8:${stableHash(
            canonical,
          )}`,
      };
    },
  );
}

function deduplicateBlocked(
  blocked: GrowthIntelligenceResult["blocked"],
): GrowthIntelligenceResult["blocked"] {
  const seen =
    new Set<string>();

  const output: GrowthIntelligenceResult["blocked"][number][] =
    [];

  for (const item of blocked) {
    const subject =
      normalizeText(
        item.subject,
      );

    if (!subject) {
      continue;
    }

    const key =
      `${subject}::${item.reason}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    output.push({
      subject,
      reason:
        item.reason,
    });
  }

  return output.sort(
    (left, right) =>
      left.subject.localeCompare(
        right.subject,
      ) ||
      left.reason.localeCompare(
        right.reason,
      ),
  );
}

function createResultFingerprint(
  result: Omit<
    GrowthIntelligenceResult,
    "fingerprint"
  >,
): string {
  const canonical =
    JSON.stringify({
      cycleId:
        result.cycleId,
      industryId:
        result.industry.industryId,
      industryVersion:
        result.industry.version,
      markets:
        result.markets.map(
          (market) =>
            market.marketId,
        ),
      clusters:
        result.clusters.map(
          (cluster) => ({
            clusterId:
              cluster.clusterId,
            keywords:
              cluster.keywords.map(
                (keyword) =>
                  keyword.normalized,
              ),
            signals:
              cluster.signals.map(
                (signal) =>
                  signal.signalId,
              ),
          }),
        ),
      evidence:
        result.evidence.map(
          (evidence) => ({
            evidenceId:
              evidence.evidenceId,
            nicheId:
              evidence.nicheId,
            signalId:
              evidence.signalId,
            sourceUrl:
              evidence.sourceUrl,
            fingerprint:
              evidence.fingerprint,
          }),
        ),
      opportunities:
        result.opportunities.map(
          (opportunity) => ({
            opportunityId:
              opportunity.opportunityId,
            nicheId:
              opportunity.nicheId,
            score:
              opportunity.score,
            decision:
              opportunity.decision,
            lifecycle:
              opportunity.lifecycle,
            evidenceIds:
              opportunity.evidenceIds,
            fingerprint:
              opportunity.fingerprint,
          }),
        ),
      topics:
        result.topics.map(
          (topic) => ({
            topicId:
              topic.topicId,
            nicheId:
              topic.nicheId,
            normalizedKeyword:
              topic.normalizedKeyword,
            evidenceIds:
              topic.evidenceIds,
          }),
        ),
      contentOpportunities:
        result.contentOpportunities.map(
          (item) => ({
            contentOpportunityId:
              item.contentOpportunityId,
            nicheId:
              item.nicheId,
            topicId:
              item.topicId,
            score:
              item.score,
            decision:
              item.decision,
          }),
        ),
      blocked:
        result.blocked,
    });

  return `growth-intelligence:v8:${stableHash(
    canonical,
  )}`;
}

export function runGrowthIntelligence(
  input: GrowthIntelligenceEngineInput,
  options: GrowthIntelligenceEngineOptions = {},
): GrowthIntelligenceResult {
  const cycleId =
    normalizeCycleId(
      input.cycleId,
    );

  const timestamp =
    normalizeTimestamp(
      options.now,
    );

  const industry =
    normalizeIndustry(
      input.industry,
    );

  const markets =
    normalizeMarkets(
      input.markets,
    );

  const keywords =
    normalizeKeywords(
      input.keywords,
    );

  const opportunities =
    normalizeOpportunities(
      input.opportunities ??
        [],
    );

  const baseSignals =
    normalizeSignals(
      input.signals ??
        [],
      timestamp,
    );

  const derivedSignals =
    createDerivedMarketSignals(
      opportunities.map(
        (
          opportunity,
        ) => ({
          keyword:
            opportunity
              .keyword
              .keyword,
          demand:
            opportunity.demand,
          commercialIntent:
            opportunity
              .conversionPotential,
          competition:
            opportunity
              .competition,
          source:
            opportunity
              .keyword
              .source,
          marketId:
            opportunity
              .keyword
              .market,
          industryId:
            industry.industryId,
        }),
      ),
    );

  const feedback =
    normalizeFeedback(
      input.feedback ??
        [],
    );

  const feedbackSignals =
    createFeedbackSignals(
      feedback,
    );

  const mergedSignals =
    mergeSignals(
      baseSignals,
      derivedSignals,
      feedbackSignals,
    );

  const scopedSignals =
    filterIndustryAndMarkets(
      mergedSignals,
      industry,
      markets,
    );

  const minimumNicheScore =
    Number.isFinite(
      options.minimumNicheScore,
    )
      ? clamp(
          options.minimumNicheScore!,
        )
      : DEFAULT_MINIMUM_NICHE_SCORE;

  const minimumEvidenceConfidence =
    Number.isFinite(
      options.minimumEvidenceConfidence,
    )
      ? clamp(
          options.minimumEvidenceConfidence!,
        )
      : DEFAULT_MINIMUM_EVIDENCE_CONFIDENCE;

  const maximumNiches =
    Number.isInteger(
      options.maximumNiches,
    ) &&
    (options.maximumNiches ?? 0) >
      0
      ? options.maximumNiches!
      : DEFAULT_MAXIMUM_NICHES;

  const maximumTopicsPerNiche =
    Number.isInteger(
      options.maximumTopicsPerNiche,
    ) &&
    (options.maximumTopicsPerNiche ?? 0) >
      0
      ? options.maximumTopicsPerNiche!
      : DEFAULT_MAXIMUM_TOPICS_PER_NICHE;

  const discovery =
    discoverNiches({
      industry,
      markets,
      keywords,
      opportunities,
      signals:
        scopedSignals,
      existingNiches:
        input.existingNiches ??
        [],
      minimumScore:
        minimumNicheScore,
      minimumEvidenceConfidence:
        minimumEvidenceConfidence,
      maximumNiches:
        maximumNiches,
      now:
        timestamp,
    });

  assertNicheDiscoveryResult(
    discovery,
  );

  const rankedOpportunities =
    rankDiscoveredNiches(
      discovery.opportunities,
    );

  const existingTopics =
    new Set(
      (
        input.existingTopics ??
        []
      )
        .map(
          normalizeText,
        )
        .filter(Boolean),
    );

  const publishedSlugs =
    new Set(
      (
        input.publishedSlugs ??
        []
      )
        .map(slugify)
        .filter(Boolean),
    );

  const topics =
    discovery.topics
      .filter(
        (topic) =>
          !topicExists(
            topic,
            existingTopics,
            publishedSlugs,
          ),
      )
      .sort(
        (left, right) =>
          right.opportunity
            .score -
            left.opportunity
              .score ||
          right.opportunity
            .conversionPotential -
            left.opportunity
              .conversionPotential ||
          left.normalizedKeyword.localeCompare(
            right.normalizedKeyword,
          ) ||
          left.topicId.localeCompare(
            right.topicId,
          ),
      );

  const contentOpportunities =
    buildContentOpportunities(
      topics,
      existingTopics,
      publishedSlugs,
      maximumTopicsPerNiche,
    );

  const blockedItems: GrowthIntelligenceResult["blocked"][number][] =
    [
      ...discovery.blocked,
    ];

  for (const topic of discovery.topics) {
    if (
      topicExists(
        topic,
        existingTopics,
        publishedSlugs,
      )
    ) {
      blockedItems.push({
        subject:
          topic.keyword,
        reason:
          "ALREADY_EXISTS",
      });
    }
  }

  for (const opportunity of rankedOpportunities) {
    if (
      opportunity.decision ===
        "PURSUE" &&
      opportunity.evidenceIds
        .length === 0
    ) {
      blockedItems.push({
        subject:
          opportunity.name,
        reason:
          "LOW_EVIDENCE_CONFIDENCE",
      });
    }
  }

  const blocked =
    deduplicateBlocked(
      blockedItems,
    );

  const niches =
    buildNiches(
      rankedOpportunities,
      industry,
      discovery.evidence,
      timestamp,
    );

  const resultWithoutFingerprint:
    Omit<
      GrowthIntelligenceResult,
      "fingerprint"
    > = {
    cycleId,
    industry,
    markets,
    clusters:
      discovery.clusters,
    evidence:
      discovery.evidence,
    niches,
    opportunities:
      rankedOpportunities,
    topics,
    contentOpportunities,
    blocked,
  };

  const fingerprint =
    createResultFingerprint(
      resultWithoutFingerprint,
    );

  const result: GrowthIntelligenceResult =
    {
      ...resultWithoutFingerprint,
      fingerprint,
    };

  const invariantReport =
    assertGrowthIntelligenceInvariants(
      result,
    );

  if (!invariantReport.passed) {
    throw new Error(
      [
        "V8 Growth Intelligence invariant failure:",
        ...invariantReport.violations.map(
          (violation) =>
            `- ${violation}`,
        ),
      ].join("\n"),
    );
  }

  return result;
}

export function buildGrowthIntelligenceResult(
  input: GrowthIntelligenceInput,
  options: GrowthIntelligenceEngineOptions = {},
): GrowthIntelligenceResult {
  return runGrowthIntelligence(
    {
      cycleId:
        input.cycleId,
      industry:
        input.industry,
      markets:
        input.markets,
      keywords:
        input.keywords,
      opportunities:
        input.opportunities,
      signals:
        input.signals,
      existingNiches:
        input.existingNiches,
      existingTopics:
        input.existingTopics,
      publishedSlugs:
        input.publishedSlugs,
    },
    {
      ...options,
      minimumNicheScore:
        options.minimumNicheScore ??
        input.minimumNicheScore,
      minimumEvidenceConfidence:
        options.minimumEvidenceConfidence ??
        input.minimumEvidenceConfidence,
      maximumNiches:
        options.maximumNiches ??
        input.maximumNiches,
    },
  );
}

export function assertGrowthIntelligenceInvariants(
  result: GrowthIntelligenceResult,
): GrowthIntelligenceInvariantReport {
  const violations: string[] =
    [];

  if (!result.cycleId) {
    violations.push(
      "missing cycleId",
    );
  }

  if (
    !result.industry.industryId
  ) {
    violations.push(
      "missing industryId",
    );
  }

  const nicheIds =
    new Set<string>();

  for (const niche of result.niches) {
    if (
      nicheIds.has(
        niche.nicheId,
      )
    ) {
      violations.push(
        `duplicate nicheId: ${niche.nicheId}`,
      );
    }

    nicheIds.add(
      niche.nicheId,
    );

    if (
      !Number.isFinite(
        niche.score,
      ) ||
      niche.score < 0 ||
      niche.score > 1
    ) {
      violations.push(
        `invalid niche score: ${niche.nicheId}`,
      );
    }

    if (
      niche.evidenceIds
        .length === 0 &&
      niche.decision ===
        "PURSUE"
    ) {
      violations.push(
        `pursued niche has no evidence: ${niche.nicheId}`,
      );
    }

    if (
      niche.opportunityId
        .length === 0
    ) {
      violations.push(
        `niche has no opportunityId: ${niche.nicheId}`,
      );
    }

    if (
      niche.industryId !==
      result.industry.industryId
    ) {
      violations.push(
        `niche belongs to wrong industry: ${niche.nicheId}`,
      );
    }
  }

  const opportunityIds =
    new Set<string>();

  for (const opportunity of result.opportunities) {
    if (
      opportunityIds.has(
        opportunity.opportunityId,
      )
    ) {
      violations.push(
        `duplicate opportunityId: ${opportunity.opportunityId}`,
      );
    }

    opportunityIds.add(
      opportunity.opportunityId,
    );

    try {
      assertNicheOpportunityInvariant(
        opportunity,
      );
    } catch (error) {
      violations.push(
        error instanceof Error
          ? error.message
          : String(error),
      );
    }

    const matchingNiche =
      result.niches.find(
        (niche) =>
          niche.opportunityId ===
          opportunity.opportunityId,
      );

    if (!matchingNiche) {
      violations.push(
        `missing niche for opportunity: ${opportunity.opportunityId}`,
      );
    }
  }

  const evidenceIds =
    new Set(
      result.evidence.map(
        (evidence) =>
          evidence.evidenceId,
      ),
    );

  if (
    evidenceIds.size !==
    result.evidence.length
  ) {
    violations.push(
      "duplicate evidenceId",
    );
  }

  for (const evidence of result.evidence) {
    if (
      !evidence.sourceUrl
    ) {
      violations.push(
        `evidence missing sourceUrl: ${evidence.evidenceId}`,
      );
    }

    if (
      !evidence.signalId
    ) {
      violations.push(
        `evidence missing signalId: ${evidence.evidenceId}`,
      );
    }

    if (
      !evidence.nicheId
    ) {
      violations.push(
        `evidence missing nicheId: ${evidence.evidenceId}`,
      );
    }

    if (
      !Number.isFinite(
        evidence.confidence,
      ) ||
      evidence.confidence < 0 ||
      evidence.confidence > 1
    ) {
      violations.push(
        `invalid evidence confidence: ${evidence.evidenceId}`,
      );
    }

    if (
      !evidence.fingerprint.startsWith(
        "niche-evidence:v8:",
      )
    ) {
      violations.push(
        `invalid evidence fingerprint: ${evidence.evidenceId}`,
      );
    }
  }

  for (const opportunity of result.opportunities) {
    for (const evidenceId of
      opportunity.evidenceIds) {
      if (
        !evidenceIds.has(
          evidenceId,
        )
      ) {
        violations.push(
          `opportunity ${opportunity.opportunityId} references missing evidence ${evidenceId}`,
        );
      }
    }
  }

  const topicIds =
    new Set<string>();

  for (const topic of result.topics) {
    if (
      topicIds.has(
        topic.topicId,
      )
    ) {
      violations.push(
        `duplicate topicId: ${topic.topicId}`,
      );
    }

    topicIds.add(
      topic.topicId,
    );

    const matchingOpportunity =
      result.opportunities.find(
        (opportunity) =>
          opportunity.nicheId ===
          topic.nicheId,
      );

    if (!matchingOpportunity) {
      violations.push(
        `topic ${topic.topicId} references unknown niche ${topic.nicheId}`,
      );
    }

    if (
      !topic.normalizedKeyword
    ) {
      violations.push(
        `topic ${topic.topicId} has empty normalized keyword`,
      );
    }

    if (
      topic.opportunity.keyword
        .keyword !==
      topic.keyword
    ) {
      violations.push(
        `topic ${topic.topicId} keyword mismatch`,
      );
    }

    for (const evidenceId of
      topic.evidenceIds) {
      if (
        !evidenceIds.has(
          evidenceId,
        )
      ) {
        violations.push(
          `topic ${topic.topicId} references missing evidence ${evidenceId}`,
        );
      }
    }
  }

  const contentOpportunityIds =
    new Set<string>();

  for (const contentOpportunity of
    result.contentOpportunities) {
    if (
      contentOpportunityIds.has(
        contentOpportunity
          .contentOpportunityId,
      )
    ) {
      violations.push(
        `duplicate contentOpportunityId: ${contentOpportunity.contentOpportunityId}`,
      );
    }

    contentOpportunityIds.add(
      contentOpportunity
        .contentOpportunityId,
    );

    if (
      !topicIds.has(
        contentOpportunity.topicId,
      )
    ) {
      violations.push(
        `content opportunity ${contentOpportunity.contentOpportunityId} references unknown topic`,
      );
    }

    if (
      contentOpportunity.evidenceIds.some(
        (evidenceId) =>
          !evidenceIds.has(
            evidenceId,
          ),
      )
    ) {
      violations.push(
        `content opportunity ${contentOpportunity.contentOpportunityId} references missing evidence`,
      );
    }

    if (
      !Number.isFinite(
        contentOpportunity.score,
      ) ||
      contentOpportunity.score <
        0 ||
      contentOpportunity.score >
        1
    ) {
      violations.push(
        `invalid content opportunity score: ${contentOpportunity.contentOpportunityId}`,
      );
    }

    if (
      contentOpportunity.decision ===
        "PURSUE" &&
      contentOpportunity.score <
        0.65
    ) {
      violations.push(
        `pursued content opportunity below threshold: ${contentOpportunity.contentOpportunityId}`,
      );
    }
  }

  const clusterIds =
    new Set<string>();

  for (const cluster of result.clusters) {
    if (
      clusterIds.has(
        cluster.clusterId,
      )
    ) {
      violations.push(
        `duplicate clusterId: ${cluster.clusterId}`,
      );
    }

    clusterIds.add(
      cluster.clusterId,
    );

    if (
      cluster.keywords.length ===
      0
    ) {
      violations.push(
        `empty cluster keywords: ${cluster.clusterId}`,
      );
    }

    for (const signal of
      cluster.signals) {
      if (
        signal.industryId &&
        signal.industryId !==
          result.industry.industryId
      ) {
        violations.push(
          `cluster ${cluster.clusterId} contains wrong-industry signal ${signal.signalId}`,
        );
      }
    }
  }

  const blockedKeys =
    new Set<string>();

  for (const blocked of
    result.blocked) {
    if (
      !normalizeText(
        blocked.subject,
      )
    ) {
      violations.push(
        "blocked item has empty subject",
      );
    }

    const key =
      `${normalizeText(
        blocked.subject,
      )}::${blocked.reason}`;

    if (
      blockedKeys.has(key)
    ) {
      violations.push(
        `duplicate blocked item: ${key}`,
      );
    }

    blockedKeys.add(key);
  }

  if (
    !result.fingerprint.startsWith(
      "growth-intelligence:v8:",
    )
  ) {
    violations.push(
      "invalid growth intelligence fingerprint",
    );
  }

  return {
    passed:
      violations.length === 0,
    violations,
  };
}

export function assertGrowthIntelligenceResult(
  result: GrowthIntelligenceResult,
): void {
  const report =
    assertGrowthIntelligenceInvariants(
      result,
    );

  if (!report.passed) {
    throw new Error(
      [
        "V8 Growth Intelligence invariant failure:",
        ...report.violations.map(
          (violation) =>
            `- ${violation}`,
        ),
      ].join("\n"),
    );
  }
}

export function runGrowthIntelligenceCycle(
  input: GrowthIntelligenceInput,
  options: GrowthIntelligenceEngineOptions = {},
): GrowthIntelligenceResult {
  return buildGrowthIntelligenceResult(
    input,
    options,
  );
}