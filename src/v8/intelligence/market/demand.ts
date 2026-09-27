import {
  immutable,
  invariant,
} from "../../constitution/invariants.js";

import {
  canonicalize,
  nonEmpty,
  observationId,
  sortedUnique,
  type Fingerprint,
  type ObservationId,
} from "../../domain/primitives.js";

import {
  contentFingerprint,
} from "../../foundation/hash.js";

import type {
  SearchIntent,
} from "../shared.js";

export type MarketDemandId =
  string & {
    readonly __brand: "MarketDemandId";
  };

export type MarketDemandUncertainty =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "UNKNOWN";

export type DemandSignalType =
  | "QUERY_FREQUENCY"
  | "QUERY_VARIATION"
  | "RELATED_QUERY"
  | "AI_QUESTION"
  | "COMPETITOR_SIGNAL"
  | "PROBLEM_SIGNAL"
  | "ENTITY_SIGNAL"
  | "COVERAGE_SIGNAL"
  | "OTHER";

export interface MarketDemandQueryObservation {
  readonly id: ObservationId;
  readonly query: string;
  readonly normalizedQuery: string;
  readonly source:
    | "SEARCH"
    | "AI"
    | "RELATED"
    | "COMPETITOR"
    | "DISCOVERY"
    | "SEED";
  readonly intent: SearchIntent;
  readonly language: string;
  readonly market: string;
  readonly observedAt: string;
}

export interface MarketDemandSignal {
  readonly type: DemandSignalType;
  readonly value: string;
  readonly sourceObservationIds: readonly ObservationId[];
}

export interface MarketDemand {
  readonly id: MarketDemandId;
  readonly market: string;
  readonly geography: string;
  readonly language: string;
  readonly audience: string;
  readonly problem: string;
  readonly intent: SearchIntent;
  readonly entities: readonly string[];
  readonly queryObservations:
    readonly MarketDemandQueryObservation[];
  readonly demandSignals:
    readonly MarketDemandSignal[];
  readonly existingCoverage:
    readonly string[];
  readonly uncertainty: MarketDemandUncertainty;
  readonly fingerprint: Fingerprint;
}

function marketDemandId(value: string): MarketDemandId {
  return nonEmpty(value, "MarketDemandId") as MarketDemandId;
}

function normalizeQuery(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function validIsoTimestamp(
  value: string,
  field: string,
): string {
  const normalized = nonEmpty(value, field);

  invariant(
    !Number.isNaN(Date.parse(normalized)),
    "V8_MARKET_DEMAND_INVALID_TIMESTAMP",
    `${field} must be a valid ISO-compatible timestamp.`,
  );

  return normalized;
}

function validateObservation(
  observation: MarketDemandQueryObservation,
): MarketDemandQueryObservation {
  const query = nonEmpty(
    observation.query,
    "MarketDemandQueryObservation.query",
  );

  const normalizedQuery = normalizeQuery(query);

  invariant(
    normalizedQuery ===
      observation.normalizedQuery,
    "V8_MARKET_DEMAND_QUERY_NORMALIZATION",
    "Market-demand query observation must contain its canonical normalized query.",
  );

  invariant(
    observation.language.trim().length > 0,
    "V8_MARKET_DEMAND_EMPTY_LANGUAGE",
    "Market-demand query observation language cannot be empty.",
  );

  invariant(
    observation.market.trim().length > 0,
    "V8_MARKET_DEMAND_EMPTY_MARKET",
    "Market-demand query observation market cannot be empty.",
  );

  return {
    ...observation,
    id: observationId(String(observation.id)),
    query,
    normalizedQuery,
    language: observation.language.trim(),
    market: observation.market.trim(),
    observedAt: validIsoTimestamp(
      observation.observedAt,
      "MarketDemandQueryObservation.observedAt",
    ),
  };
}

function validateSignals(
  signals: readonly MarketDemandSignal[],
  observationIds: ReadonlySet<string>,
): readonly MarketDemandSignal[] {
  return signals.map((signal) => {
    const value = nonEmpty(
      signal.value,
      "MarketDemandSignal.value",
    );

    const sourceObservationIds = sortedUnique(
      signal.sourceObservationIds.map(String),
    ).map(observationId);

    for (const sourceId of sourceObservationIds) {
      invariant(
        observationIds.has(String(sourceId)),
        "V8_MARKET_DEMAND_SIGNAL_UNKNOWN_OBSERVATION",
        `Demand signal references unknown observation: ${String(sourceId)}.`,
      );
    }

    return immutable({
      type: signal.type,
      value,
      sourceObservationIds,
    });
  });
}

export interface CreateMarketDemandInput
  extends Omit<
    MarketDemand,
    "fingerprint"
  > {
  readonly fingerprint?: Fingerprint;
}

export function createMarketDemand(
  input: CreateMarketDemandInput,
): Readonly<MarketDemand> {
  const id = marketDemandId(String(input.id));

  const market = nonEmpty(
    input.market,
    "MarketDemand.market",
  );

  const geography = nonEmpty(
    input.geography,
    "MarketDemand.geography",
  );

  const language = nonEmpty(
    input.language,
    "MarketDemand.language",
  );

  const audience = nonEmpty(
    input.audience,
    "MarketDemand.audience",
  );

  const problem = nonEmpty(
    input.problem,
    "MarketDemand.problem",
  );

  const entities = sortedUnique(
    input.entities,
  );

  const observations = input.queryObservations.map(
    validateObservation,
  );

  invariant(
    observations.length > 0,
    "V8_MARKET_DEMAND_NO_OBSERVATIONS",
    "MarketDemand requires at least one query observation.",
  );

  const observationIds = new Set(
    observations.map((observation) =>
      String(observation.id),
    ),
  );

  const signals = validateSignals(
    input.demandSignals,
    observationIds,
  );

  const existingCoverage = sortedUnique(
    input.existingCoverage,
  );

  const canonical = {
    id,
    market,
    geography,
    language,
    audience,
    problem,
    intent: input.intent,
    entities,
    queryObservations: observations,
    demandSignals: signals,
    existingCoverage,
    uncertainty: input.uncertainty,
  };

  const computedFingerprint =
    contentFingerprint(canonicalize(canonical));

  if (input.fingerprint !== undefined) {
    invariant(
      String(input.fingerprint) ===
        String(computedFingerprint),
      "V8_MARKET_DEMAND_FINGERPRINT_MISMATCH",
      "MarketDemand fingerprint does not match canonical content.",
    );
  }

  return immutable({
    ...canonical,
    fingerprint: computedFingerprint,
  });
}