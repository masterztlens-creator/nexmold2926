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
  readonly trafficPotential: number;
  readonly evidenceConfidence: number;
  readonly signalCount: number;
}

const SIGNAL_TYPE_WEIGHT: Readonly<Record<GrowthSignalType, number>> = {
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
  "injection molding",
  "mold making",
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
  "request quote",
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

  return `${(hashA >>> 0).toString(16).padStart(8, "0")}${(
    hashB >>> 0
  )
    .toString(16)
    .padStart(8, "0")}`;
}

function normalizeMetadata(
  metadata: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, import("../shared.js").JsonValue>> {
  if (!metadata) {
    return {};
  }

  const output: Record<string, import("../shared.js").JsonValue> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      output[key] = value;
      continue;
    }

    if (Array.isArray(value)) {
      const normalizedArray = value.filter(
        (item): item is string | number | boolean | null =>
          item === null ||
          typeof item === "string" ||
          typeof item === "number" ||
          typeof item === "boolean",
      );

      output[key] = normalizedArray;
      continue;
    }

    if (typeof value === "object") {
      const nested: Record<string, import("../shared.js").JsonValue> = {};

      for (const [nestedKey, nestedValue] of Object.entries(
        value as Record<string, unknown>,
      )) {
        if (
          nestedValue === null ||
          typeof nestedValue === "string" ||
          typeof nestedValue === "number" ||
          typeof nestedValue === "boolean"
        ) {
          nested[nestedKey] = nestedValue;
        }
      }

      output[key] = nested;
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

function createSignalId(input: MarketSignalInput): string {
  const canonical = [
    input.type,
    normalizeSignalSubject(input.subject),
    normalizeText(input.source),
    normalizeText(input.marketId ?? ""),
    normalizeText(input.industryId ?? ""),
    String(input.value ?? 0),
    [...(input.evidenceRefs ?? [])]
      .map(normalizeText)
      .sort()
      .join("|"),
  ].join("::");

  return `signal:v8:${stableHash(canonical)}`;
}

function normalizeSignalValue(value: number | undefined): number {
  if (!Number.isFinite(value ?? 0)) {
    return 0;
  }

  return clamp(value ?? 0);
}

function normalizeConfidence(value: number | undefined): number {
  if (!Number.isFinite(value ?? 0)) {
    return 0;
  }

  return clamp(value ?? 0);
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

  for (const phraseTerm of COMMERCIAL_TERMS) {
    if (phrase.includes(phraseTerm)) {
      score += 0.1;
    }
  }

  const intent = inferIntent(normalized);

  if (intent === "TRANSACTIONAL") {
    score += 0.3;
  } else if (intent === "COMMERCIAL") {
    score += 0.2;
  } else if (intent === "COMPARISON") {
    score += 0.08;
  }

  return clamp(score);
}

function subjectTokenSet(subject: string): Set<string> {
  return new Set(
    tokenize(subject).filter(
      (token) => token.length > 1 && !GENERIC_STOP_TERMS.has(token),
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
  const matching = signals.filter((signal) => signal.type === type);

  if (matching.length === 0) {
    return 0;
  }

  let numerator = 0;
  let denominator = 0;

  for (const signal of matching) {
    const weight =
      SIGNAL_TYPE_WEIGHT[signal.type] * Math.max(signal.confidence, 0.01);

    numerator += signal.value * weight;
    denominator += weight;
  }

  return denominator === 0 ? 0 : clamp(numerator / denominator);
}

function averageConfidence(signals: readonly GrowthSignal[]): number {
  if (signals.length === 0) {
    return 0;
  }

  const weighted = signals.reduce(
    (total, signal) => total + signal.confidence,
    0,
  );

  return clamp(weighted / signals.length);
}

function capabilityFitForSubject(
  subject: string,
  industry: IndustryProfile,
): number {
  const subjectTokens = subjectTokenSet(subject);

  if (subjectTokens.size === 0) {
    return 0;
  }

  const capabilityTokens = new Set(
    [
      ...industry.capabilities,
      ...industry.products,
      ...industry.services,
    ].flatMap(subjectTokenSet),
  );

  if (capabilityTokens.size === 0) {
    return 0;
  }

  let matched = 0;

  for (const token of subjectTokens) {
    if (capabilityTokens.has(token)) {
      matched += 1;
    }
  }

  return clamp(matched / Math.max(subjectTokens.size, 1));
}

function marketFitForSubject(
  subject: string,
  market: MarketProfile,
): number {
  const subjectTokens = subjectTokenSet(subject);

  if (subjectTokens.size === 0) {
    return 0;
  }

  const marketTokens = new Set(
    [
      market.name,
      market.region ?? "",
      market.country ?? "",
      market.language ?? "",
      ...market.audienceSegments,
    ].flatMap(subjectTokenSet),
  );

  if (marketTokens.size === 0) {
    return 0;
  }

  let matched = 0;

  for (const token of subjectTokens) {
    if (marketTokens.has(token)) {
      matched += 1;
    }
  }

  return clamp(matched / Math.max(subjectTokens.size, 1));
}

function normalizeSignal(signal: GrowthSignal): GrowthSignal {
  return {
    ...signal,
    subject: normalizeText(signal.subject),
    normalizedSubject: normalizeSignalSubject(signal.subject),
    value: normalizeSignalValue(signal.value),
    confidence: normalizeConfidence(signal.confidence),
    evidenceRefs: uniqueStrings(signal.evidenceRefs),
    metadata: normalizeMetadata(signal.metadata),
  };
}

export function createMarketSignal(input: MarketSignalInput): GrowthSignal {
  const subject = normalizeText(input.subject);

  if (!subject) {
    throw new Error("V8 market signal requires a non-empty subject");
  }

  if (!input.type) {
    throw new Error("V8 market signal requires a signal type");
  }

  if (!normalizeText(input.source)) {
    throw new Error("V8 market signal requires a source");
  }

  const observedAt = input.observedAt ?? new Date().toISOString();

  if (Number.isNaN(Date.parse(observedAt))) {
    throw new Error("V8 market signal observedAt must be a valid timestamp");
  }

  const signal: GrowthSignal = {
    signalId:
      input.signalId ??
      createSignalId({
        ...input,
        subject,
        observedAt,
      }),
    type: input.type,
    source: normalizeText(input.source),
    observedAt,
    subject,
    normalizedSubject: normalizeSignalSubject(subject),
    marketId: input.marketId ? normalizeText(input.marketId) : undefined,
    industryId: input.industryId
      ? normalizeText(input.industryId)
      : undefined,
    value: normalizeSignalValue(input.value),
    confidence: normalizeConfidence(input.confidence ?? 1),
    evidenceRefs: uniqueStrings(input.evidenceRefs ?? []),
    metadata: normalizeMetadata(input.metadata),
  };

  return normalizeSignal(signal);
}

export function buildMarketSignalSet(
  signals: readonly GrowthSignal[],
): MarketSignalSet {
  const normalizedSignals = signals
    .map(normalizeSignal)
    .sort(
      (left, right) =>
        left.signalId.localeCompare(right.signalId) ||
        left.normalizedSubject.localeCompare(right.normalizedSubject),
    );

  const byType: Partial<
    Record<GrowthSignalType, readonly GrowthSignal[]>
  > = {};

  const byMarket: Record<string, GrowthSignal[]> = {};
  const bySubject: Record<string, GrowthSignal[]> = {};

  for (const signal of normalizedSignals) {
    const existingByType = byType[signal.type] ?? [];
    byType[signal.type] = [...existingByType, signal];

    if (signal.marketId) {
      const existingByMarket = byMarket[signal.marketId] ?? [];
      byMarket[signal.marketId] = [...existingByMarket, signal];
    }

    const existingBySubject = bySubject[signal.normalizedSubject] ?? [];
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

  for (const signal of signals) {
    const normalized = normalizeSignal(signal);
    const key = [
      normalized.type,
      normalized.normalizedSubject,
      normalized.source,
      normalized.marketId ?? "",
      normalized.industryId ?? "",
      normalized.value.toFixed(6),
      normalized.evidenceRefs.join("|"),
    ].join("::");

    const existing = seen.get(key);

    if (!existing || normalized.confidence > existing.confidence) {
      seen.set(key, normalized);
    }
  }

  return [...seen.values()].sort((left, right) =>
    left.signalId.localeCompare(right.signalId),
  );
}

export function mergeMarketSignals(
  ...sets: readonly (readonly GrowthSignal[])[]
): GrowthSignal[] {
  return deduplicateMarketSignals(sets.flat());
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

  const scopedSignals = normalizedSubject
    ? signals
        .filter(
          (signal) =>
            signal.normalizedSubject === normalizedSubject ||
            tokenSimilarity(signal.subject, normalizedSubject) >= 0.4,
        )
        .sort(
          (left, right) =>
            tokenSimilarity(right.subject, normalizedSubject) -
            tokenSimilarity(left.subject, normalizedSubject),
        )
        .slice(0, 100)
    : [...signals];

  const demand = aggregateSignalValue(scopedSignals, "SEARCH_DEMAND");
  const growth = aggregateSignalValue(scopedSignals, "SEARCH_GROWTH");
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
  const traffic = aggregateSignalValue(scopedSignals, "TRAFFIC");
  const engagement = aggregateSignalValue(
    scopedSignals,
    "ENGAGEMENT",
  );
  const inquiry = aggregateSignalValue(scopedSignals, "INQUIRY");
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
    commercialSignal * 0.65 + inferredCommercial * 0.35,
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
      ? capabilityFitForSubject(normalizedSubject, industry)
      : aggregateSignalValue(scopedSignals, "CAPABILITY_FIT");

  const marketCapabilityFit =
    normalizedSubject && market
      ? marketFitForSubject(normalizedSubject, market)
      : 0;

  const normalizedCapabilityFit = clamp(
    capabilityFit * 0.7 + marketCapabilityFit * 0.3,
  );

  return {
    demand,
    growth,
    competition: clamp(1 - competitorGap),
    contentGap,
    commercialIntent,
    capabilityFit: normalizedCapabilityFit,
    conversionPotential,
    evidenceConfidence: averageConfidence(scopedSignals),
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
  const groups = new Map<string, GrowthSignal[]>();

  for (const signal of signals) {
    const normalized = normalizeSignal(signal);
    const existing = groups.get(normalized.normalizedSubject) ?? [];
    groups.set(normalized.normalizedSubject, [...existing, normalized]);
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

      return {
        subject:
          subjectSignals
            .slice()
            .sort((a, b) => a.subject.localeCompare(b.subject))[0]
            ?.subject ?? normalizedSubject,
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
      left.normalizedSubject.localeCompare(right.normalizedSubject),
  );
}

export function filterSignalsForIndustry(
  signals: readonly GrowthSignal[],
  industry: IndustryProfile,
): readonly GrowthSignal[] {
  const industryId = normalizeText(industry.industryId);

  return signals.filter((signal) => {
    if (signal.industryId && signal.industryId === industryId) {
      return true;
    }

    if (signal.industryId && signal.industryId !== industryId) {
      return false;
    }

    const subjectTokens = subjectTokenSet(signal.subject);

    if (subjectTokens.size === 0) {
      return false;
    }

    const capabilityTokens = new Set(
      [
        ...industry.capabilities,
        ...industry.products,
        ...industry.services,
        ...industry.targetAudiences,
        ...industry.targetMarkets,
      ].flatMap(subjectTokenSet),
    );

    if (capabilityTokens.size === 0) {
      return true;
    }

    let matches = 0;

    for (const token of subjectTokens) {
      if (capabilityTokens.has(token)) {
        matches += 1;
      }
    }

    return matches > 0;
  });
}

export function filterSignalsForMarket(
  signals: readonly GrowthSignal[],
  market: MarketProfile,
): readonly GrowthSignal[] {
  const marketId = normalizeText(market.marketId);

  return signals.filter((signal) => {
    if (signal.marketId) {
      return signal.marketId === marketId;
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
  });
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

    const source = keyword.source ?? "V8_KEYWORD_UNIVERSE";

    if (keyword.demand !== undefined) {
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

    if (keyword.growth !== undefined) {
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

    if (keyword.commercialIntent !== undefined) {
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

    if (keyword.competition !== undefined) {
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