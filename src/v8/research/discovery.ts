import type {
  DiscoveryCandidate,
  DiscoveryProvider,
} from "./types.js";

const TRACKING_PARAMETERS = new Set([
  "gclid",
  "fbclid",
  "msclkid",
]);

/**
 * Canonicalize an Internet URL for Research-layer identity.
 *
 * This function is intentionally limited to URL identity.
 * It does not fetch the URL, infer content, or fabricate
 * discovery provenance.
 */
export function canonicalizeUrl(
  input: string,
): string {
  const raw = input.trim();

  if (!raw) {
    throw new Error(
      "URL must not be empty",
    );
  }

  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      "URL must be valid",
    );
  }

  if (
    url.protocol !== "http:" &&
    url.protocol !== "https:"
  ) {
    throw new Error(
      "URL must use HTTP or HTTPS",
    );
  }

  url.hash = "";
  url.hostname =
    url.hostname.toLowerCase();

  for (
    const key of [
      ...url.searchParams.keys(),
    ]
  ) {
    const normalizedKey =
      key.toLowerCase();

    if (
      normalizedKey.startsWith(
        "utm_",
      ) ||
      TRACKING_PARAMETERS.has(
        normalizedKey,
      )
    ) {
      url.searchParams.delete(
        key,
      );
    }
  }

  if (
    (url.protocol === "https:" &&
      url.port === "443") ||
    (url.protocol === "http:" &&
      url.port === "80")
  ) {
    url.port = "";
  }

  if (
    url.pathname.length > 1
  ) {
    url.pathname =
      url.pathname.replace(
        /\/+$/g,
        "",
      );
  }

  return url.toString();
}

/**
 * Normalize one externally observed URL into the unified
 * Research DiscoveryCandidate contract.
 *
 * This function does not invent a URL. The URL must already
 * have been observed by an upstream discovery mechanism.
 */
export function createDiscoveryCandidate(
  input: {
    readonly url: string;
    readonly provider: DiscoveryProvider;
    readonly kind:
      | "SEED"
      | "LINK"
      | "SITEMAP"
      | "SERP_RESULT"
      | "REFERENCE";
    readonly discoveredAt: string;
    readonly sourceUrl?: string;
    readonly title?: string;
  },
): DiscoveryCandidate | null {
  let normalizedUrl: string;

  try {
    normalizedUrl =
      canonicalizeUrl(
        input.url,
      );
  } catch {
    return null;
  }

  const discoveredAt =
    input.discoveredAt.trim();

  if (!discoveredAt) {
    return null;
  }

  const sourceUrl =
    input.sourceUrl?.trim();

  const title =
    input.title?.trim();

  return Object.freeze({
    url:
      input.url.trim(),

    normalizedUrl,

    kind:
      input.kind,

    provider:
      input.provider,

    discoveredAt,

    ...(sourceUrl
      ? {
          sourceUrl,
        }
      : {}),

    ...(title
      ? {
          title,
        }
      : {}),
  });
}

/**
 * Merge Research DiscoveryCandidates deterministically.
 *
 * Candidate identity is the canonical URL.
 *
 * The first valid observation wins so that provenance is
 * deterministic and is not silently replaced by a later
 * duplicate observation.
 */
export function mergeDiscoveryCandidates(
  candidates: readonly DiscoveryCandidate[],
): DiscoveryCandidate[] {
  const result: DiscoveryCandidate[] =
    [];

  const seen =
    new Set<string>();

  for (
    const candidate of candidates
  ) {
    let normalizedUrl: string;

    try {
      normalizedUrl =
        canonicalizeUrl(
          candidate.url,
        );
    } catch {
      continue;
    }

    if (
      seen.has(
        normalizedUrl,
      )
    ) {
      continue;
    }

    seen.add(
      normalizedUrl,
    );

    result.push(
      Object.freeze({
        ...candidate,
        normalizedUrl,
      }),
    );
  }

  return result;
}

/**
 * Provider-neutral discovery boundary.
 *
 * The Research layer deliberately does not fabricate search
 * results. A concrete Internet discovery adapter must observe
 * real URLs and convert them through createDiscoveryCandidate().
 *
 * This function remains an explicit fail-closed boundary until
 * a concrete adapter is connected.
 */
export function discoverInternetSources(
  query: string,
  provider: DiscoveryProvider,
  limit = 20,
): DiscoveryCandidate[] {
  const normalizedQuery =
    query.trim();

  if (!normalizedQuery) {
    throw new Error(
      "Discovery query must not be empty",
    );
  }

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new Error(
      "Discovery limit must be an integer between 1 and 100",
    );
  }

  /*
   * Provider is retained as part of the explicit boundary.
   *
   * This function must not invent Internet URLs merely from
   * query text. Until an actual discovery adapter is supplied,
   * returning no candidates is the fail-closed behavior.
   */
  void provider;

  return [];
}