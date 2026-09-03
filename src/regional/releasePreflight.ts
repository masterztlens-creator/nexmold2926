/** NEXMOLD V7.15 — Regional release preflight. */
import type { V714RegionalCompilerPublished } from "./regionalCompiler.ts";
import { runPublicationGate } from "./publication-gate.ts";
import { validateRegionalPublishArtifactRuntime } from "./publication-gate.ts";
import type { RegionalEligibilityDecision } from "./types.ts";

export type RegionalPublishedCompileResult = V714RegionalCompilerPublished["result"];

export interface RegionalReleasePreflightResult {
  readonly passed: boolean;
  readonly checks: readonly { readonly id: string; readonly passed: boolean }[];
}

export function runRegionalReleasePreflight(result: RegionalPublishedCompileResult): RegionalReleasePreflightResult {
  const artifact = result.artifact;
  const route = result.route;
  const hreflang = result.hreflang;
  const authorization = result.publicationAuthorization;

  const publicationRevalidated =
    artifact !== null &&
    authorization !== undefined &&
    authorization.eligibility === result.eligibility &&
    authorization.firewall !== undefined &&
    runPublicationGate({
      eligibility: authorization.eligibility as RegionalEligibilityDecision,
      firewall: authorization.firewall,
      artifact,
    });

  const checks = [
    { id:"eligibility-present", passed:Boolean(result.eligibility) },
    { id:"eligible-status", passed:result.eligibility.status === "ELIGIBLE" },
    { id:"publication-authorization-present", passed:Boolean(authorization) },
    { id:"publication-gate-passed", passed:Boolean(authorization?.publication?.ok === true) },
    { id:"publication-gate-revalidated", passed:Boolean(publicationRevalidated?.ok === true) },
    { id:"authorization-eligibility-identity", passed:Boolean(authorization && authorization.eligibility === result.eligibility) },
    { id:"authorized-artifact-identity", passed:Boolean(authorization && authorization.publication?.ok === true && authorization.publication.artifact === artifact) },
    { id:"artifact-runtime-valid", passed:artifact === null || validateRegionalPublishArtifactRuntime(artifact) },
    { id:"artifact-present-for-eligible", passed:result.eligibility.status !== "ELIGIBLE" || artifact !== null },
    { id:"route-present-for-eligible", passed:result.eligibility.status !== "ELIGIBLE" || route !== null },
    { id:"hreflang-present-for-eligible", passed:result.eligibility.status !== "ELIGIBLE" || hreflang !== null },
    { id:"artifact-route-identity", passed:artifact === null || route === null || (artifact === route.artifact && artifact.pageId === route.pageId && artifact.locale === route.locale && artifact.region === route.region) },
    { id:"artifact-hash-identity", passed:artifact === null || route === null || artifact.pageContentHash === route.contentHash },
    { id:"artifact-canonical-identity", passed:artifact === null || route === null || artifact.canonicalUrl === route.canonicalUrl },
    { id:"blocked-has-zero-public-projections", passed:result.eligibility.status === "ELIGIBLE" || (artifact === null && route === null && hreflang === null) },
  ];
  return Object.freeze({ passed:checks.every(check => check.passed), checks });
}
