export * from "./types.js";
export * from "./engine.js";

export {
  createMarketSignal,
  buildMarketSignalSet,
  deduplicateMarketSignals,
  mergeMarketSignals,
  summarizeMarketSignals,
  rankSignalSubjects,
  filterSignalsForIndustry,
  filterSignalsForMarket,
  createDerivedMarketSignals,
} from "../market/signals.js";

export {
  DEFAULT_NICHE_SCORE_WEIGHTS,
  calculateNicheScore,
  scoreNiche,
  createNicheOpportunity,
  assertNicheOpportunityInvariant,
  compareNicheOpportunities,
} from "../niche/scoring.js";

export {
  discoverNicheClusters,
  discoverNiches,
  assertNicheDiscoveryResult,
  rankDiscoveredNiches,
} from "../niche/discovery.js";