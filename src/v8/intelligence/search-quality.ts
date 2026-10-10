import type { GeoArtifact } from "./geo/compiler.js";
import type { SeoArtifact } from "./seo/compiler.js";

export type SearchQualitySeverity =
  | "INFO"
  | "WARN"
  | "BLOCK";

export interface SearchQualityFinding {
  readonly code: string;
  readonly severity: SearchQualitySeverity;
  readonly message: string;
}

export interface SearchQualityReport {
  readonly passed: boolean;
  readonly findings: readonly SearchQualityFinding[];
}

function finding(
  code: string,
  severity: SearchQualitySeverity,
  message: string,
): SearchQualityFinding {
  return Object.freeze({
    code,
    severity,
    message,
  });
}

function report(
  findings: readonly SearchQualityFinding[],
): SearchQualityReport {
  const immutableFindings = Object.freeze([
    ...findings,
  ]);

  return Object.freeze({
    passed: !immutableFindings.some(
      (item) => item.severity === "BLOCK",
    ),
    findings: immutableFindings,
  });
}

function isValidHttpUrl(
  value: string,
): boolean {
  try {
    const url = new URL(value);

    return (
      (url.protocol === "https:" ||
        url.protocol === "http:") &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

function hasDuplicateValues(
  values: readonly string[],
): boolean {
  const normalized = values.map(
    (value) => value.trim().toLowerCase(),
  );

  return new Set(normalized).size !== normalized.length;
}

/**
 * Audits the SEO artifact produced by the existing compiler.
 *
 * This function does not change the artifact or claim that an artifact
 * passing these checks will rank in search engines.
 */
export function auditSeoArtifact(
  artifact: SeoArtifact,
): SearchQualityReport {
  const findings: SearchQualityFinding[] = [];

  const title = artifact.title.trim();
  const slug = artifact.slug.trim();
  const description = artifact.description.trim();
  const canonicalPath = artifact.canonicalPath.trim();

  if (!title) {
    findings.push(
      finding(
        "SEO_TITLE_EMPTY",
        "BLOCK",
        "SEO title must not be empty.",
      ),
    );
  } else if (title.length < 10 || title.length > 70) {
    findings.push(
      finding(
        "SEO_TITLE_LENGTH",
        "WARN",
        "SEO title is outside the recommended 10–70 character review range.",
      ),
    );
  }

  if (!slug) {
    findings.push(
      finding(
        "SEO_SLUG_EMPTY",
        "BLOCK",
        "SEO slug must not be empty.",
      ),
    );
  } else if (
    slug.startsWith("/") ||
    slug.endsWith("/") ||
    slug.includes("//") ||
    slug.split("/").some(
      (segment) =>
        segment === "." || segment === "..",
    )
  ) {
    findings.push(
      finding(
        "SEO_SLUG_NOT_CANONICAL",
        "BLOCK",
        "SEO slug must be a relative path without empty, dot, or parent segments.",
      ),
    );
  }

  if (!description) {
    findings.push(
      finding(
        "SEO_DESCRIPTION_EMPTY",
        "BLOCK",
        "SEO description must not be empty.",
      ),
    );
  } else if (
    description.length < 50 ||
    description.length > 160
  ) {
    findings.push(
      finding(
        "SEO_DESCRIPTION_LENGTH",
        "WARN",
        "SEO description is outside the recommended 50–160 character review range.",
      ),
    );
  }

  if (
    !canonicalPath.startsWith("/") ||
    !canonicalPath.endsWith("/") ||
    canonicalPath.startsWith("//") ||
    canonicalPath.includes("?") ||
    canonicalPath.includes("#")
  ) {
    findings.push(
      finding(
        "SEO_CANONICAL_PATH_INVALID",
        "BLOCK",
        "Canonical path must be a local absolute path, start and end with '/', and contain no query or fragment.",
      ),
    );
  }

  if (artifact.keywords.length === 0) {
    findings.push(
      finding(
        "SEO_KEYWORDS_EMPTY",
        "WARN",
        "SEO artifact contains no keywords.",
      ),
    );
  }

  if (hasDuplicateValues(artifact.keywords)) {
    findings.push(
      finding(
        "SEO_KEYWORDS_DUPLICATED",
        "WARN",
        "SEO keyword list contains duplicate values after case and whitespace normalization.",
      ),
    );
  }

  if (
    artifact.keywords.some(
      (keyword) => !keyword.trim(),
    )
  ) {
    findings.push(
      finding(
        "SEO_KEYWORD_EMPTY",
        "BLOCK",
        "SEO keyword list contains an empty entry.",
      ),
    );
  }

  if (
    artifact.headings.some(
      (heading) => !heading.trim(),
    )
  ) {
    findings.push(
      finding(
        "SEO_HEADING_EMPTY",
        "BLOCK",
        "SEO heading list contains an empty heading.",
      ),
    );
  }

  return report(findings);
}

/**
 * Audits the GEO answer artifact.
 *
 * Citation URL validity is checked separately from evidence verification.
 * A syntactically valid URL is not proof that a claim is supported by it.
 */
export function auditGeoArtifact(
  artifact: GeoArtifact,
): SearchQualityReport {
  const findings: SearchQualityFinding[] = [];

  const directAnswer = artifact.directAnswer.trim();

  if (!directAnswer) {
    findings.push(
      finding(
        "GEO_DIRECT_ANSWER_EMPTY",
        "BLOCK",
        "GEO direct answer must not be empty.",
      ),
    );
  } else if (directAnswer.length > 500) {
    findings.push(
      finding(
        "GEO_DIRECT_ANSWER_TOO_LONG",
        "BLOCK",
        "GEO direct answer exceeds the 500-character compiler limit.",
      ),
    );
  } else if (directAnswer.length < 40) {
    findings.push(
      finding(
        "GEO_DIRECT_ANSWER_TOO_SHORT",
        "WARN",
        "GEO direct answer is shorter than the 40-character review threshold.",
      ),
    );
  }

  if (artifact.facts.length === 0) {
    findings.push(
      finding(
        "GEO_FACTS_EMPTY",
        "BLOCK",
        "GEO artifact contains no claims or facts to review.",
      ),
    );
  }

  if (
    artifact.facts.some(
      (fact) => !fact.trim(),
    )
  ) {
    findings.push(
      finding(
        "GEO_FACT_EMPTY",
        "BLOCK",
        "GEO facts contain an empty entry.",
      ),
    );
  }

  if (artifact.citationTargets.length === 0) {
    findings.push(
      finding(
        "GEO_CITATIONS_EMPTY",
        "BLOCK",
        "GEO artifact contains no citation targets.",
      ),
    );
  }

  const invalidCitationTargets =
    artifact.citationTargets.filter(
      (target) => !isValidHttpUrl(target.trim()),
    );

  if (invalidCitationTargets.length > 0) {
    findings.push(
      finding(
        "GEO_CITATION_URL_INVALID",
        "BLOCK",
        `${invalidCitationTargets.length} citation target(s) are not valid HTTP(S) URLs.`,
      ),
    );
  }

  if (
    hasDuplicateValues(artifact.citationTargets)
  ) {
    findings.push(
      finding(
        "GEO_CITATION_DUPLICATED",
        "WARN",
        "GEO citation targets contain duplicates.",
      ),
    );
  }

  if (
    artifact.entityTerms.some(
      (term) => !term.trim(),
    )
  ) {
    findings.push(
      finding(
        "GEO_ENTITY_TERM_EMPTY",
        "WARN",
        "GEO entity terms contain an empty entry.",
      ),
    );
  }

  if (
    artifact.questions.some(
      (question) =>
        !question.trim().endsWith("?"),
    )
  ) {
    findings.push(
      finding(
        "GEO_QUESTION_FORMAT",
        "WARN",
        "One or more GEO questions do not end with a question mark.",
      ),
    );
  }

  return report(findings);
}