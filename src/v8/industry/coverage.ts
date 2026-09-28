import type { IndustryModel } from "./model.js";
import { contentFingerprint } from "../foundation/hash.js";
import type { Fingerprint } from "../domain/primitives.js";

export interface CoverageObservation { readonly nodeId: string; readonly evidence: number; readonly knowledge: number; readonly problems: number; readonly decisions: number; readonly freshness: number; }
export interface CoverageRecord extends CoverageObservation { readonly score: number; readonly gap: boolean; }
export interface CoverageSnapshot { readonly industryFingerprint: Fingerprint; readonly threshold: number; readonly records: readonly CoverageRecord[]; readonly overall: number; readonly fingerprint: Fingerprint; }

function bounded(n: number): number { return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0; }
export function buildCoverageSnapshot(model: IndustryModel, observations: readonly CoverageObservation[], threshold = 0.75): Readonly<CoverageSnapshot> {
  if (!(threshold > 0 && threshold <= 1)) throw new Error("V8_COVERAGE_THRESHOLD_INVALID");
  const byId = new Map(observations.map((o) => [o.nodeId, o]));
  const records = model.nodes.map((node) => {
    const o = byId.get(node.id) ?? { nodeId: node.id, evidence: 0, knowledge: 0, problems: 0, decisions: 0, freshness: 0 };
    const score = (bounded(o.evidence) + bounded(o.knowledge) + bounded(o.problems) + bounded(o.decisions) + bounded(o.freshness)) / 5;
    return Object.freeze({ ...o, score, gap: score < threshold });
  });
  const overall = records.length ? records.reduce((s, r) => s + r.score, 0) / records.length : 0;
  const fingerprint = contentFingerprint({ industry: model.fingerprint, threshold, records, overall });
  return Object.freeze({ industryFingerprint: model.fingerprint, threshold, records: Object.freeze(records), overall, fingerprint });
}
