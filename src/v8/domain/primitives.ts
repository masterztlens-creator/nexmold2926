import { invariant } from "../constitution/invariants.js";

export type Brand<T, B extends string> = T & {
  readonly __brand: B;
};

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
export type ObservationId = Brand<string, "ObservationId">;
export type Fingerprint = Brand<string, "Fingerprint">;

export type KnownState = "KNOWN" | "UNKNOWN";

function branded(v: string, label: string): string {
  invariant(
    typeof v === "string" && v.trim().length > 0,
    "V8_EMPTY_ID",
    `${label} cannot be empty.`,
  );

  return v;
}

export const sourceId = (v: string) =>
  branded(v, "SourceId") as SourceId;

export const evidenceId = (v: string) =>
  branded(v, "EvidenceId") as EvidenceId;

export const claimId = (v: string) =>
  branded(v, "ClaimId") as ClaimId;

export const entityId = (v: string) =>
  branded(v, "EntityId") as EntityId;

export const knowledgeId = (v: string) =>
  branded(v, "KnowledgeId") as KnowledgeId;

export const scopeId = (v: string) =>
  branded(v, "ScopeId") as ScopeId;

export const contextId = (v: string) =>
  branded(v, "ContextId") as ContextId;

export const problemId = (v: string) =>
  branded(v, "ProblemId") as ProblemId;

export const decisionId = (v: string) =>
  branded(v, "DecisionId") as DecisionId;

export const contentId = (v: string) =>
  branded(v, "ContentId") as ContentId;

export const observationId = (v: string) =>
  branded(v, "ObservationId") as ObservationId;

export const fingerprint = (v: string) =>
  branded(v, "Fingerprint") as Fingerprint;

export function nonEmpty(
  v: string,
  field: string,
): string {
  invariant(
    typeof v === "string" && v.trim().length > 0,
    "V8_EMPTY_FIELD",
    `${field} cannot be empty.`,
  );

  return v.trim();
}

export function sortedUnique(
  values: readonly string[],
): readonly string[] {
  return [
    ...new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  ].sort();
}

export function canonicalize(
  v: unknown,
): unknown {
  if (Array.isArray(v)) {
    return v.map(canonicalize);
  }

  if (
    v !== null &&
    typeof v === "object"
  ) {
    const object = v as Record<string, unknown>;

    return Object.fromEntries(
      Object.keys(object)
        .sort()
        .map((key) => [
          key,
          canonicalize(object[key]),
        ]),
    );
  }

  return v;
}