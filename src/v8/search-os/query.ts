import type { QueryCandidate } from "./contracts.js";

export function normalizeQuery(rawQuery: string): string {
  return rawQuery.trim().toLowerCase().replace(/\s+/g, " ");
}

export function createQueryCandidate(input: Omit<QueryCandidate, "normalizedQuery">): Readonly<QueryCandidate> {
  if (!input.rawQuery.trim()) throw new Error("V8_QUERY_EMPTY");
  if (!/^\d{4}-\d{2}-\d{2}T/.test(input.observedAt)) throw new Error("V8_QUERY_TIMESTAMP_INVALID");
  return Object.freeze({ ...input, normalizedQuery: normalizeQuery(input.rawQuery) });
}
