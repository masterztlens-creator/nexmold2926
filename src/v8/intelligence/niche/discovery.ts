import {
  clamp,
  inferIntent,
  normalizeText,
  slugify,
  tokenize,
  uniqueStrings,
} from "../shared.js";
import {
  buildMarketSignalSet,
  summarizeMarketSignals,
} from "../market/signals.js";
import { createNicheOpportunity } from "./scoring.js";
import type { Opportunity, KeywordRecord } from "../shared.js";
import type {
  GrowthSignal,
  IndustryProfile,
  MarketProfile,
  Niche,
  NicheCluster,
  NicheEvidence,
  NicheOpportunity,
  TopicCandidate,
} from "../growth-intelligence/types.js";

export interface NicheDiscoveryInput {
  readonly industry: IndustryProfile;
  readonly markets: readonly MarketProfile[];
  readonly keywords: readonly KeywordRecord[];
  readonly opportunities?: readonly Opportunity[];
  readonly signals: readonly GrowthSignal[];
  readonly existingNiches?: readonly Niche[];
  readonly minimumScore?: number;
  readonly minimumEvidenceConfidence?: number;
  readonly maximumNiches?: number;
  readonly now?: string;
}

export interface NicheDiscoveryResult {
  readonly clusters: readonly NicheCluster[];
  readonly evidence: readonly NicheEvidence[];
  readonly opportunities: readonly NicheOpportunity[];
  readonly topics: readonly TopicCandidate[];
  readonly blocked: readonly {
    readonly subject: string;
    readonly reason:
      | "LOW_SCORE"
      | "LOW_EVIDENCE_CONFIDENCE"
      | "ALREADY_EXISTS"
      | "NO_COMMERCIAL_FIT"
      | "NO_CAPABILITY_FIT"
      | "EXHAUSTED";
  }[];
}

interface ClusterAccumulator {
  readonly clusterId: string;
  readonly keywords: KeywordRecord[];
  readonly signals: GrowthSignal[];
  readonly marketIds: Set<string>;
}

const DEFAULT_DISCOVERY_TIMESTAMP =
  "1970-01-01T00:00:00.000Z";

const GENERIC_TERMS = new Set([
  "guide",
  "information",
  "service",
  "services",
  "best",
  "how",
  "what",
  "why",
  "when",
  "where",
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "about",
  "plastic",
  "injection",
  "molding",
  "mould",
  "manufacturing",
]);

const NICHE_STOP_TERMS = new Set([
  ...GENERIC_TERMS,
  "company",
  "companies",
  "industry",
  "business",
  "solution",
  "solutions",
  "process",
  "processes",
  "technology",
  "technologies",
]);

function stableHash(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;

  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;

    first ^= code;
    first = Math.imul(first, 0x01000193);

    second ^= code + 0x7ed55d16;
    second = Math.imul(second, 0x01000193);
  }

  return `${(first >>> 0)
    .toString(16)
    .padStart(8, "0")}${(second >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}

function normalizeKeyword(value: string): string {
  return normalizeText(value)
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTimestamp(value?: string): string {
  if (!value) {
    return DEFAULT_DISCOVERY_TIMESTAMP;
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return DEFAULT_DISCOVERY_TIMESTAMP;
  }

  return new Date(parsed).toISOString();
}

function meaningfulTokens(value: string): string[] {
  return uniqueStrings(
    tokenize(value).filter(
      (token) =>
        token.length >= 3 &&
        !NICHE_STOP_TERMS.has(token),
    ),
  ).sort();
}

function tokenSet(value: string): Set<string> {
  return new Set(meaningfulTokens(value));
}

function tokenSimilarity(
  left: string,
  right: string,
): number {
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);

  if (
    leftTokens.size === 0 ||
    rightTokens.size === 0
  ) {
    return 0;
  }

  let intersection = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  }

  const union = new Set([
    ...leftTokens,
    ...rightTokens,
  ]).size;

  return union === 0
    ? 0
    : intersection / union;
}

function phraseOverlap(
  left: string,
  right: string,
): number {
  const normalizedLeft = normalizeKeyword(left);
  const normalizedRight = normalizeKeyword(right);

  if (
    !normalizedLeft ||
    !normalizedRight
  ) {
    return 0;
  }

  if (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  ) {
    return 1;
  }

  return tokenSimilarity(
    normalizedLeft,
    normalizedRight,
  );
}

function canonicalClusterName(
  keywords: readonly KeywordRecord[],
): string {
  if (keywords.length === 0) {
    return "unknown niche";
  }

  const frequencies = new Map<string, number>();

  for (const keyword of keywords) {
    for (const token of meaningfulTokens(
      keyword.keyword,
    )) {
      frequencies.set(
        token,
        (frequencies.get(token) ?? 0) + 1,
      );
    }
  }

  const rankedTokens = [
    ...frequencies.entries(),
  ]
    .sort(
      (left, right) =>
        right[1] - left[1] ||
        left[0].localeCompare(right[0]),
    )
    .slice(0, 4)
    .map(([token]) => token);

  if (rankedTokens.length > 0) {
    return rankedTokens.join(" ");
  }

  return normalizeKeyword(
    keywords[0].keyword,
  );
}

function createClusterId(
  industryId: string,
  keywords: readonly KeywordRecord[],
): string {
  const canonical = [
    normalizeText(industryId),
    ...keywords
      .map((keyword) =>
        normalizeKeyword(keyword.keyword),
      )
      .sort(),
  ].join("::");

  return `niche-cluster:v8:${stableHash(
    canonical,
  )}`;
}

function keywordIdentity(
  keyword: KeywordRecord,
): string {
  return (
    normalizeKeyword(keyword.normalized) ||
    normalizeKeyword(keyword.keyword)
  );
}

function buildKeywordOpportunityMap(
  opportunities: readonly Opportunity[],
): Map<string, Opportunity> {
  const map = new Map<string, Opportunity>();

  for (const opportunity of opportunities) {
    const normalized = normalizeKeyword(
      opportunity.keyword.keyword,
    );

    if (!normalized) {
      continue;
    }

    const existing = map.get(normalized);

    if (
      !existing ||
      opportunity.score > existing.score
    ) {
      map.set(normalized, opportunity);
    }
  }

  return map;
}

function opportunityFromKeyword(
  keyword: KeywordRecord,
  opportunities: Map<string, Opportunity>,
): Opportunity {
  const normalized = normalizeKeyword(
    keyword.keyword,
  );

  const existing = opportunities.get(
    normalized,
  );

  if (existing) {
    return existing;
  }

  const intent = inferIntent(keyword.keyword);

  const demand =
    keyword.source === "SERP"
      ? 0.7
      : keyword.source === "COMPETITOR"
        ? 0.55
        : 0.45;

  const relevance =
    keyword.source === "SEED" ||
    keyword.source === "DISCOVERY"
      ? 0.9
      : 0.7;

  const competition =
    keyword.source === "COMPETITOR"
      ? 0.65
      : 0.5;

  const authorityGap =
    keyword.source === "COMPETITOR"
      ? 0.65
      : 0.5;

  const conversionPotential =
    intent === "TRANSACTIONAL"
      ? 0.95
      : intent === "COMMERCIAL"
        ? 0.8
        : intent === "COMPARISON"
          ? 0.65
          : 0.35;

  const score = clamp(
    0.27 * demand +
      0.27 * relevance +
      0.16 * (1 - competition) +
      0.15 * authorityGap +
      0.15 * conversionPotential,
  );

  return {
    keyword,
    score,
    demand,
    relevance,
    competition,
    authorityGap,
    conversionPotential,
    reasons: [
      `derived from ${keyword.source.toLowerCase()} keyword`,
      `intent=${intent}`,
    ],
  };
}

function assignKeywordsToClusters(
  keywords: readonly KeywordRecord[],
): ClusterAccumulator[] {
  const clusters: ClusterAccumulator[] = [];

  const sortedKeywords = [...keywords].sort(
    (left, right) =>
      normalizeKeyword(
        left.keyword,
      ).localeCompare(
        normalizeKeyword(right.keyword),
      ) ||
      keywordIdentity(left).localeCompare(
        keywordIdentity(right),
      ),
  );

  for (const keyword of sortedKeywords) {
    const normalized = normalizeKeyword(
      keyword.keyword,
    );

    if (!normalized) {
      continue;
    }

    let bestCluster:
      | ClusterAccumulator
      | undefined;

    let bestSimilarity = 0;

    for (const cluster of clusters) {
      const representatives =
        cluster.keywords
          .map((item) => item.keyword)
          .sort(
            (left, right) =>
              normalizeKeyword(
                left,
              ).localeCompare(
                normalizeKeyword(right),
              ),
          );

      const representative =
        representatives[0];

      if (!representative) {
        continue;
      }

      const similarity = phraseOverlap(
        normalized,
        representative,
      );

      if (
        similarity > bestSimilarity
      ) {
        bestSimilarity = similarity;
        bestCluster = cluster;
      }
    }

    if (
      bestCluster &&
      bestSimilarity >= 0.34
    ) {
      bestCluster.keywords.push(keyword);

      if (keyword.market) {
        bestCluster.marketIds.add(
          normalizeText(keyword.market),
        );
      }

      continue;
    }

    const pendingId = `pending:${clusters.length}`;

    clusters.push({
      clusterId: pendingId,
      keywords: [keyword],
      signals: [],
      marketIds: new Set(
        keyword.market
          ? [normalizeText(keyword.market)]
          : [],
      ),
    });
  }

  return clusters;
}

function attachSignalsToClusters(
  clusters: readonly ClusterAccumulator[],
  signals: readonly GrowthSignal[],
): void {
  const sortedSignals = [...signals].sort(
    (left, right) =>
      left.signalId.localeCompare(
        right.signalId,
      ),
  );

  for (const signal of sortedSignals) {
    let bestCluster:
      | ClusterAccumulator
      | undefined;

    let bestSimilarity = 0;

    for (const cluster of clusters) {
      const similarity = Math.max(
        ...cluster.keywords.map(
          (keyword) =>
            phraseOverlap(
              signal.subject,
              keyword.keyword,
            ),
        ),
        0,
      );

      if (
        similarity > bestSimilarity
      ) {
        bestSimilarity = similarity;
        bestCluster = cluster;
      }
    }

    if (
      bestCluster &&
      bestSimilarity >= 0.25
    ) {
      bestCluster.signals.push(signal);

      if (signal.marketId) {
        bestCluster.marketIds.add(
          normalizeText(signal.marketId),
        );
      }
    }
  }
}

function materializeClusters(
  industry: IndustryProfile,
  clusters: readonly ClusterAccumulator[],
): NicheCluster[] {
  return clusters
    .filter(
      (cluster) =>
        cluster.keywords.length > 0,
    )
    .map((cluster) => {
      const sortedKeywords = [
        ...cluster.keywords,
      ].sort(
        (left, right) =>
          normalizeKeyword(
            left.keyword,
          ).localeCompare(
            normalizeKeyword(right.keyword),
          ) ||
          keywordIdentity(left).localeCompare(
            keywordIdentity(right),
          ),
      );

      const canonicalName =
        canonicalClusterName(
          sortedKeywords,
        );

      const clusterId =
        createClusterId(
          industry.industryId,
          sortedKeywords,
        );

      const intentDistribution: Partial<
        Record<
          KeywordRecord["intent"],
          number
        >
      > = {};

      for (const keyword of sortedKeywords) {
        intentDistribution[
          keyword.intent
        ] =
          (intentDistribution[
            keyword.intent
          ] ?? 0) + 1;
      }

      const totalKeywords =
        sortedKeywords.length;

      for (const key of Object.keys(
        intentDistribution,
      ) as KeywordRecord["intent"][]) {
        intentDistribution[key] =
          (intentDistribution[key] ?? 0) /
          totalKeywords;
      }

      return {
        clusterId,
        canonicalName,
        normalizedName:
          normalizeKeyword(canonicalName),
        keywords: sortedKeywords,
        signals: [
          ...cluster.signals,
        ].sort(
          (left, right) =>
            left.signalId.localeCompare(
              right.signalId,
            ),
        ),
        marketIds: [
          ...cluster.marketIds,
        ].filter(Boolean).sort(),
        intentDistribution,
        tokenSet:
          meaningfulTokens(canonicalName),
      };
    })
    .sort(
      (left, right) =>
        right.keywords.length -
          left.keywords.length ||
        right.signals.length -
          left.signals.length ||
        left.normalizedName.localeCompare(
          right.normalizedName,
        ) ||
        left.clusterId.localeCompare(
          right.clusterId,
        ),
    );
}

function createEvidenceForCluster(
  cluster: NicheCluster,
): NicheEvidence[] {
  const evidence: NicheEvidence[] = [];

  const sortedSignals = [
    ...cluster.signals,
  ].sort(
    (left, right) =>
      left.signalId.localeCompare(
        right.signalId,
      ),
  );

  for (const signal of sortedSignals) {
    const sourceUrls = [
      ...new Set(
        signal.evidenceRefs
          .map((url) => url.trim())
          .filter(Boolean),
      ),
    ].sort();

    for (const sourceUrl of sourceUrls) {
      const canonicalEvidence = [
        cluster.clusterId,
        signal.signalId,
        sourceUrl,
        signal.observedAt,
      ].join("::");

      const evidenceId =
        `niche-evidence:${stableHash(
          canonicalEvidence,
        )}`;

      const fingerprint =
        `niche-evidence:v8:${stableHash(
          canonicalEvidence,
        )}`;

      const title =
        typeof signal.metadata.title ===
        "string"
          ? signal.metadata.title
          : undefined;

      const publisher =
        typeof signal.metadata.publisher ===
        "string"
          ? signal.metadata.publisher
          : undefined;

      const excerpt =
        typeof signal.metadata.excerpt ===
        "string"
          ? signal.metadata.excerpt
          : undefined;

      evidence.push({
        evidenceId,
        nicheId: `pending:${cluster.clusterId}`,
        signalId: signal.signalId,
        sourceUrl,
        ...(title
          ? { sourceTitle: title }
          : {}),
        ...(publisher
          ? { publisher }
          : {}),
        ...(excerpt
          ? { excerpt }
          : {}),
        observedAt:
          normalizeTimestamp(
            signal.observedAt,
          ),
        fingerprint,
        confidence: clamp(
          Number.isFinite(
            signal.confidence,
          )
            ? signal.confidence
            : 0,
        ),
      });
    }
  }

  return evidence.sort(
    (left, right) =>
      left.evidenceId.localeCompare(
        right.evidenceId,
      ),
  );
}

function commercialIntentFromScore(
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

function existingNicheKey(
  niche: Niche,
): string {
  return (
    normalizeText(
      niche.normalizedName,
    ) ||
    normalizeText(niche.name) ||
    normalizeText(niche.nicheId)
  );
}

function clusterMatchesExistingNiche(
  cluster: NicheCluster,
  existingNiches: readonly Niche[],
): boolean {
  const clusterName =
    normalizeKeyword(
      cluster.normalizedName,
    );

  if (!clusterName) {
    return false;
  }

  for (const niche of existingNiches) {
    const existingName =
      existingNicheKey(niche);

    if (!existingName) {
      continue;
    }

    if (
      clusterName === existingName ||
      clusterName.includes(
        existingName,
      ) ||
      existingName.includes(
        clusterName,
      )
    ) {
      return true;
    }

    if (
      tokenSimilarity(
        clusterName,
        existingName,
      ) >= 0.65
    ) {
      return true;
    }
  }

  return false;
}

function chooseRepresentativeKeyword(
  cluster: NicheCluster,
  opportunities: Map<string, Opportunity>,
): KeywordRecord | undefined {
  return [...cluster.keywords].sort(
    (left, right) => {
      const leftOpportunity =
        opportunities.get(
          normalizeKeyword(
            left.keyword,
          ),
        );

      const rightOpportunity =
        opportunities.get(
          normalizeKeyword(
            right.keyword,
          ),
        );

      return (
        (rightOpportunity?.score ?? 0) -
          (leftOpportunity?.score ?? 0) ||
        meaningfulTokens(
          right.keyword,
        ).length -
          meaningfulTokens(
            left.keyword,
          ).length ||
        normalizeKeyword(
          left.keyword,
        ).localeCompare(
          normalizeKeyword(
            right.keyword,
          ),
        )
      );
    },
  )[0];
}

function createTopicCandidates(
  cluster: NicheCluster,
  niche: NicheOpportunity,
  opportunities: Map<string, Opportunity>,
): TopicCandidate[] {
  return cluster.keywords
    .map((keyword) => {
      const opportunity =
        opportunities.get(
          normalizeKeyword(
            keyword.keyword,
          ),
        ) ??
        opportunityFromKeyword(
          keyword,
          opportunities,
        );

      const commercialIntent =
        commercialIntentFromScore(
          Math.max(
            niche.components
              .commercialIntent,
            opportunity.conversionPotential,
          ),
        );

      const topicSlug =
        slugify(keyword.keyword);

      const topicId =
        `topic:${
          topicSlug ||
          stableHash(
            `${niche.nicheId}::${keyword.keyword}`,
          )
        }`;

      return {
        topicId,
        nicheId: niche.nicheId,
        keyword: keyword.keyword,
        normalizedKeyword:
          normalizeKeyword(
            keyword.keyword,
          ),
        intent: keyword.intent,
        opportunity,
        commercialIntent,
        evidenceIds: [
          ...niche.evidenceIds,
        ],
      };
    })
    .sort(
      (left, right) =>
        right.opportunity.score -
          left.opportunity.score ||
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
}

function hasUsableEvidence(
  evidence: readonly NicheEvidence[],
): boolean {
  return evidence.some(
    (item) =>
      Boolean(item.sourceUrl) &&
      Number.isFinite(item.confidence) &&
      item.confidence > 0,
  );
}

function inferBlockedReason(
  opportunity: NicheOpportunity,
): NicheDiscoveryResult["blocked"][number]["reason"] {
  const blockers =
    opportunity.blockers.map(
      normalizeText,
    );

  if (
    blockers.some((value) =>
      value.includes("evidence"),
    )
  ) {
    return "LOW_EVIDENCE_CONFIDENCE";
  }

  if (
    blockers.some((value) =>
      value.includes("capability"),
    )
  ) {
    return "NO_CAPABILITY_FIT";
  }

  if (
    blockers.some((value) =>
      value.includes("commercial"),
    )
  ) {
    return "NO_COMMERCIAL_FIT";
  }

  return "LOW_SCORE";
}

export function discoverNicheClusters(
  input: NicheDiscoveryInput,
): readonly NicheCluster[] {
  const filteredKeywords =
    input.keywords.filter(
      (keyword) =>
        normalizeKeyword(
          keyword.keyword,
        ).length > 0,
    );

  const clusters =
    assignKeywordsToClusters(
      filteredKeywords,
    );

  const signalSet =
    buildMarketSignalSet(
      input.signals,
    );

  attachSignalsToClusters(
    clusters,
    signalSet.signals,
  );

  return materializeClusters(
    input.industry,
    clusters,
  );
}

export function discoverNiches(
  input: NicheDiscoveryInput,
): NicheDiscoveryResult {
  const now =
    normalizeTimestamp(input.now);

  const keywordOpportunityMap =
    buildKeywordOpportunityMap(
      input.opportunities ?? [],
    );

  const clusters =
    discoverNicheClusters(input);

  const allEvidence: NicheEvidence[] =
    [];

  const opportunities: NicheOpportunity[] =
    [];

  const topics: TopicCandidate[] = [];

type BlockedNiche =
  NicheDiscoveryResult["blocked"][number];

const blocked: BlockedNiche[] = [];

  const existingNiches =
    input.existingNiches ?? [];

  for (const cluster of clusters) {
    const clusterEvidence =
      createEvidenceForCluster(
        cluster,
      );

    const evidenceIds =
      clusterEvidence
        .map(
          (item) =>
            item.evidenceId,
        )
        .sort();

    const clusterSignals =
      cluster.signals.length > 0
        ? cluster.signals
        : input.signals.filter(
            (signal) =>
              cluster.keywords.some(
                (keyword) =>
                  phraseOverlap(
                    signal.subject,
                    keyword.keyword,
                  ) >= 0.25,
              ),
          );

    const market =
      input.markets.find(
        (item) =>
          cluster.marketIds.includes(
            normalizeText(
              item.marketId,
            ),
          ),
      );

    const summary =
      summarizeMarketSignals(
        clusterSignals,
        cluster.canonicalName,
        input.industry,
        market,
      );

    const fallbackOpportunityScores =
      cluster.keywords.map(
        (keyword) => {
          const opportunity =
            keywordOpportunityMap.get(
              normalizeKeyword(
                keyword.keyword,
              ),
            ) ??
            opportunityFromKeyword(
              keyword,
              keywordOpportunityMap,
            );

          return opportunity.score;
        },
      );

    const keywordOpportunityAverage =
      fallbackOpportunityScores.length >
      0
        ? fallbackOpportunityScores.reduce(
            (
              total,
              value,
            ) => total + value,
            0,
          ) /
          fallbackOpportunityScores.length
        : 0;

    const evidenceConfidence =
      clusterEvidence.length > 0
        ? clusterEvidence.reduce(
            (
              total,
              evidence,
            ) =>
              total +
              evidence.confidence,
            0,
          ) /
          clusterEvidence.length
        : summary.evidenceConfidence;

    const components = {
      demand: clamp(
        summary.demand * 0.8 +
          keywordOpportunityAverage *
            0.2,
      ),
      growth: clamp(
        summary.growth,
      ),
      competition: clamp(
        summary.competition,
      ),
      contentGap: clamp(
        summary.contentGap,
      ),
      commercialIntent: clamp(
        summary.commercialIntent,
      ),
      capabilityFit: clamp(
        summary.capabilityFit,
      ),
      conversionPotential:
        clamp(
          summary.conversionPotential,
        ),
      evidenceConfidence: clamp(
        evidenceConfidence,
      ),
      trafficPotential: clamp(
        summary.trafficPotential,
      ),
    };

    const nicheSlug =
      slugify(
        cluster.canonicalName,
      );

    const nicheId =
      `niche:${
        nicheSlug ||
        stableHash(
          cluster.clusterId,
        )
      }`;

    if (
      clusterMatchesExistingNiche(
        cluster,
        existingNiches,
      )
    ) {
      blocked.push({
        subject:
          cluster.canonicalName,
        reason: "ALREADY_EXISTS",
      });

      continue;
    }

    if (
      clusterEvidence.length === 0 ||
      !hasUsableEvidence(
        clusterEvidence,
      )
    ) {
      blocked.push({
        subject:
          cluster.canonicalName,
        reason:
          "LOW_EVIDENCE_CONFIDENCE",
      });

      continue;
    }

    const opportunity =
      createNicheOpportunity({
        nicheId,
        name:
          cluster.canonicalName,
        components,
        evidenceIds,
        keywordIds:
          cluster.keywords
            .map(
              (keyword) =>
                `keyword:${slugify(
                  keyword.keyword,
                ) || stableHash(
                  keyword.keyword,
                )}`,
            )
            .sort(),
        marketIds:
          cluster.marketIds,
        minimumScore:
          input.minimumScore,
        minimumEvidenceConfidence:
          input.minimumEvidenceConfidence,
        now,
      });

    opportunities.push(
      opportunity,
    );

    allEvidence.push(
      ...clusterEvidence.map(
        (evidence) => ({
          ...evidence,
          nicheId,
        }),
      ),
    );

    if (
      opportunity.decision ===
      "REJECT"
    ) {
      blocked.push({
        subject:
          cluster.canonicalName,
        reason:
          inferBlockedReason(
            opportunity,
          ),
      });

      continue;
    }

    const representative =
      chooseRepresentativeKeyword(
        cluster,
        keywordOpportunityMap,
      );

    if (!representative) {
      blocked.push({
        subject:
          cluster.canonicalName,
        reason: "EXHAUSTED",
      });

      continue;
    }

    topics.push(
      ...createTopicCandidates(
        cluster,
        opportunity,
        keywordOpportunityMap,
      ),
    );
  }

  const sortedOpportunities =
    [...opportunities].sort(
      (left, right) =>
        right.score - left.score ||
        right.components
          .commercialIntent -
          left.components
            .commercialIntent ||
        right.components
          .conversionPotential -
          left.components
            .conversionPotential ||
        right.components
          .capabilityFit -
          left.components
            .capabilityFit ||
        right.components
          .evidenceConfidence -
          left.components
            .evidenceConfidence ||
        left.normalizedName.localeCompare(
          right.normalizedName,
        ) ||
        left.opportunityId.localeCompare(
          right.opportunityId,
        ),
    );

  const maximumNiches =
    Number.isInteger(
      input.maximumNiches,
    ) &&
    (input.maximumNiches ?? 0) > 0
      ? input.maximumNiches!
      : sortedOpportunities.length;

  const selectedOpportunities =
    sortedOpportunities.slice(
      0,
      maximumNiches,
    );

  const selectedNicheIds =
    new Set(
      selectedOpportunities.map(
        (opportunity) =>
          opportunity.nicheId,
      ),
    );

  const selectedTopics =
    topics
      .filter((topic) =>
        selectedNicheIds.has(
          topic.nicheId,
        ),
      )
      .sort(
        (left, right) =>
          right.opportunity.score -
            left.opportunity.score ||
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

  const selectedEvidenceIds =
    new Set(
      selectedOpportunities.flatMap(
        (opportunity) =>
          opportunity.evidenceIds,
      ),
    );

  const selectedEvidence =
    allEvidence
      .filter((evidence) =>
        selectedEvidenceIds.has(
          evidence.evidenceId,
        ),
      )
      .sort(
        (left, right) =>
          left.evidenceId.localeCompare(
            right.evidenceId,
          ),
      );

  const overflowBlocked =
    sortedOpportunities
      .slice(maximumNiches)
      .map((opportunity) => ({
        subject:
          opportunity.name,
        reason:
          "LOW_SCORE" as const,
      }));

  return {
    clusters,
    evidence:
      selectedEvidence,
    opportunities:
      selectedOpportunities,
    topics: selectedTopics,
    blocked: [
      ...blocked,
      ...overflowBlocked,
    ],
  };
}

export function assertNicheDiscoveryResult(
  result: NicheDiscoveryResult,
): void {
  const opportunityIds =
    new Set<string>();

  const nicheIds =
    new Set<string>();

  for (const opportunity of result.opportunities) {
    if (
      opportunityIds.has(
        opportunity.opportunityId,
      )
    ) {
      throw new Error(
        `V8 niche discovery invariant failed: duplicate opportunity ${opportunity.opportunityId}`,
      );
    }

    opportunityIds.add(
      opportunity.opportunityId,
    );

    if (
      nicheIds.has(
        opportunity.nicheId,
      )
    ) {
      throw new Error(
        `V8 niche discovery invariant failed: duplicate niche ${opportunity.nicheId}`,
      );
    }

    nicheIds.add(
      opportunity.nicheId,
    );

    if (
      opportunity.evidenceIds.length ===
      0
    ) {
      throw new Error(
        `V8 niche discovery invariant failed: ${opportunity.opportunityId} has no evidence`,
      );
    }

    if (
      opportunity.evidenceIds.some(
        (evidenceId) =>
          !evidenceId,
      )
    ) {
      throw new Error(
        `V8 niche discovery invariant failed: ${opportunity.opportunityId} contains empty evidence id`,
      );
    }

    if (
      opportunity.decision ===
        "PURSUE" &&
      opportunity.lifecycle !==
        "APPROVED"
    ) {
      throw new Error(
        `V8 niche discovery invariant failed: pursued niche ${opportunity.opportunityId} is not APPROVED`,
      );
    }

    if (
      opportunity.decision ===
        "WATCH" &&
      opportunity.lifecycle !==
        "VALIDATED"
    ) {
      throw new Error(
        `V8 niche discovery invariant failed: watched niche ${opportunity.opportunityId} is not VALIDATED`,
      );
    }

    if (
      opportunity.decision ===
        "REJECT" &&
      opportunity.lifecycle !==
        "REJECTED"
    ) {
      throw new Error(
        `V8 niche discovery invariant failed: rejected niche ${opportunity.opportunityId} is not REJECTED`,
      );
    }

    if (
      !Number.isFinite(
        opportunity.score,
      ) ||
      opportunity.score < 0 ||
      opportunity.score > 1
    ) {
      throw new Error(
        `V8 niche discovery invariant failed: invalid score for ${opportunity.opportunityId}`,
      );
    }

    if (
      opportunity.decision ===
        "PURSUE" &&
      opportunity.score <
        0.65
    ) {
      throw new Error(
        `V8 niche discovery invariant failed: pursued niche ${opportunity.opportunityId} is below default threshold`,
      );
    }
  }

  const evidenceIds =
    new Set<string>();

  for (const evidence of result.evidence) {
    if (
      evidenceIds.has(
        evidence.evidenceId,
      )
    ) {
      throw new Error(
        `V8 niche discovery invariant failed: duplicate evidence ${evidence.evidenceId}`,
      );
    }

    evidenceIds.add(
      evidence.evidenceId,
    );

    if (
      !evidence.sourceUrl
    ) {
      throw new Error(
        `V8 niche discovery invariant failed: evidence ${evidence.evidenceId} has no source URL`,
      );
    }

    if (
      !evidence.signalId
    ) {
      throw new Error(
        `V8 niche discovery invariant failed: evidence ${evidence.evidenceId} has no signal ID`,
      );
    }

    if (
      !evidence.nicheId
    ) {
      throw new Error(
        `V8 niche discovery invariant failed: evidence ${evidence.evidenceId} has no niche ID`,
      );
    }

    if (
      !Number.isFinite(
        evidence.confidence,
      ) ||
      evidence.confidence < 0 ||
      evidence.confidence > 1
    ) {
      throw new Error(
        `V8 niche discovery invariant failed: evidence ${evidence.evidenceId} has invalid confidence`,
      );
    }

    if (
      !evidence.fingerprint.startsWith(
        "niche-evidence:v8:",
      )
    ) {
      throw new Error(
        `V8 niche discovery invariant failed: invalid evidence fingerprint ${evidence.evidenceId}`,
      );
    }
  }

  for (const topic of result.topics) {
    const opportunity =
      result.opportunities.find(
        (item) =>
          item.nicheId ===
          topic.nicheId,
      );

    if (!opportunity) {
      throw new Error(
        `V8 niche discovery invariant failed: topic ${topic.topicId} has no niche opportunity`,
      );
    }

    if (
      topic.evidenceIds.some(
        (evidenceId) =>
          !evidenceIds.has(
            evidenceId,
          ),
      )
    ) {
      throw new Error(
        `V8 niche discovery invariant failed: topic ${topic.topicId} references missing evidence`,
      );
    }

    if (
      !topic.normalizedKeyword
    ) {
      throw new Error(
        `V8 niche discovery invariant failed: topic ${topic.topicId} has empty normalized keyword`,
      );
    }

    if (
      topic.opportunity.keyword
        .keyword !==
      topic.keyword
    ) {
      throw new Error(
        `V8 niche discovery invariant failed: topic ${topic.topicId} opportunity keyword mismatch`,
      );
    }
  }

  const blockedKeys =
    new Set<string>();

  for (const item of result.blocked) {
    const key =
      `${normalizeKeyword(
        item.subject,
      )}::${item.reason}`;

    if (blockedKeys.has(key)) {
      continue;
    }

    blockedKeys.add(key);
  }
}

export function rankDiscoveredNiches(
  opportunities: readonly NicheOpportunity[],
): readonly NicheOpportunity[] {
  return [...opportunities].sort(
    (left, right) =>
      right.score - left.score ||
      right.components
        .commercialIntent -
        left.components
          .commercialIntent ||
      right.components
        .conversionPotential -
        left.components
          .conversionPotential ||
      right.components
        .capabilityFit -
        left.components
          .capabilityFit ||
      right.components
        .evidenceConfidence -
        left.components
          .evidenceConfidence ||
      left.normalizedName.localeCompare(
        right.normalizedName,
      ) ||
      left.opportunityId.localeCompare(
        right.opportunityId,
      ),
  );
}