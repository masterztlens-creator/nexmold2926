
import type {
  ContentDraft,
  QualityReport,
} from "../shared.js";
import {
  compileGeo,
} from "../geo/compiler.js";
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
 * Existing quality-firewall, semantic-collision, novelty, and evidence
 * checks remain in place. SEO and GEO structural audits are now part
 * of the actual publication decision.
 *
 * Passing structural checks does not establish factual correctness,
 * search ranking, or citation-to-claim support. Those require their
 * respective evidence and provenance gates.
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

  try {
    const seoReport = auditSeoArtifact(
      compileSeo(draft),
    );

    seoAuditPassed = seoReport.passed;

    for (const finding of seoReport.findings) {
      if (finding.severity === "BLOCK") {
        reasons.push(
          `seo-quality:${finding.code}`,
        );
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

    for (const finding of geoReport.findings) {
      if (finding.severity === "BLOCK") {
        reasons.push(
          `geo-quality:${finding.code}`,
        );
      }
    }
  } catch {
    reasons.push("geo-quality:audit-error");
  }

  // Explicit fail-closed guards protect against future changes to
  // audit implementations that might otherwise omit a blocking finding.
  if (!seoAuditPassed && !reasons.some(
    (reason) => reason.startsWith("seo-quality:"),
  )) {
    reasons.push("seo-quality:failed");
  }

  if (!geoAuditPassed && !reasons.some(
    (reason) => reason.startsWith("geo-quality:"),
  )) {
    reasons.push("geo-quality:failed");
  }

  const finalReasons = uniqueReasons(reasons);

  return Object.freeze({
    eligible: finalReasons.length === 0,
    slug: draft.slug,
    reasons: finalReasons,
  });
}
