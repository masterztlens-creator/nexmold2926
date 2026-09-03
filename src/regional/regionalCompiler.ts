/** NEXMOLD V7.15 — canonical Regional Compiler adapter.
 *
 * V7.15 does not create a second publication architecture. It keeps the
 * V7.14 public contracts and makes eligibility.ts the single eligibility
 * decision source. The compiler remains the sole orchestration boundary.
 */
import {
  evaluateRegionalEligibility,
} from "./eligibility.ts";
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

function blocked(eligibility: RegionalCompileResult["eligibility"], reasonCodes: readonly string[]): V714RegionalCompilerBlocked {
  return {
    published: false,
    result: { eligibility, artifact: null, route: null, hreflang: null },
    reasonCodes: [...new Set(reasonCodes)],
  };
}

export function compileRegionalPage(
  input: V714RegionalCompilerInput,
): V714RegionalCompilerResult {
  if (!input) throw new Error("V714_REGIONAL_COMPILER_INPUT_REQUIRED");

  // V7.13 eligibility.ts is the single authoritative state machine.
  const eligibility = evaluateRegionalEligibility(input.compileInput);
  if (eligibility.status !== "ELIGIBLE") {
    return blocked(eligibility, eligibility.reasonCodes);
  }

  const firewall = runEpistemicFirewall({
    evidence: input.compileInput.evidence,
    semanticClaimIds: input.compileInput.semantic.semanticClaimIds,
    bindings: input.bindings,
  });

  if (!firewall.ok) {
    return blocked(eligibility, firewall.reasonCodes);
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
    return blocked(eligibility, [
      `V715_ARTIFACT_CREATION_FAILED:${error instanceof Error ? error.message : String(error)}`,
    ]);
  }

  const publication = runPublicationGate({
    eligibility,
    firewall,
    artifact,
  });

  if (!publication.ok) {
    return blocked(eligibility, publication.reasonCodes);
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
