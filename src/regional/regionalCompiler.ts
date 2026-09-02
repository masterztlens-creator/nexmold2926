/**
 * NEXMOLD V7.14 — Regional Compiler
 * Evidence -> Claim Binding -> Eligibility -> Firewall -> Artifact -> Gate -> Projection.
 */
import { evaluateRegionalEligibility } from "./eligibility.ts";
import { runEpistemicFirewall, type V714ClaimEvidenceBinding, type V714FirewallPass } from "./epistemic-firewall.ts";
import { createRegionalPublishArtifact, projectRegionalRoute, projectHreflang } from "./regionalPublishArtifact.ts";
import { runPublicationGate } from "./publication-gate.ts";
import type { CanonicalUrl, RegionalCompileInput, RegionalCompileResult } from "./types.ts";

export interface V714RegionalCompilerInput {
  readonly compileInput: RegionalCompileInput;
  readonly bindings: readonly V714ClaimEvidenceBinding[];
  readonly canonicalUrl: CanonicalUrl;
  readonly hreflangSet: readonly RegionalCompileInput["locale"][];
  readonly canonicalByLocale: ReadonlyMap<RegionalCompileInput["locale"], CanonicalUrl>;
}
export interface V714PublicationAuthorization {
  readonly eligibility: RegionalCompileResult["eligibility"];
  readonly firewall: V714FirewallPass;
}
export interface V714RegionalCompilerBlocked {
  readonly published: false;
  readonly result: RegionalCompileResult;
  readonly reasonCodes: readonly string[];
}
export interface V714RegionalCompilerPublished {
  readonly published: true;
  readonly result: RegionalCompileResult & { readonly publicationAuthorization: V714PublicationAuthorization };
}
export type V714RegionalCompilerResult = V714RegionalCompilerPublished | V714RegionalCompilerBlocked;

export function compileRegionalPage(input: V714RegionalCompilerInput): V714RegionalCompilerResult {
  const compileInput = input.compileInput;
  const eligibility = evaluateRegionalEligibility(compileInput);
  const firewall = runEpistemicFirewall({
    evidence: compileInput.evidence,
    semanticClaimIds: compileInput.semantic.semanticClaimIds,
    bindings: input.bindings,
  });

  if (eligibility.status !== "ELIGIBLE" || !firewall.ok) {
    return {
      published: false,
      result: { eligibility, artifact: null, route: null, hreflang: null },
      reasonCodes: [...(eligibility.reasonCodes ?? []), ...(firewall.ok ? [] : firewall.reasonCodes)],
    };
  }

  const artifact = createRegionalPublishArtifact({
    input: compileInput, eligibility, firewall, bindings: input.bindings,
    canonicalUrl: input.canonicalUrl, hreflangSet: input.hreflangSet,
  });

  const publication = runPublicationGate({ eligibility, firewall, artifact });
  if (!publication.ok) {
    return {
      published: false,
      result: { eligibility, artifact: null, route: null, hreflang: null },
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
        publishedArtifact.pageId, publishedArtifact.locale, publishedArtifact.region,
        input.canonicalByLocale,
      ),
      publicationAuthorization: { eligibility, firewall },
    },
  };
}
