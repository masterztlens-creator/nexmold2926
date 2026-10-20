import {
  evaluateSourceUrl,
} from "../../acquisition/source-policy.js";

import {
  createDiscoveryCandidate,
} from "./discovery.js";

import type {
  DiscoveryCandidate,
} from "./types.js";

export interface BootstrapSource {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly terms: readonly string[];
  readonly authority:
    | "AUTHORITATIVE_STANDARD"
    | "OFFICIAL_PRIMARY"
    | "ENGINEERING_REFERENCE";
}

export type BootstrapAuditStatus =
  | "SELECTED"
  | "EXCLUDED";

export type BootstrapAuditReason =
  | "SELECTED_RELEVANCE_AND_DIVERSITY"
  | "SELECTED_DOMAIN_CAP_RELAXED"
  | "EXCLUDED_ZERO_RELEVANCE"
  | "EXCLUDED_LIMIT"
  | "EXCLUDED_DOMAIN_DIVERSITY"
  | "EXCLUDED_DUPLICATE_ID"
  | "EXCLUDED_DUPLICATE_URL"
  | "INVALID_SOURCE";

export interface BootstrapCandidateAudit {
  readonly id: string;
  readonly url: string;
  readonly hostname: string;
  readonly domainKey: string;
  readonly authority: BootstrapSource["authority"];
  readonly score: number;
  readonly status: BootstrapAuditStatus;
  readonly reason: BootstrapAuditReason;
  readonly corpusIndex: number;
}

export interface BootstrapResolution {
  readonly query: string;
  readonly matched: readonly BootstrapSource[];
  readonly rejected: readonly {
    readonly id: string;
    readonly reason: string;
  }[];
  readonly audit: readonly BootstrapCandidateAudit[];
  readonly metrics: {
    readonly corpusSize: number;
    readonly validSourceCount: number;
    readonly relevantSourceCount: number;
    readonly selectedSourceCount: number;
    readonly selectedDomainCount: number;
    readonly authorityCoverage: readonly string[];
  };
}

const MAX_BOOTSTRAP_SOURCES = 100;

/**
 * Conservative list of common multi-label public suffixes.
 *
 * This is not a complete Public Suffix List and must not be used
 * as an ownership-verification or security boundary.
 */
const MULTI_LABEL_PUBLIC_SUFFIXES =
  new Set<string>([
    "ac.uk",
    "co.uk",
    "gov.uk",
    "org.uk",
    "com.au",
    "net.au",
    "org.au",
    "edu.au",
    "co.nz",
    "org.nz",
    "com.cn",
    "net.cn",
    "org.cn",
    "gov.cn",
    "com.hk",
    "org.hk",
    "com.sg",
    "com.my",
    "com.in",
    "co.in",
    "firm.in",
    "net.in",
    "org.in",
    "gen.in",
    "co.jp",
    "ne.jp",
    "or.jp",
    "com.br",
    "com.mx",
    "com.tr",
    "com.tw",
    "com.ar",
    "com.pl",
    "com.ua",
    "co.za",
    "org.za",
    "com.eg",
  ]);

interface RankedSource {
  readonly source: BootstrapSource;
  readonly score: number;
  readonly corpusIndex: number;
  readonly hostname: string;
  readonly domainKey: string;
}

interface MutableAuditRecord {
  readonly id: string;
  readonly url: string;
  readonly hostname: string;
  readonly domainKey: string;
  readonly authority: BootstrapSource["authority"];
  readonly score: number;
  readonly corpusIndex: number;
  status: BootstrapAuditStatus;
  reason: BootstrapAuditReason;
}

function normalizeText(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function tokenize(
  value: string,
): readonly string[] {
  return Object.freeze(
    [
      ...new Set(
        normalizeText(value)
          .split(/[^a-z0-9]+/)
          .filter(
            (token) => token.length >= 2,
          ),
      ),
    ],
  );
}

function requireQuery(
  query: string,
): string {
  if (
    typeof query !== "string" ||
    !query.trim()
  ) {
    throw new Error(
      "V8_BOOTSTRAP_QUERY_EMPTY",
    );
  }

  return normalizeText(query);
}

function getHostname(
  url: string,
): string {
  try {
    return new URL(url).hostname
      .toLowerCase()
      .replace(/\.$/, "");
  } catch {
    throw new Error(
      "V8_BOOTSTRAP_SOURCE_HOST_INVALID",
    );
  }
}

/**
 * Produce a conservative grouping key for source diversity.
 *
 * The key groups common subdomains under a shared registrable-domain
 * approximation. It does not establish that two organizations are
 * independently owned.
 */
function getDomainKey(
  hostname: string,
): string {
  const normalizedHostname =
    hostname
      .toLowerCase()
      .replace(/\.$/, "");

  const labels =
    normalizedHostname
      .split(".")
      .filter(Boolean);

  if (labels.length <= 2) {
    return normalizedHostname;
  }

  const lastTwo =
    labels.slice(-2).join(".");

  if (
    MULTI_LABEL_PUBLIC_SUFFIXES.has(lastTwo)
  ) {
    return labels
      .slice(-3)
      .join(".");
  }

  return lastTwo;
}

function requireBootstrapSource(
  source: BootstrapSource,
): BootstrapSource {
  if (
    source === null ||
    typeof source !== "object"
  ) {
    throw new Error(
      "V8_BOOTSTRAP_SOURCE_INVALID",
    );
  }

  if (
    typeof source.id !== "string" ||
    !source.id.trim()
  ) {
    throw new Error(
      "V8_BOOTSTRAP_SOURCE_ID_INVALID",
    );
  }

  if (
    typeof source.url !== "string" ||
    !source.url.trim()
  ) {
    throw new Error(
      "V8_BOOTSTRAP_SOURCE_URL_INVALID",
    );
  }

  if (
    typeof source.title !== "string" ||
    !source.title.trim()
  ) {
    throw new Error(
      "V8_BOOTSTRAP_SOURCE_TITLE_INVALID",
    );
  }

  if (
    !Array.isArray(source.terms) ||
    source.terms.length === 0 ||
    source.terms.some(
      (term) =>
        typeof term !== "string",
    )
  ) {
    throw new Error(
      "V8_BOOTSTRAP_SOURCE_TERMS_INVALID",
    );
  }

  if (
    source.authority !==
      "AUTHORITATIVE_STANDARD" &&
    source.authority !==
      "OFFICIAL_PRIMARY" &&
    source.authority !==
      "ENGINEERING_REFERENCE"
  ) {
    throw new Error(
      "V8_BOOTSTRAP_SOURCE_AUTHORITY_INVALID",
    );
  }

  const policy =
    evaluateSourceUrl(source.url);

  if (policy.status !== "ELIGIBLE") {
    throw new Error(
      policy.reason ??
        "V8_BOOTSTRAP_SOURCE_URL_BLOCKED",
    );
  }

  const normalizedUrl =
    policy.normalizedUrl ??
    source.url.trim();

  return Object.freeze({
    id: source.id.trim(),
    url: normalizedUrl,
    title: source.title.trim(),
    terms: Object.freeze(
      source.terms
        .map(normalizeText)
        .filter(Boolean),
    ),
    authority: source.authority,
  });
}

function scoreSource(
  queryTokens: readonly string[],
  source: BootstrapSource,
): number {
  if (queryTokens.length === 0) {
    return 0;
  }

  const titleTokens =
    new Set(tokenize(source.title));

  const termTokens =
    new Set(
      tokenize(source.terms.join(" ")),
    );

  let score = 0;

  for (const token of queryTokens) {
    if (titleTokens.has(token)) {
      // A title match is a stronger relevance signal
      // than a match in the auxiliary term list.
      score += 3;
    } else if (termTokens.has(token)) {
      score += 1;
    }
  }

  return score;
}

function compareRankedSources(
  left: RankedSource,
  right: RankedSource,
): number {
  return (
    right.score - left.score ||
    left.corpusIndex - right.corpusIndex ||
    left.source.id.localeCompare(
      right.source.id,
    )
  );
}

function createAuditRecord(
  ranked: RankedSource,
  status: BootstrapAuditStatus,
  reason: BootstrapAuditReason,
): MutableAuditRecord {
  return {
    id: ranked.source.id,
    url: ranked.source.url,
    hostname: ranked.hostname,
    domainKey: ranked.domainKey,
    authority: ranked.source.authority,
    score: ranked.score,
    corpusIndex: ranked.corpusIndex,
    status,
    reason,
  };
}

function freezeAuditRecord(
  record: MutableAuditRecord,
): BootstrapCandidateAudit {
  return Object.freeze({
    id: record.id,
    url: record.url,
    hostname: record.hostname,
    domainKey: record.domainKey,
    authority: record.authority,
    score: record.score,
    status: record.status,
    reason: record.reason,
    corpusIndex: record.corpusIndex,
  });
}

/**
 * Resolve a research query against the V8-owned Bootstrap Corpus.
 *
 * This function performs no network access and never manufactures URLs.
 *
 * Selection policy:
 * 1. Validate registered sources using the existing source policy.
 * 2. Deduplicate source IDs and normalized URLs.
 * 3. Score relevance without promoting zero-relevance sources.
 * 4. Prefer one source per domain group before selecting a second
 *    source from any already represented domain group.
 * 5. If relevant candidates remain and the limit is not reached,
 *    relax the domain cap to fill remaining slots.
 * 6. Return auditable decisions for relevant and excluded candidates.
 *
 * Domain diversity is a selection heuristic. It is not proof of
 * independent ownership, factual correctness, or source authority.
 */
export function resolveBootstrapSources(
  query: string,
  corpus: readonly BootstrapSource[],
  limit = 10,
): BootstrapResolution {
  const normalizedQuery =
    requireQuery(query);

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_BOOTSTRAP_SOURCES
  ) {
    throw new Error(
      "V8_BOOTSTRAP_LIMIT_INVALID",
    );
  }

  if (!Array.isArray(corpus)) {
    throw new Error(
      "V8_BOOTSTRAP_CORPUS_INVALID",
    );
  }

  const queryTokens =
    tokenize(normalizedQuery);

  const rejected: {
    id: string;
    reason: string;
  }[] = [];

  const auditRecords:
    MutableAuditRecord[] = [];

  const validated: {
    source: BootstrapSource;
    corpusIndex: number;
    hostname: string;
    domainKey: string;
  }[] = [];

  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();

  for (
    let corpusIndex = 0;
    corpusIndex < corpus.length;
    corpusIndex += 1
  ) {
    const source = corpus[corpusIndex];

    let validatedSource: BootstrapSource;

    try {
      validatedSource =
        requireBootstrapSource(source);
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : String(error);

      rejected.push({
        id:
          typeof source?.id === "string"
            ? source.id
            : "",
        reason,
      });

      const safeUrl =
        typeof source?.url === "string"
          ? source.url
          : "";

      let hostname = "";
      let domainKey = "";

      try {
        if (safeUrl) {
          hostname = getHostname(safeUrl);
          domainKey = getDomainKey(hostname);
        }
      } catch {
        // Invalid URLs remain auditable with empty host fields.
      }

      auditRecords.push({
        id:
          typeof source?.id === "string"
            ? source.id
            : "",
        url: safeUrl,
        hostname,
        domainKey,
        authority:
          source?.authority ??
          "ENGINEERING_REFERENCE",
        score: 0,
        corpusIndex,
        status: "EXCLUDED",
        reason: "INVALID_SOURCE",
      });

      continue;
    }

    if (seenIds.has(validatedSource.id)) {
      rejected.push({
        id: validatedSource.id,
        reason: "V8_BOOTSTRAP_DUPLICATE_ID",
      });

      let hostname = "";
      let domainKey = "";

      try {
        hostname = getHostname(validatedSource.url);
        domainKey = getDomainKey(hostname);
      } catch {
        // The validated URL should make this unreachable.
      }

      auditRecords.push({
        id: validatedSource.id,
        url: validatedSource.url,
        hostname,
        domainKey,
        authority: validatedSource.authority,
        score: 0,
        corpusIndex,
        status: "EXCLUDED",
        reason: "EXCLUDED_DUPLICATE_ID",
      });

      continue;
    }

    seenIds.add(validatedSource.id);

    if (seenUrls.has(validatedSource.url)) {
      rejected.push({
        id: validatedSource.id,
        reason: "V8_BOOTSTRAP_DUPLICATE_URL",
      });

      let hostname = "";
      let domainKey = "";

      try {
        hostname = getHostname(validatedSource.url);
        domainKey = getDomainKey(hostname);
      } catch {
        // The validated URL should make this unreachable.
      }

      auditRecords.push({
        id: validatedSource.id,
        url: validatedSource.url,
        hostname,
        domainKey,
        authority: validatedSource.authority,
        score: 0,
        corpusIndex,
        status: "EXCLUDED",
        reason: "EXCLUDED_DUPLICATE_URL",
      });

      continue;
    }

    seenUrls.add(validatedSource.url);

    const hostname =
      getHostname(validatedSource.url);

    validated.push({
      source: validatedSource,
      corpusIndex,
      hostname,
      domainKey: getDomainKey(hostname),
    });
  }

  const ranked: RankedSource[] =
    validated
      .map((item) => ({
        source: item.source,
        corpusIndex: item.corpusIndex,
        hostname: item.hostname,
        domainKey: item.domainKey,
        score: scoreSource(
          queryTokens,
          item.source,
        ),
      }))
      .sort(compareRankedSources);

  const relevant =
    ranked.filter(
      (item) => item.score > 0,
    );

  for (const item of ranked) {
    if (item.score === 0) {
      auditRecords.push(
        createAuditRecord(
          item,
          "EXCLUDED",
          "EXCLUDED_ZERO_RELEVANCE",
        ),
      );
    }
  }

  const selected: RankedSource[] = [];
  const selectedIds = new Set<string>();
  const selectedDomains = new Set<string>();

  /*
   * Pass one: maximize domain coverage.
   *
   * The highest-ranked relevant candidate from each domain group
   * gets priority. No zero-relevance candidate can enter this pass.
   */
  for (const item of relevant) {
    if (selected.length >= limit) {
      break;
    }

    if (selectedDomains.has(item.domainKey)) {
      continue;
    }

    selected.push(item);
    selectedIds.add(item.source.id);
    selectedDomains.add(item.domainKey);

    auditRecords.push(
      createAuditRecord(
        item,
        "SELECTED",
        "SELECTED_RELEVANCE_AND_DIVERSITY",
      ),
    );
  }

  /*
   * Pass two: fill unused slots with the next-best relevant sources.
   *
   * This relaxes the one-source-per-domain preference only when
   * the number of distinct relevant domains is insufficient.
   */
  if (selected.length < limit) {
    for (const item of relevant) {
      if (selected.length >= limit) {
        break;
      }

      if (selectedIds.has(item.source.id)) {
        continue;
      }

      selected.push(item);
      selectedIds.add(item.source.id);
      selectedDomains.add(item.domainKey);

      auditRecords.push(
        createAuditRecord(
          item,
          "SELECTED",
          "SELECTED_DOMAIN_CAP_RELAXED",
        ),
      );
    }
  }

  /*
   * Mark relevant candidates not selected due to the requested limit.
   * A candidate that was bypassed during the diversity pass can still
   * be selected during the fill pass.
   */
  for (const item of relevant) {
    if (selectedIds.has(item.source.id)) {
      continue;
    }

    const reason =
      selected.length >= limit
        ? "EXCLUDED_LIMIT"
        : "EXCLUDED_DOMAIN_DIVERSITY";

    auditRecords.push(
      createAuditRecord(
        item,
        "EXCLUDED",
        reason,
      ),
    );
  }

  const selectedAuthorityCoverage =
    [
      ...new Set(
        selected.map(
          (item) => item.source.authority,
        ),
      ),
    ].sort();

  const frozenAudit =
    auditRecords
      .sort(
        (left, right) =>
          left.corpusIndex - right.corpusIndex,
      )
      .map(freezeAuditRecord);

  return Object.freeze({
    query: normalizedQuery,

    matched: Object.freeze(
      selected.map((item) => item.source),
    ),

    rejected: Object.freeze(
      rejected.map((item) =>
        Object.freeze({
          id: item.id,
          reason: item.reason,
        }),
      ),
    ),

    audit: Object.freeze(frozenAudit),

    metrics: Object.freeze({
      corpusSize: corpus.length,
      validSourceCount: validated.length,
      relevantSourceCount: relevant.length,
      selectedSourceCount: selected.length,
      selectedDomainCount: selectedDomains.size,
      authorityCoverage: Object.freeze(
        selectedAuthorityCoverage,
      ),
    }),
  });
}

/**
 * Convert explicitly registered BootstrapSources into DiscoveryCandidates.
 *
 * No network request is performed here.
 *
 * These candidates retain the existing DiscoveryCandidate identity
 * contract. They are registered bootstrap candidates, not evidence
 * that a page was successfully fetched or verified.
 */
export function bootstrapSourcesToCandidates(
  sources: readonly BootstrapSource[],
  observedAt: string,
): readonly DiscoveryCandidate[] {
  if (
    typeof observedAt !== "string" ||
    !observedAt.trim()
  ) {
    throw new Error(
      "V8_BOOTSTRAP_OBSERVED_AT_INVALID",
    );
  }

  const output: DiscoveryCandidate[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    const validated =
      requireBootstrapSource(source);

    const candidate =
      createDiscoveryCandidate({
        url: validated.url,
        kind: "SEED",
        discoveredAt: observedAt.trim(),
        sourceUrl: validated.url,
        title: validated.title,
      });

    if (candidate === null) {
      throw new Error(
        "V8_BOOTSTRAP_CANDIDATE_INVALID",
      );
    }

    if (seen.has(candidate.normalizedUrl)) {
      continue;
    }

    seen.add(candidate.normalizedUrl);
    output.push(candidate);
  }

  return Object.freeze(output);
}