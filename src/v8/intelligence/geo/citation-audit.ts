import type { EvidenceRef } from "../shared.js";

export type CitationAuditSeverity = "WARN" | "BLOCK";

export interface CitationAuditFinding {
  readonly code: string;
  readonly severity: CitationAuditSeverity;
  readonly message: string;
  readonly claimIndex?: number;
  readonly evidenceIndex?: number;
}

export interface ClaimEvidenceMatch {
  readonly claimIndex: number;
  readonly evidenceIndex: number;
  readonly coverage: number;
  readonly matchedTerms: readonly string[];
  readonly sourceUrl: string;
}

export interface CitationAuditReport {
  readonly passed: boolean;
  readonly findings: readonly CitationAuditFinding[];
  readonly matches: readonly ClaimEvidenceMatch[];
}

const ENGLISH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "being",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "how",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "may",
  "might",
  "must",
  "of",
  "on",
  "or",
  "our",
  "should",
  "that",
  "the",
  "their",
  "then",
  "there",
  "these",
  "this",
  "those",
  "to",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "will",
  "with",
  "would",
  "you",
  "your",
]);

const CJK_SCRIPT =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

const TOKEN_PATTERN =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+|[\p{L}\p{N}]+/gu;

const MINIMUM_COVERAGE = 0.5;

function finding(
  code: string,
  severity: CitationAuditSeverity,
  message: string,
  claimIndex?: number,
  evidenceIndex?: number,
): CitationAuditFinding {
  return Object.freeze({
    code,
    severity,
    message,
    ...(claimIndex === undefined ? {} : { claimIndex }),
    ...(evidenceIndex === undefined ? {} : { evidenceIndex }),
  });
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);

    return (
      (parsed.protocol === "https:" ||
        parsed.protocol === "http:") &&
      parsed.hostname.length > 0 &&
      parsed.username.length === 0 &&
      parsed.password.length === 0
    );
  } catch {
    return false;
  }
}

/**
 * Tokenizes Latin-script text into words and CJK text into overlapping
 * bigrams. This provides deterministic lexical matching across common
 * English and CJK content without requiring a remote NLP service.
 *
 * Lexical overlap is a conservative screening signal, not proof of
 * semantic entailment or factual correctness.
 */
function tokenizeEvidenceText(value: string): readonly string[] {
  const normalized = value.normalize("NFKC").toLocaleLowerCase();
  const rawTokens = normalized.match(TOKEN_PATTERN) ?? [];
  const output = new Set<string>();

  for (const token of rawTokens) {
    if (CJK_SCRIPT.test(token)) {
      const characters = Array.from(token);

      if (characters.length === 1) {
        output.add(token);
        continue;
      }

      for (let index = 0; index < characters.length - 1; index++) {
        output.add(
          `${characters[index]}${characters[index + 1]}`,
        );
      }

      continue;
    }

    if (
      token.length >= 3 &&
      !ENGLISH_STOP_WORDS.has(token)
    ) {
      output.add(token);
    }
  }

  return Object.freeze([...output].sort());
}

function createReport(
  findings: readonly CitationAuditFinding[],
  matches: readonly ClaimEvidenceMatch[],
): CitationAuditReport {
  const immutableFindings = Object.freeze([...findings]);
  const immutableMatches = Object.freeze(
    matches.map((match) =>
      Object.freeze({
        ...match,
        matchedTerms: Object.freeze([...match.matchedTerms]),
      }),
    ),
  );

  return Object.freeze({
    passed: !immutableFindings.some(
      (item) => item.severity === "BLOCK",
    ),
    findings: immutableFindings,
    matches: immutableMatches,
  });
}

interface UsableEvidence {
  readonly index: number;
  readonly sourceUrl: string;
  readonly excerpt: string;
  readonly tokens: ReadonlySet<string>;
}

/**
 * Audits whether each content claim has at least one usable evidence
 * excerpt with sufficient lexical overlap.
 *
 * Fail-closed rules:
 * - Empty claim lists are blocked.
 * - Empty claims are blocked.
 * - Invalid evidence URLs are blocked.
 * - Evidence without an excerpt is blocked.
 * - Every claim must match at least one usable evidence excerpt.
 *
 * Passing this audit does not prove that a source entails a claim.
 * A separate semantic entailment / factual verification gate remains
 * necessary before making stronger truthfulness guarantees.
 */
export function auditClaimEvidenceAlignment(
  claims: readonly string[],
  evidence: readonly EvidenceRef[],
): CitationAuditReport {
  const findings: CitationAuditFinding[] = [];
  const matches: ClaimEvidenceMatch[] = [];
  const usableEvidence: UsableEvidence[] = [];

  if (claims.length === 0) {
    findings.push(
      finding(
        "GEO_CLAIMS_EMPTY",
        "BLOCK",
        "GEO citation audit requires at least one claim.",
      ),
    );
  }

  for (let index = 0; index < evidence.length; index++) {
    const item = evidence[index];
    const sourceUrl = item.sourceUrl.trim();
    const excerpt = item.excerpt?.trim() ?? "";

    if (!isValidHttpUrl(sourceUrl)) {
      findings.push(
        finding(
          "GEO_EVIDENCE_URL_INVALID",
          "BLOCK",
          `Evidence item ${index} has an invalid HTTP(S) source URL.`,
          undefined,
          index,
        ),
      );

      continue;
    }

    if (!excerpt) {
      findings.push(
        finding(
          "GEO_EVIDENCE_EXCERPT_MISSING",
          "BLOCK",
          `Evidence item ${index} has no excerpt to audit.`,
          undefined,
          index,
        ),
      );

      continue;
    }

    usableEvidence.push(
      Object.freeze({
        index,
        sourceUrl,
        excerpt,
        tokens: new Set(tokenizeEvidenceText(excerpt)),
      }),
    );
  }

  for (let claimIndex = 0; claimIndex < claims.length; claimIndex++) {
    const claim = claims[claimIndex].trim();

    if (!claim) {
      findings.push(
        finding(
          "GEO_CLAIM_EMPTY",
          "BLOCK",
          `Claim ${claimIndex} is empty.`,
          claimIndex,
        ),
      );

      continue;
    }

    const claimTokens = tokenizeEvidenceText(claim);

    if (claimTokens.length === 0) {
      findings.push(
        finding(
          "GEO_CLAIM_NOT_AUDITABLE",
          "BLOCK",
          `Claim ${claimIndex} has no auditable lexical terms.`,
          claimIndex,
        ),
      );

      continue;
    }

    const candidates = usableEvidence
      .map((item) => {
        const matchedTerms = claimTokens.filter(
          (token) => item.tokens.has(token),
        );

        const coverage =
          matchedTerms.length / claimTokens.length;

        return {
          item,
          matchedTerms,
          coverage,
        };
      })
      .filter((candidate) => {
        const minimumMatches = Math.min(
          2,
          claimTokens.length,
        );

        return (
          candidate.coverage >= MINIMUM_COVERAGE &&
          candidate.matchedTerms.length >= minimumMatches
        );
      })
      .sort((left, right) => {
        if (right.coverage !== left.coverage) {
          return right.coverage - left.coverage;
        }

        if (
          right.matchedTerms.length !==
          left.matchedTerms.length
        ) {
          return (
            right.matchedTerms.length -
            left.matchedTerms.length
          );
        }

        return left.item.sourceUrl.localeCompare(
          right.item.sourceUrl,
        );
      });

    const best = candidates[0];

    if (!best) {
      findings.push(
        finding(
          "GEO_CLAIM_EVIDENCE_UNMATCHED",
          "BLOCK",
          `Claim ${claimIndex} has no evidence excerpt meeting the lexical coverage threshold.`,
          claimIndex,
        ),
      );

      continue;
    }

    matches.push(
      Object.freeze({
        claimIndex,
        evidenceIndex: best.item.index,
        coverage: best.coverage,
        matchedTerms: Object.freeze([
          ...best.matchedTerms,
        ]),
        sourceUrl: best.item.sourceUrl,
      }),
    );
  }

  return createReport(findings, matches);
}