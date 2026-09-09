
import { normalizeDiscoveryUrl } from "../web-discovery/candidate-normalizer.js";
import type { NormalizedSerp, SerpQuery, SerpRawResult, SerpResultType } from "./types.js";

function domain(url: string): string { try { return new URL(url).hostname.toLowerCase(); } catch { return ""; } }
function resultType(type: SerpResultType | undefined): SerpResultType { return type ?? "ORGANIC"; }

export function normalizeSerpResults(query: SerpQuery, provider: string, rawResults: readonly SerpRawResult[], retrievedAt = new Date().toISOString()): NormalizedSerp {
  const seen = new Set<string>();
  const results: NormalizedSerp["results"][number][] = [];
  for (let i = 0; i < rawResults.length; i++) {
    const raw = rawResults[i];
    const url = normalizeDiscoveryUrl(raw.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const position = Number.isInteger(raw.position) && (raw.position ?? 0) > 0 ? raw.position! : i + 1;
    const features = [...new Set((raw.features ?? []).map(x => x.trim()).filter(Boolean))];
    results.push({ query: query.query, position, url, domain: raw.domain?.trim().toLowerCase() || domain(url), title: raw.title.trim(), snippet: raw.snippet?.trim() ?? "", resultType: resultType(raw.type), features: Object.freeze(features) });
  }
  results.sort((a, b) => a.position - b.position);
  return Object.freeze({ query, provider, retrievedAt, results: Object.freeze(results) });
}
