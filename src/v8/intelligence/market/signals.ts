import {
  clamp,
  inferIntent,
  normalizeText,
  tokenize,
  uniqueStrings,
} from "../shared.js";
import type {
  GrowthSignal,
  GrowthSignalType,
  IndustryProfile,
  MarketProfile,
} from "../growth-intelligence/types.js";
import type { JsonValue } from "../shared.js";

export interface MarketSignalInput {
  readonly signalId?: string;
  readonly type: GrowthSignalType;
  readonly source: string;
  readonly observedAt?: string;
  readonly subject: string;
  readonly marketId?: string;
  readonly industryId?: string;
  readonly value?: number;
  readonly confidence?: number;
  readonly evidenceRefs?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface MarketSignalSet {
  readonly signals: readonly GrowthSignal[];
  readonly byType: Readonly<
    Partial<Record<GrowthSignalType, readonly GrowthSignal[]>>
  >;
  readonly byMarket: Readonly<Record<string, readonly GrowthSignal[]>>;
  readonly bySubject: Readonly<Record<string, readonly GrowthSignal[]>>;
}

export interface MarketSignalSummary {
  readonly demand: number;
  readonly growth: number;
  readonly competition: number;
  readonly contentGap: number;
  readonly commercialIntent: number;
  readonly capabilityFit: number;
  readonly conversionPotential: number;
  readonly evidenceConfidence: number;
  readonly trafficPotential: number;
  readonly signalCount: number;
}

const SIGNAL_TYPE_WEIGHT: Readonly<
  Record<GrowthSignalType, number>
> = {
  SEARCH_DEMAND: 1,
  SEARCH_GROWTH: 1,
  COMPETITOR_GAP: 1,
  CONTENT_GAP: 1,
  COMMERCIAL_INTENT: 1,
  PRODUCT_FIT: 1,
  CAPABILITY_FIT: 1,
  TRAFFIC: 1,
  ENGAGEMENT: 0.85,
  INQUIRY: 1,
  QUALIFIED_LEAD: 1,
  CONVERSION: 1,
  MARKET_CHANGE: 0.8,
  EMERGING_TOPIC: 0.9,
};

const COMMERCIAL_TERMS = new Set([
  "price",
  "pricing",
  "cost",
  "quote",
  "rfq",
  "supplier",
  "manufacturer",
  "manufacturing",
  "factory",
  "custom",
  "oem",
  "odm",
  "production",
  "injection",
  "molding",
  "mould",
  "tooling",
  "assembly",
  "prototype",
]);

const HIGH_INTENT_TERMS = new Set([
  "quote",
  "rfq",
  "supplier",
  "manufacturer",
  "factory",
  "custom",
  "oem",
  "production",
  "buy",
  "purchase",
]);

const GENERIC_STOP_TERMS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "about",
  "what",
  "how",
  "why",
  "when",
  "where",
  "which",
  "best",
  "guide",
  "information",
  "service",
  "services",
]);

function stableHash(value: string): string {
  let hashA = 0x811c9dc5;
  let hashB = 0x01000193;

  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;

    hashA ^= code;
    hashA = Math.imul(hashA, 0x01000193);

    hashB ^= code + 0x9e3779b9;
    hashB = Math.imul(hashB, 0x01000193);
  }

  return (
    `${(hashA >>> 0).toString(16).padStart(8, "0")}` +
    `${(hashB >>> 0).toString(16).padStart(8, "0")}`
  );
}

function normalizeJsonValue(value: unknown): JsonValue | undefined {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (Array.isArray(value)) {
    const normalized: JsonValue[] = [];

    for (const item of value) {
      const normalizedItem = normalizeJsonValue(item);

      if (normalizedItem !== undefined) {
        normalized.push(normalizedItem);
      }
    }

    return normalized;
  }

  if (typeof value === "object") {
    const output: Record<string, JsonValue> = {};

    for (const [key, nestedValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      const normalizedValue = normalizeJsonValue(nestedValue);

      if (normalizedValue !== undefined) {
        output[key] = normalizedValue;
      }
    }

    return output;
  }

  return undefined;
}

function normalizeMetadata(
  metadata: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, JsonValue>> {
  if (!metadata) {
    return {};
  }

  const output: Record<string, JsonValue> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const normalizedValue = normalizeJsonValue(value);

    if (normalizedValue !== undefined) {
      output[key] = normalizedValue;
    }
  }

  return output;
}

function normalizeSignalSubject(subject: string): string {
  return normalizeText(subject)
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIdentifier(value: string | undefined): string | undefined {
  const normalized = value ? normalizeText(value) : "";

  return normalized || undefined;
}

function normalizeTimestamp(value: string | undefined): string {
  if (!value) {
    return "1970-01-01T00:00:00.000Z";
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    throw new Error(
      "V8 market signal observedAt must be a valid ISO-compatible timestamp",
    );
  }

  return new Date(timestamp).toISOString();
}

function normalizeSignalValue(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return 0;
  }

  return clamp(value);
}

function normalizeConfidence(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return 0;
  }

  return clamp(value);
}

function createSignalId(input: {
  readonly type: GrowthSignalType;
  readonly subject: string;
  readonly source: string;
  readonly observedAt: string;
  readonly marketId?: string;
  readonly industryId?: string;
  readonly value: number;
  readonly confidence: number;
  readonly evidenceRefs: readonly string[];
}): string {
  const canonical = [
    input.type,
    normalizeSignalSubject(input.subject),
    normalizeText(input.source),
    input.observedAt,
    normalizeText(input.marketId ?? ""),
    normalizeText(input.industryId ?? ""),
    input.value.toFixed(8),
    input.confidence.toFixed(8),
    [...input.evidenceRefs]
      .map(normalizeText)
      .filter(Boolean)
      .sort()
      .join("|"),
  ].join("::");

  return `signal:v8:${stableHash(canonical)}`;
}

function inferCommercialIntentScore(subject: string): number {
  const normalized = normalizeSignalSubject(subject);
  const terms = tokenize(normalized);

  if (terms.length === 0) {
    return 0;
  }

  const phrase = terms.join(" ");
  let score = 0;

  for (const term of terms) {
    if (HIGH_INTENT_TERMS.has(term)) {
      score += 0.25;
    }

    if (COMMERCIAL_TERMS.has(term)) {
      score += 0.12;
    }
  }

  for (const commercialTerm of COMMERCIAL_TERMS) {
    if (phrase.includes(commercialTerm)) {
      score += 0.05;
    }
  }

  const intent = inferIntent(normalized);

  switch (intent) {
    case "TRANSACTIONAL":
      score += 0.3;
      break;

    case "COMMERCIAL":
      score += 0.2;
      break;

    case "COMPARISON":
      score += 0.08;
      break;

    default:
      break;
  }

  return clamp(score);
}

function subjectTokenSet(subject: string): Set<string> {
  return new Set(
    tokenize(subject).filter(
      (token) =>
        token.length > 1 && !GENERIC_STOP_TERMS.has(token),
    ),
  );
}

function tokenSimilarity(left: string, right: string): number {
  const a = subjectTokenSet(left);
  const b = subjectTokenSet(right);

  if (a.size === 0 || b.size === 0) {
    return 0;
  }

  let intersection = 0;

  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }

  const union = new Set([...a, ...b]).size;

  return union === 0 ? 0 : intersection / union;
}

function aggregateSignalValue(
  signals: readonly GrowthSignal[],
  type: GrowthSignalType,
): number {
  const matching = signals.filter(
    (signal) => signal.type === type,
  );

  if (matching.length === 0) {
    return 0;
  }

  let numerator = 0;
  let denominator = 0;

  for (const signal of matching) {
    const typeWeight = SIGNAL_TYPE_WEIGHT[signal.type];
    const confidenceWeight = Math.max(signal.confidence, 0.01);
    const weight = typeWeight * confidenceWeight;

    numerator += signal.value * weight;
    denominator += weight;
  }

  return denominator === 0
    ? 0
    : clamp(numerator / denominator);
}

function averageConfidence(
  signals: readonly GrowthSignal[],
): number {
  if (signals.length === 0) {
    return 0;
  }

  let totalWeight = 0;
  let weightedConfidence = 0;

  for (const signal of signals) {
    const weight = Math.max(
      SIGNAL_TYPE_WEIGHT[signal.type] *
        Math.max(signal.confidence, 0.01),
      0.01,
    );

    weightedConfidence += signal.confidence * weight;
    totalWeight += weight;
  }

  return totalWeight === 0
    ? 0
    : clamp(weightedConfidence / totalWeight);
}

function capabilityFitForSubject(
  subject: string,
  industry: IndustryProfile,
): number {
  const subjectTokens = subjectTokenSet(subject);

  if (subjectTokens.size === 0) {
    return 0;
  }

  const capabilityTokens = new Set<string>();

  for (const value of [
    ...industry.capabilities,
    ...industry.products,
    ...industry.services,
  ]) {
    for (const token of subjectTokenSet(value)) {
      capabilityTokens.add(token);
    }
  }

  if (capabilityTokens.size === 0) {
    return 0;
  }

  let matched = 0;

  for (const token of subjectTokens) {
    if (capabilityTokens.has(token)) {
      matched += 1;
    }
  }

  return clamp(
    matched / Math.max(subjectTokens.size, 1),
  );
}

function marketFitForSubject(
  subject: string,
  market: MarketProfile,
): number {
  const subjectTokens = subjectTokenSet(subject);

  if (subjectTokens.size === 0) {
    return 0;
  }

  const marketTokens = new Set<string>();

  for (const value of [
    market.name,
    market.region ?? "",
    market.country ?? "",
    market.language ?? "",
    ...market.audienceSegments,
  ]) {
    for (const token of subjectTokenSet(value)) {
      marketTokens.add(token);
    }
  }

  if (marketTokens.size === 0) {
    return 0;
  }

  let matched = 0;

  for (const token of subjectTokens) {
    if (marketTokens.has(token)) {
      matched += 1;
    }
  }

  return clamp(
    matched / Math.max(subjectTokens.size, 1),
  );
}

function normalizeSignal(signal: GrowthSignal): GrowthSignal {
  const subject = normalizeText(signal.subject);
  const normalizedSubject =
    normalizeSignalSubject(signal.subject);

  if (!signal.signalId.trim()) {
    throw new Error(
      "V8 market signal requires a non-empty signalId",
    );
  }

  if (!signal.type) {
    throw new Error(
      "V8 market signal requires a signal type",
    );
  }

  if (!signal.source.trim()) {
    throw new Error(
      "V8 market signal requires a non-empty source",
    );
  }

  if (!subject || !normalizedSubject) {
    throw new Error(
      "V8 market signal requires a non-empty subject",
    );
  }

  const observedAt = normalizeTimestamp(signal.observedAt);

  return {
    signalId: normalizeText(signal.signalId),
    type: signal.type,
    source: normalizeText(signal.source),
    observedAt,
    subject,
    normalizedSubject,
    marketId: normalizeIdentifier(signal.marketId),
    industryId: normalizeIdentifier(signal.industryId),
    value: normalizeSignalValue(signal.value),
    confidence: normalizeConfidence(signal.confidence),
    evidenceRefs: uniqueStrings(signal.evidenceRefs),
    metadata: normalizeMetadata(signal.metadata),
  };
}

function compareSignals(
  left: GrowthSignal,
  right: GrowthSignal,
): number {
  return (
    left.signalId.localeCompare(right.signalId) ||
    left.type.localeCompare(right.type) ||
    left.normalizedSubject.localeCompare(
      right.normalizedSubject,
    ) ||
    left.source.localeCompare(right.source)
  );
}

export function createMarketSignal(
  input: MarketSignalInput,
): GrowthSignal {
  const subject = normalizeText(input.subject);
  const normalizedSubject =
    normalizeSignalSubject(input.subject);
  const source = normalizeText(input.source);

  if (!subject || !normalizedSubject) {
    throw new Error(
      "V8 market signal requires a non-empty subject",
    );
  }

  if (!input.type) {
    throw new Error(
      "V8 market signal requires a signal type",
    );
  }

  if (!source) {
    throw new Error(
      "V8 market signal requires a non-empty source",
    );
  }

  const observedAt = normalizeTimestamp(input.observedAt);
  const marketId = normalizeIdentifier(input.marketId);
  const industryId = normalizeIdentifier(input.industryId);
  const value = normalizeSignalValue(input.value);
  const confidence = normalizeConfidence(
    input.confidence ?? 1,
  );
  const evidenceRefs = uniqueStrings(
    input.evidenceRefs ?? [],
  );

  const signalId =
    normalizeIdentifier(input.signalId) ??
    createSignalId({
      type: input.type,
      subject,
      source,
      observedAt,
      marketId,
      industryId,
      value,
      confidence,
      evidenceRefs,
    });

  return normalizeSignal({
    signalId,
    type: input.type,
    source,
    observedAt,
    subject,
    normalizedSubject,
    marketId,
    industryId,
    value,
    confidence,
    evidenceRefs,
    metadata: normalizeMetadata(input.metadata),
  });
}

export function buildMarketSignalSet(
  signals: readonly GrowthSignal[],
): MarketSignalSet {
  const normalizedSignals = deduplicateMarketSignals(
    signals,
  );

  const byType: Partial<
    Record<GrowthSignalType, readonly GrowthSignal[]>
  > = {};

  const byMarket: Record<
    string,
    readonly GrowthSignal[]
  > = {};

  const bySubject: Record<
    string,
    readonly GrowthSignal[]
  > = {};

  for (const signal of normalizedSignals) {
    const existingByType = byType[signal.type] ?? [];

    byType[signal.type] = [
      ...existingByType,
      signal,
    ];

    if (signal.marketId) {
      const existingByMarket =
        byMarket[signal.marketId] ?? [];

      byMarket[signal.marketId] = [
        ...existingByMarket,
        signal,
      ];
    }

    const existingBySubject =
      bySubject[signal.normalizedSubject] ?? [];

    bySubject[signal.normalizedSubject] = [
      ...existingBySubject,
      signal,
    ];
  }

  return {
    signals: normalizedSignals,
    byType,
    byMarket,
    bySubject,
  };
}

export function deduplicateMarketSignals(
  signals: readonly GrowthSignal[],
): GrowthSignal[] {
  const seen = new Map<string, GrowthSignal>();

  for (const rawSignal of signals) {
    const signal = normalizeSignal(rawSignal);

    const key = [
      signal.type,
      signal.normalizedSubject,
      signal.source,
      signal.observedAt,
      signal.marketId ?? "",
      signal.industryId ?? "",
      signal.value.toFixed(8),
      signal.evidenceRefs.join("|"),
    ].join("::");

    const existing = seen.get(key);

    if (
      !existing ||
      signal.confidence > existing.confidence ||
      (
        signal.confidence === existing.confidence &&
        signal.signalId.localeCompare(existing.signalId) < 0
      )
    ) {
      seen.set(key, signal);
    }
  }

  return [...seen.values()].sort(compareSignals);
}

export function mergeMarketSignals(
  ...sets: readonly (readonly GrowthSignal[])[]
): GrowthSignal[] {
  return deduplicateMarketSignals(
    sets.flat(),
  );
}

export function summarizeMarketSignals(
  signals: readonly GrowthSignal[],
  subject?: string,
  industry?: IndustryProfile,
  market?: MarketProfile,
): MarketSignalSummary {
  const normalizedSubject = subject
    ? normalizeSignalSubject(subject)
    : undefined;

  const normalizedSignals = deduplicateMarketSignals(
    signals,
  );

  const scopedSignals = normalizedSubject
    ? normalizedSignals
        .map((signal) => ({
          signal,
          similarity:
            signal.normalizedSubject === normalizedSubject
              ? 1
              : tokenSimilarity(
                  signal.subject,
                  normalizedSubject,
                ),
        }))
        .filter((entry) => entry.similarity >= 0.4)
        .sort(
          (left, right) =>
            right.similarity - left.similarity ||
            compareSignals(
              left.signal,
              right.signal,
            ),
        )
        .slice(0, 100)
        .map((entry) => entry.signal)
    : normalizedSignals;

  const demand = aggregateSignalValue(
    scopedSignals,
    "SEARCH_DEMAND",
  );

  const growth = aggregateSignalValue(
    scopedSignals,
    "SEARCH_GROWTH",
  );

  const competitorGap = aggregateSignalValue(
    scopedSignals,
    "COMPETITOR_GAP",
  );

  const contentGap = aggregateSignalValue(
    scopedSignals,
    "CONTENT_GAP",
  );

  const commercialSignal = aggregateSignalValue(
    scopedSignals,
    "COMMERCIAL_INTENT",
  );

  const traffic = aggregateSignalValue(
    scopedSignals,
    "TRAFFIC",
  );

  const engagement = aggregateSignalValue(
    scopedSignals,
    "ENGAGEMENT",
  );

  const inquiry = aggregateSignalValue(
    scopedSignals,
    "INQUIRY",
  );

  const qualifiedLead = aggregateSignalValue(
    scopedSignals,
    "QUALIFIED_LEAD",
  );

  const conversion = aggregateSignalValue(
    scopedSignals,
    "CONVERSION",
  );

  const inferredCommercial = normalizedSubject
    ? inferCommercialIntentScore(normalizedSubject)
    : 0;

  const commercialIntent = clamp(
    commercialSignal * 0.65 +
      inferredCommercial * 0.35,
  );

  const conversionPotential = clamp(
    conversion * 0.4 +
      qualifiedLead * 0.3 +
      inquiry * 0.2 +
      commercialIntent * 0.1,
  );

  const trafficPotential = clamp(
    traffic * 0.45 +
      demand * 0.3 +
      engagement * 0.1 +
      growth * 0.15,
  );

  const capabilityFit =
    normalizedSubject && industry
      ? capabilityFitForSubject(
          normalizedSubject,
          industry,
        )
      : aggregateSignalValue(
          scopedSignals,
          "CAPABILITY_FIT",
        );

  const marketFit =
    normalizedSubject && market
      ? marketFitForSubject(
          normalizedSubject,
          market,
        )
      : 0;

  const normalizedCapabilityFit = clamp(
    capabilityFit * 0.7 +
      marketFit * 0.3,
  );

  return {
    demand,
    growth,
    competition: clamp(1 - competitorGap),
    contentGap,
    commercialIntent,
    capabilityFit: normalizedCapabilityFit,
    conversionPotential,
    evidenceConfidence:
      averageConfidence(scopedSignals),
    trafficPotential,
    signalCount: scopedSignals.length,
  };
}

export function rankSignalSubjects(
  signals: readonly GrowthSignal[],
): readonly {
  readonly subject: string;
  readonly normalizedSubject: string;
  readonly score: number;
  readonly signalCount: number;
  readonly confidence: number;
}[] {
  const groups = new Map<
    string,
    GrowthSignal[]
  >();

  for (const rawSignal of signals) {
    const signal = normalizeSignal(rawSignal);
    const existing =
      groups.get(signal.normalizedSubject) ?? [];

    groups.set(signal.normalizedSubject, [
      ...existing,
      signal,
    ]);
  }

  const ranked = [...groups.entries()].map(
    ([normalizedSubject, subjectSignals]) => {
      const summary = summarizeMarketSignals(
        subjectSignals,
        normalizedSubject,
      );

      const score = clamp(
        summary.demand * 0.2 +
          summary.growth * 0.15 +
          summary.contentGap * 0.15 +
          summary.commercialIntent * 0.15 +
          summary.conversionPotential * 0.15 +
          summary.trafficPotential * 0.1 +
          summary.evidenceConfidence * 0.1,
      );

      const representative = subjectSignals
        .slice()
        .sort(
          (left, right) =>
            left.subject.localeCompare(
              right.subject,
            ) || compareSignals(left, right),
        )[0];

      return {
        subject:
          representative?.subject ??
          normalizedSubject,
        normalizedSubject,
        score,
        signalCount: subjectSignals.length,
        confidence: summary.evidenceConfidence,
      };
    },
  );

  return ranked.sort(
    (left, right) =>
      right.score - left.score ||
      right.confidence - left.confidence ||
      right.signalCount - left.signalCount ||
      left.normalizedSubject.localeCompare(
        right.normalizedSubject,
      ),
  );
}

export function filterSignalsForIndustry(
  signals: readonly GrowthSignal[],
  industry: IndustryProfile,
): readonly GrowthSignal[] {
  const industryId = normalizeText(
    industry.industryId,
  );

  if (!industryId) {
    throw new Error(
      "V8 industry filtering requires industryId",
    );
  }

  const capabilityTokens = new Set<string>();

  for (const value of [
    ...industry.capabilities,
    ...industry.products,
    ...industry.services,
    ...industry.targetAudiences,
    ...industry.targetMarkets,
  ]) {
    for (const token of subjectTokenSet(value)) {
      capabilityTokens.add(token);
    }
  }

  return deduplicateMarketSignals(signals).filter(
    (signal) => {
      if (
        signal.industryId &&
        signal.industryId === industryId
      ) {
        return true;
      }

      if (
        signal.industryId &&
        signal.industryId !== industryId
      ) {
        return false;
      }

      if (capabilityTokens.size === 0) {
        return false;
      }

      const subjectTokens = subjectTokenSet(
        signal.subject,
      );

      if (subjectTokens.size === 0) {
        return false;
      }

      for (const token of subjectTokens) {
        if (capabilityTokens.has(token)) {
          return true;
        }
      }

      return false;
    },
  );
}

export function filterSignalsForMarket(
  signals: readonly GrowthSignal[],
  market: MarketProfile,
): readonly GrowthSignal[] {
  const marketId = normalizeText(
    market.marketId,
  );

  if (!marketId) {
    throw new Error(
      "V8 market filtering requires marketId",
    );
  }

  const marketTokens = new Set<string>();

  for (const value of [
    market.name,
    market.region ?? "",
    market.country ?? "",
    market.language ?? "",
    ...market.audienceSegments,
  ]) {
    for (const token of subjectTokenSet(value)) {
      marketTokens.add(token);
    }
  }

  return deduplicateMarketSignals(signals).filter(
    (signal) => {
      if (signal.marketId) {
        return signal.marketId === marketId;
      }

      if (marketTokens.size === 0) {
        return false;
      }

      const similarity = tokenSimilarity(
        signal.subject,
        [
          market.name,
          market.region ?? "",
          market.country ?? "",
          ...market.audienceSegments,
        ].join(" "),
      );

      return similarity >= 0.15;
    },
  );
}

export function createDerivedMarketSignals(
  keywords: readonly {
    readonly keyword: string;
    readonly demand?: number;
    readonly growth?: number;
    readonly commercialIntent?: number;
    readonly competition?: number;
    readonly source?: string;
    readonly marketId?: string;
    readonly industryId?: string;
    readonly evidenceRefs?: readonly string[];
  }[],
): readonly GrowthSignal[] {
  const derived: GrowthSignal[] = [];

  for (const keyword of keywords) {
    const subject = normalizeText(keyword.keyword);

    if (!subject) {
      continue;
    }

    const source = normalizeText(
      keyword.source ?? "V8_KEYWORD_UNIVERSE",
    );

    if (!source) {
      continue;
    }

    if (
      keyword.demand !== undefined &&
      Number.isFinite(keyword.demand)
    ) {
      derived.push(
        createMarketSignal({
          type: "SEARCH_DEMAND",
          source,
          subject,
          marketId: keyword.marketId,
          industryId: keyword.industryId,
          value: keyword.demand,
          confidence: 0.8,
          evidenceRefs: keyword.evidenceRefs,
        }),
      );
    }

    if (
      keyword.growth !== undefined &&
      Number.isFinite(keyword.growth)
    ) {
      derived.push(
        createMarketSignal({
          type: "SEARCH_GROWTH",
          source,
          subject,
          marketId: keyword.marketId,
          industryId: keyword.industryId,
          value: keyword.growth,
          confidence: 0.75,
          evidenceRefs: keyword.evidenceRefs,
        }),
      );
    }

    if (
      keyword.commercialIntent !== undefined &&
      Number.isFinite(keyword.commercialIntent)
    ) {
      derived.push(
        createMarketSignal({
          type: "COMMERCIAL_INTENT",
          source,
          subject,
          marketId: keyword.marketId,
          industryId: keyword.industryId,
          value: keyword.commercialIntent,
          confidence: 0.8,
          evidenceRefs: keyword.evidenceRefs,
        }),
      );
    }

    if (
      keyword.competition !== undefined &&
      Number.isFinite(keyword.competition)
    ) {
      derived.push(
        createMarketSignal({
          type: "COMPETITOR_GAP",
          source,
          subject,
          marketId: keyword.marketId,
          industryId: keyword.industryId,
          value: clamp(1 - keyword.competition),
          confidence: 0.7,
          evidenceRefs: keyword.evidenceRefs,
        }),
      );
    }
  }

  return deduplicateMarketSignals(derived);
}