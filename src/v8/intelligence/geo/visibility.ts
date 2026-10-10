import { normalizeText, uniqueStrings } from "../shared.js";

export type GeoVisibilitySeverity = "INFO" | "WARN" | "BLOCK";

export interface GeoVisibilitySnapshot {
  readonly query: string;
  readonly platform: string;
  readonly observedAt: string;
  readonly answerText: string;
  readonly citedUrls: readonly string[];
}

export interface GeoVisibilityTarget {
  readonly brandName: string;
  readonly entityAliases?: readonly string[];
  readonly ownedDomains: readonly string[];
  readonly competitorNames?: readonly string[];
  readonly targetQueries?: readonly string[];
}

export interface GeoVisibilityFinding {
  readonly code: string;
  readonly severity: GeoVisibilitySeverity;
  readonly message: string;
  readonly snapshotIndex?: number;
}

export interface GeoVisibilityObservation {
  readonly query: string;
  readonly platform: string;
  readonly observedAt: string;
  readonly targetMentioned: boolean;
  readonly competitorsMentioned: readonly string[];
  readonly citationCount: number;
  readonly ownedCitationCount: number;
  readonly ownedCitationUrls: readonly string[];
  readonly externalCitationUrls: readonly string[];
}

export interface GeoVisibilityMetrics {
  readonly observationCount: number;
  readonly distinctQueryCount: number;
  readonly distinctPlatformCount: number;
  readonly queryCoverage: number | null;
  readonly brandMentionRate: number;
  readonly answerCitationRate: number;
  readonly ownedCitationShare: number | null;
  readonly meanCitationsPerAnswer: number;
  readonly competitorMentionRates: Readonly<Record<string, number>>;
}

export interface GeoVisibilityReport {
  readonly passed: boolean;
  readonly findings: readonly GeoVisibilityFinding[];
  readonly observations: readonly GeoVisibilityObservation[];
  readonly metrics: GeoVisibilityMetrics;
}

const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function finding(
  code: string,
  severity: GeoVisibilitySeverity,
  message: string,
  snapshotIndex?: number,
): GeoVisibilityFinding {
  return Object.freeze({
    code,
    severity,
    message,
    ...(snapshotIndex === undefined ? {} : { snapshotIndex }),
  });
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      url.hostname.length > 0 &&
      url.username.length === 0 &&
      url.password.length === 0
    );
  } catch {
    return false;
  }
}

function normalizeDomain(value: string): string | null {
  const candidate = value.trim().toLowerCase();

  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(
      candidate.includes("://") ? candidate : `https://${candidate}`,
    );

    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      return null;
    }

    return url.hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
}

function isOwnedDomain(
  sourceUrl: string,
  ownedDomains: readonly string[],
): boolean {
  try {
    const hostname = new URL(sourceUrl).hostname
      .toLowerCase()
      .replace(/\.$/, "");

    return ownedDomains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

function containsEntity(
  text: string,
  entity: string,
): boolean {
  const normalizedText = normalizeText(text);
  const normalizedEntity = normalizeText(entity);

  if (!normalizedText || !normalizedEntity) {
    return false;
  }

  // Use Unicode letter/number boundaries to avoid matching a brand
  // as an accidental substring of a longer identifier.
  const escaped = normalizedEntity.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );

  const pattern = new RegExp(
    `(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`,
    "iu",
  );

  return pattern.test(normalizedText);
}

function freezeObservation(
  observation: GeoVisibilityObservation,
): GeoVisibilityObservation {
  return Object.freeze({
    ...observation,
    competitorsMentioned: Object.freeze([
      ...observation.competitorsMentioned,
    ]),
    ownedCitationUrls: Object.freeze([...observation.ownedCitationUrls]),
    externalCitationUrls: Object.freeze([
      ...observation.externalCitationUrls,
    ]),
  });
}

function freezeReport(
  findings: readonly GeoVisibilityFinding[],
  observations: readonly GeoVisibilityObservation[],
  metrics: GeoVisibilityMetrics,
): GeoVisibilityReport {
  const immutableFindings = Object.freeze(
    findings.map((item) => Object.freeze({ ...item })),
  );

  return Object.freeze({
    passed: !immutableFindings.some(
      (item) => item.severity === "BLOCK",
    ),
    findings: immutableFindings,
    observations: Object.freeze(
      observations.map(freezeObservation),
    ),
    metrics: Object.freeze({
      ...metrics,
      competitorMentionRates: Object.freeze({
        ...metrics.competitorMentionRates,
      }),
    }),
  });
}

/**
 * Evaluates observed GEO / AI-answer visibility from caller-supplied
 * answer snapshots.
 *
 * This module does not query AI platforms and does not invent observations.
 * Results describe only the snapshots supplied by the caller; they do not
 * establish search ranking, answer correctness, causal impact, or lead volume.
 *
 * Fail-closed input rules:
 * - The target brand and owned-domain list must be present.
 * - At least one observation must be supplied.
 * - Each observation must include a query, platform, timestamp, and answer.
 * - Timestamps must be explicit ISO-8601 timestamps with a timezone.
 * - Citation URLs must be valid HTTP(S) URLs.
 */
export function evaluateGeoVisibility(
  target: GeoVisibilityTarget,
  snapshots: readonly GeoVisibilitySnapshot[],
): GeoVisibilityReport {
  const findings: GeoVisibilityFinding[] = [];
  const observations: GeoVisibilityObservation[] = [];

  const brandName = target.brandName.trim();

  const aliases = uniqueStrings([
    brandName,
    ...(target.entityAliases ?? []),
  ]).filter(Boolean);

  const competitorNames = uniqueStrings(
    target.competitorNames ?? [],
  ).filter((name) => !aliases.some(
    (alias) => normalizeText(alias) === normalizeText(name),
  ));

  const normalizedDomains = uniqueStrings(
    target.ownedDomains
      .map(normalizeDomain)
      .filter((domain): domain is string => domain !== null),
  );

  if (!brandName) {
    findings.push(
      finding(
        "GEO_VISIBILITY_BRAND_EMPTY",
        "BLOCK",
        "A non-empty target brand name is required.",
      ),
    );
  }

  if (aliases.length === 0) {
    findings.push(
      finding(
        "GEO_VISIBILITY_ALIASES_EMPTY",
        "BLOCK",
        "At least one usable brand name or alias is required.",
      ),
    );
  }

  if (target.ownedDomains.length === 0) {
    findings.push(
      finding(
        "GEO_VISIBILITY_OWNED_DOMAINS_EMPTY",
        "BLOCK",
        "At least one owned domain is required to calculate owned citation share.",
      ),
    );
  } else if (normalizedDomains.length !== uniqueStrings(target.ownedDomains).length) {
    findings.push(
      finding(
        "GEO_VISIBILITY_OWNED_DOMAIN_INVALID",
        "BLOCK",
        "One or more owned domains are invalid.",
      ),
    );
  }

  if (snapshots.length === 0) {
    findings.push(
      finding(
        "GEO_VISIBILITY_SNAPSHOTS_EMPTY",
        "BLOCK",
        "At least one observed AI answer snapshot is required.",
      ),
    );
  }

  const targetQueries = uniqueStrings(target.targetQueries ?? []);
  const seenSnapshotKeys = new Set<string>();

  for (let index = 0; index < snapshots.length; index += 1) {
    const snapshot = snapshots[index];

    const query = snapshot.query.trim();
    const platform = snapshot.platform.trim();
    const observedAt = snapshot.observedAt.trim();
    const answerText = snapshot.answerText.trim();

    let invalid = false;

    if (!query) {
      findings.push(
        finding(
          "GEO_VISIBILITY_QUERY_EMPTY",
          "BLOCK",
          "Observation query must not be empty.",
          index,
        ),
      );
      invalid = true;
    }

    if (!platform) {
      findings.push(
        finding(
          "GEO_VISIBILITY_PLATFORM_EMPTY",
          "BLOCK",
          "Observation platform must not be empty.",
          index,
        ),
      );
      invalid = true;
    }

    if (
      !ISO_TIMESTAMP_PATTERN.test(observedAt) ||
      !Number.isFinite(Date.parse(observedAt))
    ) {
      findings.push(
        finding(
          "GEO_VISIBILITY_TIMESTAMP_INVALID",
          "BLOCK",
          "Observation timestamp must be a valid timezone-qualified ISO-8601 timestamp.",
          index,
        ),
      );
      invalid = true;
    }

    if (!answerText) {
      findings.push(
        finding(
          "GEO_VISIBILITY_ANSWER_EMPTY",
          "BLOCK",
          "Observed answer text must not be empty.",
          index,
        ),
      );
      invalid = true;
    }

    const validCitations: string[] = [];

    for (const citedUrl of snapshot.citedUrls) {
      const trimmedUrl = citedUrl.trim();

      if (!isValidHttpUrl(trimmedUrl)) {
        findings.push(
          finding(
            "GEO_VISIBILITY_CITATION_URL_INVALID",
            "BLOCK",
            `Observation ${index} contains an invalid HTTP(S) citation URL.`,
            index,
          ),
        );
        invalid = true;
        continue;
      }

      validCitations.push(trimmedUrl);
    }

    const snapshotKey = JSON.stringify([
      normalizeText(query),
      normalizeText(platform),
      observedAt,
    ]);

    if (seenSnapshotKeys.has(snapshotKey)) {
      findings.push(
        finding(
          "GEO_VISIBILITY_DUPLICATE_OBSERVATION",
          "WARN",
          "A duplicate query, platform, and timestamp observation was supplied.",
          index,
        ),
      );
    }

    seenSnapshotKeys.add(snapshotKey);

    if (invalid) {
      continue;
    }

    const ownedCitationUrls = uniqueStrings(
      validCitations.filter((url) =>
        isOwnedDomain(url, normalizedDomains),
      ),
    );

    const externalCitationUrls = uniqueStrings(
      validCitations.filter(
        (url) => !isOwnedDomain(url, normalizedDomains),
      ),
    );

    const competitorsMentioned = competitorNames.filter((name) =>
      containsEntity(answerText, name),
    );

    observations.push(
      freezeObservation({
        query,
        platform,
        observedAt,
        targetMentioned: aliases.some((alias) =>
          containsEntity(answerText, alias),
        ),
        competitorsMentioned,
        citationCount: uniqueStrings(validCitations).length,
        ownedCitationCount: ownedCitationUrls.length,
        ownedCitationUrls,
        externalCitationUrls,
      }),
    );
  }

  const observationCount = observations.length;
  const distinctQueries = new Set(
    observations.map((item) => normalizeText(item.query)),
  );
  const distinctPlatforms = new Set(
    observations.map((item) => normalizeText(item.platform)),
  );

  const mentionedCount = observations.filter(
    (item) => item.targetMentioned,
  ).length;

  const citedAnswerCount = observations.filter(
    (item) => item.citationCount > 0,
  ).length;

  const totalCitationCount = observations.reduce(
    (total, item) => total + item.citationCount,
    0,
  );

  const totalOwnedCitationCount = observations.reduce(
    (total, item) => total + item.ownedCitationCount,
    0,
  );

  const competitorMentionRates: Record<string, number> = {};

  for (const competitorName of competitorNames) {
    const mentionCount = observations.filter((item) =>
      item.competitorsMentioned.some(
        (name) => normalizeText(name) === normalizeText(competitorName),
      ),
    ).length;

    competitorMentionRates[competitorName] =
      observationCount === 0 ? 0 : mentionCount / observationCount;
  }

  const queryCoverage =
    targetQueries.length === 0
      ? null
      : new Set(
          observations
            .map((item) => normalizeText(item.query))
            .filter((query) =>
              targetQueries.some(
                (targetQuery) => normalizeText(targetQuery) === query,
              ),
            ),
        ).size / targetQueries.length;

  if (observationCount === 0 && snapshots.length > 0) {
    findings.push(
      finding(
        "GEO_VISIBILITY_NO_VALID_OBSERVATIONS",
        "BLOCK",
        "No valid observations remain after input validation.",
      ),
    );
  }

  if (observationCount > 0 && mentionedCount === 0) {
    findings.push(
      finding(
        "GEO_VISIBILITY_BRAND_NOT_MENTIONED",
        "WARN",
        "The target brand was not mentioned in any valid observed answer.",
      ),
    );
  }

  if (observationCount > 0 && totalCitationCount === 0) {
    findings.push(
      finding(
        "GEO_VISIBILITY_NO_CITATIONS",
        "WARN",
        "No citations were present in the valid observed answers.",
      ),
    );
  }

  if (queryCoverage !== null && queryCoverage < 1) {
    findings.push(
      finding(
        "GEO_VISIBILITY_QUERY_COVERAGE_INCOMPLETE",
        "WARN",
        "One or more configured target queries have no valid observation.",
      ),
    );
  }

  const metrics: GeoVisibilityMetrics = {
    observationCount,
    distinctQueryCount: distinctQueries.size,
    distinctPlatformCount: distinctPlatforms.size,
    queryCoverage,
    brandMentionRate:
      observationCount === 0 ? 0 : mentionedCount / observationCount,
    answerCitationRate:
      observationCount === 0 ? 0 : citedAnswerCount / observationCount,
    ownedCitationShare:
      totalCitationCount === 0
        ? null
        : totalOwnedCitationCount / totalCitationCount,
    meanCitationsPerAnswer:
      observationCount === 0
        ? 0
        : totalCitationCount / observationCount,
    competitorMentionRates,
  };

  return freezeReport(findings, observations, metrics);
}