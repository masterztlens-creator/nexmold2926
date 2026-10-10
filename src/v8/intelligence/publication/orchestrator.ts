import type {
  ContentDraft,
  QualityReport,
} from "../shared.js";
import {
  compileGeo,
} from "../geo/compiler.js";
import {
  auditClaimEvidenceAlignment,
} from "../geo/citation-audit.js";
import {
  compileSeo,
} from "../seo/compiler.js";
import {
  auditGeoArtifact,
  auditSeoArtifact,
} from "../search-quality.js";

export interface PublicationDecision {
  readonly eligible: boolean;
  readonly slug: string;
  readonly reasons: readonly string[];
}

function uniqueReasons(
  reasons: readonly string[],
): readonly string[] {
  return Object.freeze([
    ...new Set(reasons),
  ]);
}

/**
 * Fail-closed publication eligibility decision.
 *
 * SEO and GEO structural audits, claim-to-evidence lexical alignment,
 * the existing quality firewall, semantic-collision checks, novelty
 * checks, and evidence-presence checks all participate in publication
 * eligibility.
 *
 * Lexical alignment is not semantic entailment. Passing this gate does
 * not establish factual correctness, search ranking, or guaranteed
 * citation by an external AI system.
 */
export function evaluatePublication(
  draft: ContentDraft,
  quality: QualityReport,
  collisions = 0,
  noveltyScore = 1,
): PublicationDecision {
  const reasons: string[] = [];

  if (!quality.passed) {
    reasons.push("quality-firewall");
  }

  if (
    !Number.isSafeInteger(collisions) ||
    collisions < 0
  ) {
    reasons.push("invalid-semantic-collision-count");
  } else if (collisions > 0) {
    reasons.push("semantic-collision");
  }

  if (
    !Number.isFinite(noveltyScore) ||
    noveltyScore < 0 ||
    noveltyScore > 1
  ) {
    reasons.push("invalid-novelty-score");
  } else if (noveltyScore < 0.35) {
    reasons.push("low-novelty");
  }

  if (draft.evidence.length === 0) {
    reasons.push("missing-evidence");
  }

  let seoAuditPassed = false;
  let geoAuditPassed = false;
  let citationAuditPassed = false;

  try {
    const seoReport = auditSeoArtifact(
      compileSeo(draft),
    );

    seoAuditPassed = seoReport.passed;

    for (const item of seoReport.findings) {
      if (item.severity === "BLOCK") {
        reasons.push(`seo-quality:${item.code}`);
      }
    }
  } catch {
    reasons.push("seo-quality:audit-error");
  }

  try {
    const geoReport = auditGeoArtifact(
      compileGeo(draft),
    );

    geoAuditPassed = geoReport.passed;

    for (const item of geoReport.findings) {
      if (item.severity === "BLOCK") {
        reasons.push(`geo-quality:${item.code}`);
      }
    }
  } catch {
    reasons.push("geo-quality:audit-error");
  }

  try {
    const citationReport = auditClaimEvidenceAlignment(
      draft.claims,
      draft.evidence,
    );

    citationAuditPassed = citationReport.passed;

    for (const item of citationReport.findings) {
      if (item.severity === "BLOCK") {
        reasons.push(`geo-citation:${item.code}`);
      }
    }
  } catch {
    reasons.push("geo-citation:audit-error");
  }

  // Explicit fail-closed guards prevent an audit from silently
  // returning a failed state without a corresponding blocker.
  if (
    !seoAuditPassed &&
    !reasons.some((reason) =>
      reason.startsWith("seo-quality:"),
    )
  ) {
    reasons.push("seo-quality:failed");
  }

  if (
    !geoAuditPassed &&
    !reasons.some((reason) =>
      reason.startsWith("geo-quality:"),
    )
  ) {
    reasons.push("geo-quality:failed");
  }

  if (
    !citationAuditPassed &&
    !reasons.some((reason) =>
      reason.startsWith("geo-citation:"),
    )
  ) {
    reasons.push("geo-citation:failed");
  }

  const finalReasons = uniqueReasons(reasons);

  return Object.freeze({
    eligible: finalReasons.length === 0,
    slug: draft.slug,
    reasons: finalReasons,
  });
}