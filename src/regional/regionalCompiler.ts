/** NEXMOLD V7.14 — canonical Regional Compiler. */
import {
  runEpistemicFirewall,
  normalizeFirewallBindings,
  type V714ClaimEvidenceBinding,
  type V714FirewallPass,
} from "./epistemic-firewall.ts";
import {
  createRegionalPublishArtifact,
  projectHreflang,
  projectRegionalRoute,
} from "./regionalPublishArtifact.ts";
import {
  runPublicationGate,
  type V714PublicationGatePass,
} from "./publication-gate.ts";
import type {
  CanonicalUrl,
  EligibleRegionalDecision,
  RegionalCompileInput,
  RegionalCompileResult,
  RegionalEligibilityDecision,
} from "./types.ts";

export interface V714RegionalCompilerInput {
  readonly compileInput: RegionalCompileInput;
  readonly bindings: readonly V714ClaimEvidenceBinding[];
  readonly canonicalUrl: CanonicalUrl;
  readonly hreflangSet: readonly RegionalCompileInput["locale"][];
  readonly canonicalByLocale: ReadonlyMap<
    RegionalCompileInput["locale"],
    CanonicalUrl
  >;
}

export interface V714PublicationAuthorization {
  readonly eligibility: EligibleRegionalDecision;
  readonly firewall: V714FirewallPass;
  readonly publication: V714PublicationGatePass;
}

export interface V714RegionalCompilerBlocked {
  readonly published: false;
  readonly result: RegionalCompileResult;
  readonly reasonCodes: readonly string[];
}

export interface V714RegionalCompilerPublished {
  readonly published: true;
  readonly result: RegionalCompileResult & {
    readonly publicationAuthorization: V714PublicationAuthorization;
  };
}

export type V714RegionalCompilerResult =
  | V714RegionalCompilerPublished
  | V714RegionalCompilerBlocked;

function evaluateEligibility(
  input: RegionalCompileInput,
): RegionalEligibilityDecision {
  const reasons: string[] = [];

  if (input.applicability === "UNKNOWN") {
    reasons.push("V714_ELIGIBILITY_UNKNOWN_APPLICABILITY");
  } else if (input.applicability === "NOT_APPLICABLE") {
    reasons.push("V714_ELIGIBILITY_NOT_APPLICABLE");
  }

  if (input.compliance !== "VERIFIED") {
    reasons.push(`V714_ELIGIBILITY_COMPLIANCE_${input.compliance}`);
  }

  if (input.evidence.completeness !== "COMPLETE") {
    reasons.push("V714_ELIGIBILITY_EVIDENCE_NOT_COMPLETE");
  }

  if (input.semantic.pageId !== input.pageId) {
    reasons.push("V714_ELIGIBILITY_PAGE_ID_MISMATCH");
  }
  if (input.semantic.locale !== input.locale) {
    reasons.push("V714_ELIGIBILITY_LOCALE_MISMATCH");
  }
  if (input.semantic.region !== input.region) {
    reasons.push("V714_ELIGIBILITY_REGION_MISMATCH");
  }

  if (reasons.length === 0) {
    return {
      pageId: input.pageId,
      locale: input.locale,
      region: input.region,
      applicability: "APPLICABLE",
      compliance: "VERIFIED",
      evidence: input.evidence as EligibleRegionalDecision["evidence"],
      status: "ELIGIBLE",
      reasonCodes: [],
    };
  }

  const status =
    input.applicability === "NOT_APPLICABLE"
      ? "NOT_APPLICABLE"
      : input.compliance === "REQUIRES_REVIEW" ||
          input.compliance === "UNKNOWN"
        ? "REQUIRES_REVIEW"
        : "BLOCKED";

  if (status === "NOT_APPLICABLE") {
    return {
      pageId: input.pageId,
      locale: input.locale,
      region: input.region,
      applicability: "NOT_APPLICABLE",
      compliance: input.compliance,
      evidence: input.evidence,
      status,
      reasonCodes: reasons,
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
          : "UNKNOWN",
      evidence: input.evidence,
      status,
      reasonCodes: reasons,
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
    reasonCodes: reasons,
  };
}

export function compileRegionalPage(
  input: V714RegionalCompilerInput,
): V714RegionalCompilerResult {
  if (!input) {
    throw new Error("V714_REGIONAL_COMPILER_INPUT_REQUIRED");
  }

  const eligibility = evaluateEligibility(input.compileInput);

  const firewall = runEpistemicFirewall({
    evidence: input.compileInput.evidence,
    semanticClaimIds: input.compileInput.semantic.semanticClaimIds,
    bindings: input.bindings,
  });

  if (eligibility.status !== "ELIGIBLE" || !firewall.ok) {
    return {
      published: false,
      result: {
        eligibility,
        artifact: null,
        route: null,
        hreflang: null,
      },
      reasonCodes: [
        ...eligibility.reasonCodes,
        ...(firewall.ok ? [] : firewall.reasonCodes),
      ],
    };
  }

  const artifactBindings = normalizeFirewallBindings(input.bindings);

  let artifact;
  try {
    artifact = createRegionalPublishArtifact({
      input: input.compileInput,
      eligibility,
      firewall,
      bindings: artifactBindings,
      canonicalUrl: input.canonicalUrl,
      hreflangSet: input.hreflangSet,
    });
  } catch (error) {
    return {
      published: false,
      result: {
        eligibility,
        artifact: null,
        route: null,
        hreflang: null,
      },
      reasonCodes: [
        `V714_ARTIFACT_CREATION_FAILED:${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
    };
  }

  const publication = runPublicationGate({
    eligibility,
    firewall,
    artifact,
  });

  if (!publication.ok) {
    return {
      published: false,
      result: {
        eligibility,
        artifact: null,
        route: null,
        hreflang: null,
      },
      reasonCodes: publication.reasonCodes,
    };
  }

  const publishedArtifact = publication.artifact;

  return {
    published: true,
    result: {
      eligibility,
      artifact: publishedArtifact,
      route: projectRegionalRoute(publishedArtifact),
      hreflang: projectHreflang(
        publishedArtifact.pageId,
        publishedArtifact.locale,
        publishedArtifact.region,
        input.canonicalByLocale,
      ),
      publicationAuthorization: {
        eligibility,
        firewall,
        publication,
      },
    },
  };
}
