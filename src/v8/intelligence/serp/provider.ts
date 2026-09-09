
import { normalizeSerpResults } from "./normalizer.js";
import type { NormalizedSerp, SerpProvider, SerpQuery } from "./types.js";

export async function querySerp(provider: SerpProvider, query: SerpQuery): Promise<NormalizedSerp> {
  const normalizedQuery = { ...query, query: query.query.trim() };
  if (!normalizedQuery.query) throw new Error("SERP_QUERY_EMPTY");
  const rawResults = await provider.search(normalizedQuery);
  return normalizeSerpResults(normalizedQuery, provider.name, rawResults);
}
