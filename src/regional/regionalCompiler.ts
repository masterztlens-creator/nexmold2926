/**
 * NEXMOLD V7.14
 * Regional Compiler
 *
 * Canonical pipeline:
 *
 * Evidence
 *   -> Claim Binding
 *   -> Eligibility
 *   -> Epistemic Firewall
 *   -> Regional Publish Artifact
 *   -> Publication Gate
 *   -> Route / Hreflang Projection
 *
 * FAIL CLOSED.
 *
 * This compiler does not infer evidence.
 * A producer must supply an explicit RegionalCompileInput.
 */

import {
  evaluateRegionalEligibility,
} from "./eligibility.ts";

import {
  runEpistemicFirewall,
  type V714ClaimEvidenceBinding,
  type V714FirewallPass,
} from "./epistemic-firewall.ts";

import {
  createRegionalPublishArtifact,
  projectRegionalRoute,
  projectHreflang,
} from "./regionalPublishArtifact.ts";

import {
  runPublicationGate,
} from "./publication-gate.ts";

import type {
  CanonicalUrl,
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

/**
 * Immutable runtime authorization facts produced by the compiler.
 * Persisted by the factory for independent Publication Gate validation.
 */
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
  readonly result: RegionalCompileResult & {
    readonly publicationAuthorization: V714PublicationAuthorization;
  };
}

export type V714RegionalCompilerResult =
  | V714RegionalCompilerPublished
  | V714RegionalCompilerBlocked;

export function compileRegionalPage(
  input: V714RegionalCompilerInput,
): V714RegionalCompilerResult {
  const compileInput = input.compileInput;

  /*
   * ------------------------------------------------------------
   * 1. Eligibility
   * ------------------------------------------------------------
   *
   * Eligibility consumes already-resolved applicability,
   * compliance and evidence facts.
   */
  const eligibility = evaluateRegionalEligibility(
    compileInput,
  );

  /*
   * ------------------------------------------------------------
   * 2. Epistemic Firewall
   * ------------------------------------------------------------
   */
  const firewall = runEpistemicFirewall({
    evidence: compileInput.evidence,
    semanticClaimIds:
      compileInput.semantic.semanticClaimIds,
    bindings: input.bindings,
  });

  /*
   * ------------------------------------------------------------
   * 3. Immediate fail-closed boundary
   * ------------------------------------------------------------
   *
   * Nothing publishable can be constructed unless BOTH
   * eligibility and firewall pass.
   */
  if (!eligibility.status ||
      eligibility.status !== "ELIGIBLE" ||
      !firewall.ok) {
    return {
      published: false,
      result: {
        eligibility,
        artifact: null,
        route: null,
        hreflang: null,
      },
      reasonCodes: [
        ...(eligibility.reasonCodes ?? []),
        ...(firewall.ok
          ? []
          : firewall.reasonCodes),
      ],
    };
  }

  /*
   * ------------------------------------------------------------
   * 4. Regional Publish Artifact
   * ------------------------------------------------------------
   */
  const artifact = createRegionalPublishArtifact({
    input: compileInput,
    eligibility,
    firewall,
    canonicalUrl: input.canonicalUrl,
    hreflangSet: input.hreflangSet,
  });

  /*
   * ------------------------------------------------------------
   * 5. Publication Gate
   * ------------------------------------------------------------
   */
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

  /*
   * ------------------------------------------------------------
   * 6. Projection
   * ------------------------------------------------------------
   *
   * Artifact is the single projection source.
   */
  const publishedArtifact = publication.artifact;

  const route = projectRegionalRoute(
    publishedArtifact,
  );

  const hreflang = projectHreflang(
    publishedArtifact.pageId,
    publishedArtifact.locale,
    publishedArtifact.region,
    input.canonicalByLocale,
  );

  return {
    published: true,
    result: {
      eligibility,
      artifact: publishedArtifact,
      route,
      hreflang,
      publicationAuthorization: {
        eligibility,
        firewall,
      },
    },
  };
}



