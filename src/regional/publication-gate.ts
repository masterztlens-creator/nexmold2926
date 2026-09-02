/**
 * NEXMOLD V7.14
 * Publication Gate
 *
 * Production contract:
 *
 * Evidence
 *   -> Semantic
 *   -> Eligibility
 *   -> Firewall
 *   -> RegionalPublishArtifact
 *   -> Publication Gate
 *   -> Projection
 *
 * HARD RULES
 * ------------------------------------------------------------------
 * 1. Gate never creates an artifact.
 * 2. Gate never infers eligibility.
 * 3. Gate never discovers evidence.
 * 4. Gate never generates URLs.
 * 5. Gate never mutates source data.
 * 6. Gate fails closed.
 * 7. A null artifact can never pass.
 * 8. A structurally invalid artifact can never pass.
 * 9. Artifact identity must agree with eligibility identity.
 * 10. Artifact is the only publishable projection source.
 */

import type {
  EligibleRegionalDecision,
  PageId,
  RegionalEligibilityDecision,
  RegionalPublishArtifact,
} from "./types.ts";

import type {
  V714FirewallPass,
} from "./epistemic-firewall.ts";

/* ================================================================
   CONTRACT
   ================================================================ */

export interface V714PublicationGateInput {
  readonly eligibility: RegionalEligibilityDecision;
  readonly firewall: V714FirewallPass;
  readonly artifact: RegionalPublishArtifact | null;
}

export interface V714PublicationGatePass {
  readonly ok: true;
  readonly artifact: RegionalPublishArtifact;
}

export interface V714PublicationGateBlock {
  readonly ok: false;
  readonly reasonCodes: readonly string[];
}

export type V714PublicationGateResult =
  | V714PublicationGatePass
  | V714PublicationGateBlock;

/* ================================================================
   REASON CODES
   ================================================================ */

export const V714PublicationGateReason = {
  FIREWALL_NOT_PASSED:
    "V714_FIREWALL_NOT_PASSED",

  ELIGIBILITY_NOT_ELIGIBLE:
    "V714_ELIGIBILITY_NOT_ELIGIBLE",

  APPLICABILITY_NOT_APPLICABLE:
    "V714_APPLICABILITY_NOT_APPLICABLE",

  COMPLIANCE_NOT_VERIFIED:
    "V714_COMPLIANCE_NOT_VERIFIED",

  EVIDENCE_NOT_COMPLETE:
    "V714_EVIDENCE_NOT_COMPLETE",

  ARTIFACT_ABSENT:
    "V714_PUBLIC_ARTIFACT_ABSENT",

  ARTIFACT_INVALID:
    "V714_PUBLIC_ARTIFACT_INVALID",

  ARTIFACT_PAGE_ID_MISMATCH:
    "V714_ARTIFACT_PAGE_ID_MISMATCH",

  ARTIFACT_LOCALE_MISMATCH:
    "V714_ARTIFACT_LOCALE_MISMATCH",

  ARTIFACT_REGION_MISMATCH:
    "V714_ARTIFACT_REGION_MISMATCH",

  ARTIFACT_CANONICAL_MISSING:
    "V714_ARTIFACT_CANONICAL_MISSING",

  ARTIFACT_HREFLANG_EMPTY:
    "V714_ARTIFACT_HREFLANG_EMPTY",

  ARTIFACT_HASH_MISSING:
    "V714_ARTIFACT_HASH_MISSING",

  ARTIFACT_ELIGIBILITY_MISMATCH:
    "V714_ARTIFACT_ELIGIBILITY_MISMATCH",
} as const;

/* ================================================================
   SAFE RUNTIME HELPERS
   ================================================================ */

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function nonEmptyString(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function isNonEmptyArray(
  value: unknown,
): value is readonly unknown[] {
  return (
    Array.isArray(value) &&
    value.length > 0
  );
}

/* ================================================================
   ARTIFACT STRUCTURAL VALIDATION
   ================================================================ */

/**
 * Runtime validation is deliberately structural.
 *
 * Why:
 *
 * RegionalPublishArtifact is branded with a unique symbol in
 * TypeScript. That brand does not survive JSON serialization.
 *
 * Therefore:
 *
 *   in-memory compiler boundary
 *       -> branded type
 *
 *   persisted production artifact
 *       -> structural contract validation
 *
 * This is the correct production boundary.
 */
export function validateRegionalPublishArtifactRuntime(
  artifact: unknown,
): artifact is RegionalPublishArtifact {
  if (!isRecord(artifact)) {
    return false;
  }

  if (
    !nonEmptyString(
      artifact.pageId,
    )
  ) {
    return false;
  }

  if (
    !nonEmptyString(
      artifact.locale,
    )
  ) {
    return false;
  }

  if (
    !nonEmptyString(
      artifact.region,
    )
  ) {
    return false;
  }

  if (
    !nonEmptyString(
      artifact.canonicalUrl,
    )
  ) {
    return false;
  }

  if (
    !isNonEmptyArray(
      artifact.hreflangSet,
    )
  ) {
    return false;
  }

  if (
    !nonEmptyString(
      artifact.pageContentHash,
    )
  ) {
    return false;
  }

  if (
    !isRecord(
      artifact.seoEligibility,
    )
  ) {
    return false;
  }

  return true;
}

/* ================================================================
   ARTIFACT / ELIGIBILITY IDENTITY CHECK
   ================================================================ */

function validateArtifactIdentity(
  artifact: RegionalPublishArtifact,
  eligibility: RegionalEligibilityDecision,
): readonly string[] {
  const reasons: string[] = [];

  if (
    artifact.pageId !==
    eligibility.pageId
  ) {
    reasons.push(
      V714PublicationGateReason
        .ARTIFACT_PAGE_ID_MISMATCH,
    );
  }

  if (
    artifact.locale !==
    eligibility.locale
  ) {
    reasons.push(
      V714PublicationGateReason
        .ARTIFACT_LOCALE_MISMATCH,
    );
  }

  if (
    artifact.region !==
    eligibility.region
  ) {
    reasons.push(
      V714PublicationGateReason
        .ARTIFACT_REGION_MISMATCH,
    );
  }

  return reasons;
}

/* ================================================================
   ELIGIBILITY CHECK
   ================================================================ */

function validateArtifactEligibility(
  artifact: RegionalPublishArtifact,
  eligibility: RegionalEligibilityDecision,
): readonly string[] {
  const embedded = artifact.seoEligibility;

  if (
    embedded.pageId !== eligibility.pageId ||
    embedded.locale !== eligibility.locale ||
    embedded.region !== eligibility.region ||
    embedded.status !== eligibility.status ||
    embedded.applicability !== eligibility.applicability ||
    embedded.compliance !== eligibility.compliance ||
    embedded.evidence.completeness !==
      eligibility.evidence.completeness
  ) {
    return [
      V714PublicationGateReason
        .ARTIFACT_ELIGIBILITY_MISMATCH,
    ];
  }

  return [];
}

function validateEligibility(
  eligibility: RegionalEligibilityDecision,
): readonly string[] {
  const reasons: string[] = [];

  if (
    eligibility.status !==
    "ELIGIBLE"
  ) {
    reasons.push(
      `${V714PublicationGateReason.ELIGIBILITY_NOT_ELIGIBLE}:${String(
        eligibility.status,
      )}`,
    );
  }

  if (
    eligibility.applicability !==
    "APPLICABLE"
  ) {
    reasons.push(
      V714PublicationGateReason
        .APPLICABILITY_NOT_APPLICABLE,
    );
  }

  if (
    eligibility.compliance !==
    "VERIFIED"
  ) {
    reasons.push(
      V714PublicationGateReason
        .COMPLIANCE_NOT_VERIFIED,
    );
  }

  if (
    eligibility.evidence.completeness !==
    "COMPLETE"
  ) {
    reasons.push(
      V714PublicationGateReason
        .EVIDENCE_NOT_COMPLETE,
    );
  }

  return reasons;
}

/* ================================================================
   MAIN PUBLICATION GATE
   ================================================================ */

export function runPublicationGate(
  input: V714PublicationGateInput,
): V714PublicationGateResult {
  const reasons: string[] = [];

  /* --------------------------------------------------------------
     Gate 01 — Epistemic Firewall
     -------------------------------------------------------------- */

  if (
    !input.firewall ||
    input.firewall.ok !== true
  ) {
    reasons.push(
      V714PublicationGateReason
        .FIREWALL_NOT_PASSED,
    );
  }

  /* --------------------------------------------------------------
     Gate 02 — Eligibility
     -------------------------------------------------------------- */

  reasons.push(
    ...validateEligibility(
      input.eligibility,
    ),
  );

  /* --------------------------------------------------------------
     Gate 03 — Artifact existence
     -------------------------------------------------------------- */

  if (
    input.artifact === null
  ) {
    reasons.push(
      V714PublicationGateReason
        .ARTIFACT_ABSENT,
    );
  }

  /*
   * Structural validation is performed before any property access.
   *
   * This prevents a malformed JSON artifact from being promoted
   * through a TypeScript-only assertion.
   */
  if (
    input.artifact !== null &&
    !validateRegionalPublishArtifactRuntime(
      input.artifact,
    )
  ) {
    reasons.push(
      V714PublicationGateReason
        .ARTIFACT_INVALID,
    );
  }

  /* --------------------------------------------------------------
     Gate 04 — Artifact identity
     -------------------------------------------------------------- */

  if (
    input.artifact !== null &&
    validateRegionalPublishArtifactRuntime(
      input.artifact,
    )
  ) {
    reasons.push(
      ...validateArtifactIdentity(
        input.artifact,
        input.eligibility,
      ),
    );

    reasons.push(
      ...validateArtifactEligibility(
        input.artifact,
        input.eligibility,
      ),
    );

    if (
      !nonEmptyString(
        input.artifact.canonicalUrl,
      )
    ) {
      reasons.push(
        V714PublicationGateReason
          .ARTIFACT_CANONICAL_MISSING,
      );
    }

    if (
      !isNonEmptyArray(
        input.artifact.hreflangSet,
      )
    ) {
      reasons.push(
        V714PublicationGateReason
          .ARTIFACT_HREFLANG_EMPTY,
      );
    }

    if (
      !nonEmptyString(
        input.artifact.pageContentHash,
      )
    ) {
      reasons.push(
        V714PublicationGateReason
          .ARTIFACT_HASH_MISSING,
      );
    }
  }

  /* --------------------------------------------------------------
     FAIL CLOSED
     -------------------------------------------------------------- */

  if (
    reasons.length > 0
  ) {
    return {
      ok: false,
      reasonCodes: [
        ...new Set(reasons),
      ],
    };
  }

  /* --------------------------------------------------------------
     Publication Pass
     -------------------------------------------------------------- */

  /*
   * At this point artifact is known to be non-null and structurally
   * valid. The runtime validator above establishes the boundary.
   */
  const artifact =
    input.artifact as RegionalPublishArtifact;

  return {
    ok: true,
    artifact,
  };
}