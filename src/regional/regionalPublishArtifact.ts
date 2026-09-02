/**
 * NEXMOLD V7.14 — Regional Publish Artifact Factory
 *
 * The only constructor for a publishable regional artifact.
 * No inference, I/O, URL generation, or evidence discovery occurs here.
 * All publication inputs must already be explicit and adjudicated upstream.
 */
import { createHash } from 'node:crypto';

import type {
  CanonicalUrl,
  ContentHash,
  EligibleRegionalDecision,
  HreflangProjection,
  Locale,
  PageId,
  RegionalCompileInput,
  RegionalPublishArtifact,
  RegionalRouteProjection,
} from './types.ts';

import {
  regionalPublishArtifactBrand,
} from './types.ts';

import type { V714FirewallPass } from './epistemic-firewall.ts';

export const REGIONAL_PUBLISH_ARTIFACT_VERSION =
  'V7.14-PUBLISH-ARTIFACT-1' as const;

type ArtifactInput = {
  readonly input: RegionalCompileInput;
  readonly eligibility: EligibleRegionalDecision;
  readonly firewall: V714FirewallPass;
  readonly canonicalUrl: CanonicalUrl;
  readonly hreflangSet: readonly Locale[];
};

function hash(value: unknown): ContentHash {
  const canonical =
    typeof value === 'object' && value !== null
      ? JSON.stringify(value, Object.keys(value as object).sort())
      : JSON.stringify(value);

  return createHash('sha256')
    .update(canonical, 'utf8')
    .digest('hex') as ContentHash;
}

function assertEligible(input: ArtifactInput): void {
  if (!input.firewall.ok) {
    throw new Error('V714_ARTIFACT_FIREWALL_REQUIRED');
  }

  if (input.eligibility.status !== 'ELIGIBLE') {
    throw new Error('V714_ARTIFACT_ELIGIBILITY_REQUIRED');
  }

  if (input.eligibility.applicability !== 'APPLICABLE') {
    throw new Error('V714_ARTIFACT_APPLICABILITY_REQUIRED');
  }

  if (input.eligibility.compliance !== 'VERIFIED') {
    throw new Error('V714_ARTIFACT_COMPLIANCE_REQUIRED');
  }

  if (input.eligibility.evidence.completeness !== 'COMPLETE') {
    throw new Error('V714_ARTIFACT_EVIDENCE_REQUIRED');
  }

  if (input.input.semantic.pageId !== input.input.pageId) {
    throw new Error('V714_ARTIFACT_PAGE_ID_MISMATCH');
  }

  if (input.input.semantic.locale !== input.input.locale) {
    throw new Error('V714_ARTIFACT_LOCALE_MISMATCH');
  }

  if (input.input.semantic.region !== input.input.region) {
    throw new Error('V714_ARTIFACT_REGION_MISMATCH');
  }

  if (!input.canonicalUrl.trim()) {
    throw new Error('V714_ARTIFACT_CANONICAL_URL_EMPTY');
  }

  if (input.hreflangSet.length === 0) {
    throw new Error('V714_ARTIFACT_HREFLANG_EMPTY');
  }
}

export function createRegionalPublishArtifact(
  input: ArtifactInput,
): RegionalPublishArtifact {
  assertEligible(input);

  const pageContentHash = hash({
    pageId: input.input.pageId,
    locale: input.input.locale,
    region: input.input.region,
    semanticClaimIds: input.input.semantic.semanticClaimIds,
    evidenceIds: input.input.evidence.evidence.map((x) => x.id),
    canonicalUrl: input.canonicalUrl,
    hreflangSet: input.hreflangSet,
  });

  const artifact: RegionalPublishArtifact = Object.freeze({
    [regionalPublishArtifactBrand]: 'RegionalPublishArtifact' as const,
    pageId: input.input.pageId,
    locale: input.input.locale,
    region: input.input.region,
    canonicalUrl: input.canonicalUrl,
    hreflangSet: [...input.hreflangSet],
    seoEligibility: input.eligibility,
    pageContentHash,
  });

  return artifact;
}

export function projectRegionalRoute(
  artifact: RegionalPublishArtifact,
): RegionalRouteProjection {
  return Object.freeze({
    pageId: artifact.pageId,
    locale: artifact.locale,
    region: artifact.region,
    canonicalUrl: artifact.canonicalUrl,
    contentHash: artifact.pageContentHash,
    artifact,
  });
}

export function projectHreflang(
  pageId: PageId,
  sourceLocale: Locale,
  _region: RegionalPublishArtifact['region'],
  canonicalByLocale: ReadonlyMap<Locale, CanonicalUrl>,
): HreflangProjection {
  const edges = [...canonicalByLocale.entries()].map(
    ([targetLocale, targetCanonicalUrl]) => ({
      sourcePageId: pageId,
      sourceLocale,
      targetLocale,
      targetCanonicalUrl,
    }),
  );

  return Object.freeze({ pageId, edges });
}



