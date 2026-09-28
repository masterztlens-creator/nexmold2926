import type {
  DiscoveryCandidate,
  DiscoveryProvider,
} from "./types.js";

const TRACKING_PARAMETERS = new Set([
  "gclid",
  "fbclid",
  "msclkid",
]);

export function canonicalizeUrl(input: string): string {
  const raw = input.trim();

  if (!raw) {
    throw new Error("URL must not be empty");
  }

  const url = new URL(raw);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("URL must use HTTP or HTTPS");
  }

  url.hash = "";
  url.hostname = url.hostname.toLowerCase();

  for (const key of [...url.searchParams.keys()]) {
    const normalizedKey = key.toLowerCase();

    if (
      normalizedKey.startsWith("utm_") ||
      TRACKING_PARAMETERS.has(normalizedKey)
    ) {
      url.searchParams.delete(key);
    }
  }

  if (
    (url.protocol === "https:" && url.port === "443") ||
    (url.protocol === "http:" && url.port === "80")
  ) {
    url.port = "";
  }

  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/g, "");
  }

  return url.toString();
}

export function discoverInternetSources(
  query: string,
  provider: DiscoveryProvider,
  limit = 20,
): DiscoveryCandidate[] {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    throw new Error("Discovery query must not be empty");
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("Discovery limit must be an integer between 1 and 100");
  }

  /*
   * Provider-neutral boundary.
   *
   * The V8 research layer deliberately does not fabricate Internet
   * search results. An actual Internet provider/adapter must supply
   * concrete URLs and pass them through this boundary.
   */
  void provider;

  return [];
}

export function mergeDiscoveryCandidates(
  candidates: DiscoveryCandidate[],
): DiscoveryCandidate[] {
  const result: DiscoveryCandidate[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const canonicalUrl = canonicalizeUrl(candidate.url);

    if (seen.has(canonicalUrl)) {
      continue;
    }

    seen.add(canonicalUrl);

    result.push({
      ...candidate,
      canonicalUrl,
    });
  }

  return result;
}