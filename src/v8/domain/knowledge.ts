import { immutable, invariant, requireKnown } from "../constitution/invariants.js";
import { claimId, knowledgeId, nonEmpty, stableFingerprint, type ClaimId, type Fingerprint, type KnowledgeId } from "./primitives.js";

export type KnowledgeStatus = "APPROVED" | "REJECTED" | "UNKNOWN";
export interface Knowledge { readonly id: KnowledgeId; readonly proposition: string; readonly claimIds: readonly ClaimId[]; readonly status: Exclude<KnowledgeStatus, "UNKNOWN">; readonly fingerprint: Fingerprint; }
export function createKnowledge(input: Omit<Knowledge, "id" | "fingerprint"> & { id?: string }): Readonly<Knowledge> {
  const status = requireKnown(input.status, "V8_KNOWLEDGE_UNKNOWN", "knowledge.status");
  invariant(input.claimIds.length > 0, "V8_KNOWLEDGE_NO_CLAIM", "Knowledge must derive from at least one claim.");
  const claimIds = immutable([...new Set(input.claimIds.map(claimId))].sort());
  const fp = stableFingerprint({ proposition: input.proposition, claimIds, status });
  return immutable({ id: knowledgeId(input.id ?? `knowledge:${fp}`), proposition: nonEmpty(input.proposition, "knowledge.proposition"), claimIds, status, fingerprint: fp });
}
