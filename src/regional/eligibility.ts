/**
 * NEXMOLD V7.13 鈥?Regional Eligibility Decision Engine
 *
 * Phase 1 / Step 02
 *
 * Dependency boundary:
 *
 *   types.ts
 *      鈫? *   eligibility.ts
 *
 * This module performs ONLY eligibility adjudication.
 *
 * It MUST NOT:
 * - resolve evidence;
 * - infer applicability;
 * - infer compliance;
 * - create RegionalPublishArtifact;
 * - generate URLs/routes;
 * - generate hreflang;
 * - hash content;
 * - perform I/O;
 * - mutate input.
 */

import type {
  ComplianceClaim,
  RegionalCompileInput,
  RegionalEligibilityDecision,
  RegionalApplicability,
  EvidenceCompleteness,
} from "./types.ts";

export const ELIGIBILITY_ENGINE_VERSION = "V7.13-P1-S02" as const;

export const REASON = {
  APPLICABILITY_NOT_APPLICABLE:
    "REGIONAL_APPLICABILITY_NOT_APPLICABLE",
  APPLICABILITY_UNKNOWN:
    "REGIONAL_APPLICABILITY_UNKNOWN",
  COMPLIANCE_NOT_VERIFIED:
    "REGIONAL_COMPLIANCE_NOT_VERIFIED",
  COMPLIANCE_REQUIRES_REVIEW:
    "REGIONAL_COMPLIANCE_REQUIRES_REVIEW",
  COMPLIANCE_UNKNOWN:
    "REGIONAL_COMPLIANCE_UNKNOWN",
  EVIDENCE_INCOMPLETE:
    "REGIONAL_EVIDENCE_INCOMPLETE",
  EVIDENCE_UNKNOWN:
    "REGIONAL_EVIDENCE_UNKNOWN",
  INPUT_INVALID:
    "REGIONAL_INPUT_INVALID",
} as const;

function assertNever(value: never): never {
  throw new Error(
    `REGIONAL_ELIGIBILITY_UNHANDLED_STATE: ${String(value)}`,
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isLocale(value: unknown): value is RegionalCompileInput["locale"] {
  switch (value) {
    case "en-US":
    case "en-GB":
    case "de-DE":
      return true;
    default:
      return false;
  }
}

function isRegion(value: unknown): value is RegionalCompileInput["region"] {
  switch (value) {
    case "US":
    case "GB":
    case "DE":
      return true;
    default:
      return false;
  }
}

function isRegionalApplicability(
  value: unknown,
): value is RegionalApplicability {
  switch (value) {
    case "APPLICABLE":
    case "NOT_APPLICABLE":
    case "UNKNOWN":
      return true;
    default:
      return false;
  }
}

function isComplianceClaim(
  value: unknown,
): value is ComplianceClaim {
  switch (value) {
    case "VERIFIED":
    case "NOT_VERIFIED":
    case "REQUIRES_REVIEW":
    case "UNKNOWN":
      return true;
    default:
      return false;
  }
}

function isEvidenceCompleteness(
  value: unknown,
): value is EvidenceCompleteness {
  switch (value) {
    case "COMPLETE":
    case "INCOMPLETE":
    case "UNKNOWN":
      return true;
    default:
      return false;
  }
}

/**
 * Runtime validation protects the JSON/JS boundary.
 *
 * Because the public function is contract-typed as RegionalCompileInput,
 * this validator never fabricates branded identifiers. A malformed object
 * cannot enter the decision state machine.
 */
function isValidCompileInput(
  input: RegionalCompileInput,
): boolean {
  if (!isObject(input)) return false;

  if (!isNonEmptyString(input.pageId)) return false;
  if (!isLocale(input.locale)) return false;
  if (!isRegion(input.region)) return false;

  if (!isRegionalApplicability(input.applicability)) return false;
  if (!isComplianceClaim(input.compliance)) return false;

  if (!isObject(input.semantic)) return false;
  if (!isNonEmptyString(input.semantic.pageId)) return false;
  if (!isLocale(input.semantic.locale)) return false;
  if (!isRegion(input.semantic.region)) return false;
  if (!Array.isArray(input.semantic.semanticClaimIds)) return false;

  if (!isObject(input.evidence)) return false;
  if (!Array.isArray(input.evidence.evidence)) return false;
  if (!Array.isArray(input.evidence.semanticClaims)) return false;
  if (!isEvidenceCompleteness(input.evidence.completeness)) return false;

  return true;
}

function collectReasonCodes(
  input: RegionalCompileInput,
): readonly string[] {
  const reasonCodes: string[] = [];

  if (input.applicability === "NOT_APPLICABLE") {
    reasonCodes.push(REASON.APPLICABILITY_NOT_APPLICABLE);
  } else if (input.applicability !== "APPLICABLE") {
    reasonCodes.push(REASON.APPLICABILITY_UNKNOWN);
  }

  if (input.compliance === "REQUIRES_REVIEW") {
    reasonCodes.push(REASON.COMPLIANCE_REQUIRES_REVIEW);
  } else if (input.compliance === "NOT_VERIFIED") {
    reasonCodes.push(REASON.COMPLIANCE_NOT_VERIFIED);
  } else if (input.compliance !== "VERIFIED") {
    reasonCodes.push(REASON.COMPLIANCE_UNKNOWN);
  }

  if (input.evidence.completeness === "INCOMPLETE") {
    reasonCodes.push(REASON.EVIDENCE_INCOMPLETE);
  } else if (input.evidence.completeness !== "COMPLETE") {
    reasonCodes.push(REASON.EVIDENCE_UNKNOWN);
  }

  return reasonCodes;
}

function finalNonPublishStatus(
  input: RegionalCompileInput,
): "BLOCKED" | "NOT_APPLICABLE" | "REQUIRES_REVIEW" {
  switch (input.applicability) {
    case "NOT_APPLICABLE":
      return "NOT_APPLICABLE";

    case "APPLICABLE":
      switch (input.compliance) {
        case "REQUIRES_REVIEW":
          return "REQUIRES_REVIEW";

        case "VERIFIED":
        case "NOT_VERIFIED":
        case "UNKNOWN":
          return "BLOCKED";

        default:
          return assertNever(input.compliance);
      }

    case "UNKNOWN":
      return "BLOCKED";

    default:
      return assertNever(input.applicability);
  }
}

/**
 * Authoritative Step 02 state machine.
 *
 * Golden path:
 *
 *   APPLICABLE + VERIFIED + COMPLETE
 *                鈫? *             ELIGIBLE
 *
 * Every other state is non-publishable.
 */
export function evaluateRegionalEligibility(
  input: RegionalCompileInput,
): RegionalEligibilityDecision {
  if (!isValidCompileInput(input)) {
    throw new Error(REASON.INPUT_INVALID);
  }

  const isApplicable = input.applicability === "APPLICABLE";
  const isVerified = input.compliance === "VERIFIED";
  const isComplete = input.evidence.completeness === "COMPLETE";

  /**
   * Golden path:
   *
   * APPLICABLE + VERIFIED + COMPLETE
   *              ↓
   *          ELIGIBLE
   *
   * The evidence completeness narrowing is made explicit here so the
   * EligibleRegionalDecision contract is satisfied without inference.
   */
  if (isApplicable && isVerified && isComplete) {
    const completeEvidence = {
      ...input.evidence,
      completeness: "COMPLETE" as const,
    };

    return {
      pageId: input.pageId,
      locale: input.locale,
      region: input.region,
      applicability: "APPLICABLE",
      compliance: "VERIFIED",
      evidence: completeEvidence,
      status: "ELIGIBLE",
      reasonCodes: [],
    };
  }

  const reasonCodes = collectReasonCodes(input);
  const status = finalNonPublishStatus(input);

  /**
   * Explicit discriminant branches are intentional.
   * RegionalEligibilityDecision is a discriminated union and must not
   * receive an object containing a broad status union.
   */
  if (status === "NOT_APPLICABLE") {
    return {
      pageId: input.pageId,
      locale: input.locale,
      region: input.region,
      applicability: "NOT_APPLICABLE",
      compliance: input.compliance,
      evidence: input.evidence,
      status: "NOT_APPLICABLE",
      reasonCodes,
    };
  }

  if (status === "REQUIRES_REVIEW") {
    return {
      pageId: input.pageId,
      locale: input.locale,
      region: input.region,
      applicability: input.applicability,
      compliance:
        input.compliance === "REQUIRES_REVIEW" ||
        input.compliance === "UNKNOWN"
          ? input.compliance
          : "REQUIRES_REVIEW",
      evidence: input.evidence,
      status: "REQUIRES_REVIEW",
      reasonCodes,
    };
  }

  return {
    pageId: input.pageId,
    locale: input.locale,
    region: input.region,
    applicability: input.applicability,
    compliance: input.compliance,
    evidence: input.evidence,
    status: "BLOCKED",
    reasonCodes,
  };
}

/**
 * Exhaustiveness anchors.
 *
 * These functions are intentionally tiny and side-effect free. They make
 * future enum expansion a compile-time review event.
 */
export function classifyApplicability(
  value: RegionalApplicability,
): "CONTINUE" | "NOT_APPLICABLE" | "BLOCKED" {
  switch (value) {
    case "APPLICABLE":
      return "CONTINUE";
    case "NOT_APPLICABLE":
      return "NOT_APPLICABLE";
    case "UNKNOWN":
      return "BLOCKED";
    default:
      return assertNever(value);
  }
}

export function classifyCompliance(
  value: ComplianceClaim,
): "CONTINUE" | "BLOCKED" | "REQUIRES_REVIEW" {
  switch (value) {
    case "VERIFIED":
      return "CONTINUE";
    case "NOT_VERIFIED":
    case "UNKNOWN":
      return "BLOCKED";
    case "REQUIRES_REVIEW":
      return "REQUIRES_REVIEW";
    default:
      return assertNever(value);
  }
}

export function classifyEvidenceCompleteness(
  value: EvidenceCompleteness,
): "CONTINUE" | "BLOCKED" {
  switch (value) {
    case "COMPLETE":
      return "CONTINUE";
    case "INCOMPLETE":
    case "UNKNOWN":
      return "BLOCKED";
    default:
      return assertNever(value);
  }
}




