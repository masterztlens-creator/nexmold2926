import type { EngineeringDecision } from "./contracts.js";

export interface GeoCompilation {
  answer: string;
  evidenceAnchors: readonly string[];
  entitySignals: readonly string[];
}

export function compileGeo(decision: EngineeringDecision, entities: readonly string[]): Readonly<GeoCompilation> {
  return Object.freeze({
    answer: decision.statement,
    evidenceAnchors: Object.freeze([...decision.evidenceIds]),
    entitySignals: Object.freeze([...entities]),
  });
}
