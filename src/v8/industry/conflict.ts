import { contentFingerprint } from "../foundation/hash.js";
export type ConflictStatus = "NO_CONFLICT" | "SCOPE_SPLIT" | "TEMPORAL_SPLIT" | "EVIDENCE_CONFLICT" | "UNRESOLVED";
export interface ClaimObservation { readonly claimId: string; readonly conflictKey: string; readonly proposition: string; readonly value: string; readonly scope?: string; readonly validFrom?: string; readonly validTo?: string; readonly evidenceIds: readonly string[]; }
export interface ConflictSet { readonly key: string; readonly claimIds: readonly string[]; readonly status: ConflictStatus; readonly fingerprint: string; }
export function resolveClaimConflicts(claims: readonly ClaimObservation[]): readonly ConflictSet[] {
  const groups = new Map<string, ClaimObservation[]>();
  for (const c of claims) { const key = c.conflictKey.trim(); if (!key) throw new Error("V8_CONFLICT_KEY_REQUIRED"); const a = groups.get(key) ?? []; a.push(c); groups.set(key, a); }
  const out: ConflictSet[] = [];
  for (const [key, group] of groups) {
    const values = new Set(group.map(c => c.value.trim()));
    let status: ConflictStatus = values.size <= 1 ? "NO_CONFLICT" : "UNRESOLVED";
    if (values.size > 1) {
      const scopes = new Set(group.map(c => c.scope ?? ""));
      const intervals = group.map(c => `${c.validFrom ?? ""}/${c.validTo ?? ""}`);
      if (scopes.size > 1 && group.every(c => c.scope !== undefined)) status = "SCOPE_SPLIT";
      else if (new Set(intervals).size > 1 && group.every(c => c.validFrom !== undefined || c.validTo !== undefined)) status = "TEMPORAL_SPLIT";
      else if (group.some(c => c.evidenceIds.length > 0)) status = "EVIDENCE_CONFLICT";
    }
    out.push(Object.freeze({ key, claimIds: Object.freeze(group.map(c => c.claimId).sort()), status, fingerprint: contentFingerprint({ key, claimIds: group.map(c => c.claimId).sort(), status }) }));
  }
  return Object.freeze(out);
}
