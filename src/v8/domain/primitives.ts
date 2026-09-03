import { immutable, invariant } from "../constitution/invariants.js";

export type Brand<T, B extends string> = T & { readonly __brand: B };
export type SourceId = Brand<string, "SourceId">;
export type EvidenceId = Brand<string, "EvidenceId">;
export type ClaimId = Brand<string, "ClaimId">;
export type EntityId = Brand<string, "EntityId">;
export type KnowledgeId = Brand<string, "KnowledgeId">;
export type ScopeId = Brand<string, "ScopeId">;
export type ContextId = Brand<string, "ContextId">;
export type ProblemId = Brand<string, "ProblemId">;
export type DecisionId = Brand<string, "DecisionId">;
export type ContentId = Brand<string, "ContentId">;
export type Fingerprint = Brand<string, "Fingerprint">;

export type KnownState = "KNOWN" | "UNKNOWN";

function branded<T extends string>(value: T, label: string): T {
  invariant(value.trim().length > 0, "V8_EMPTY_ID", `${label} cannot be empty.`);
  return value;
}
export const sourceId = (v: string) => branded(v, "SourceId") as SourceId;
export const evidenceId = (v: string) => branded(v, "EvidenceId") as EvidenceId;
export const claimId = (v: string) => branded(v, "ClaimId") as ClaimId;
export const entityId = (v: string) => branded(v, "EntityId") as EntityId;
export const knowledgeId = (v: string) => branded(v, "KnowledgeId") as KnowledgeId;
export const scopeId = (v: string) => branded(v, "ScopeId") as ScopeId;
export const contextId = (v: string) => branded(v, "ContextId") as ContextId;
export const problemId = (v: string) => branded(v, "ProblemId") as ProblemId;
export const decisionId = (v: string) => branded(v, "DecisionId") as DecisionId;
export const contentId = (v: string) => branded(v, "ContentId") as ContentId;
export const fingerprint = (v: string) => branded(v, "Fingerprint") as Fingerprint;

export function nonEmpty(value: string, field: string): string {
  invariant(typeof value === "string" && value.trim().length > 0, "V8_INVALID_TEXT", `${field} must be non-empty.`);
  return value.trim();
}

export function sortedUnique(values: readonly string[], field: string): readonly string[] {
  invariant(values.every(v => typeof v === "string" && v.trim().length > 0), "V8_INVALID_SET", `${field} contains an empty value.`);
  return immutable([...new Set(values)].sort());
}

export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonicalize(v)]));
  }
  return value;
}

export function stableFingerprint(value: unknown): Fingerprint {
  const input = JSON.stringify(canonicalize(value));
  let h = 14695981039346656037n;
  for (const byte of new TextEncoder().encode(input)) {
    h ^= BigInt(byte);
    h = BigInt.asUintN(64, h * 1099511628211n);
  }
  return fingerprint(h.toString(16).padStart(16, "0"));
}
