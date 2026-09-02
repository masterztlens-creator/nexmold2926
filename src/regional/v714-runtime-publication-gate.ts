import {
  runPublicationGate,
  validateRegionalPublishArtifactRuntime,
} from "./publication-gate.ts";
import type { RegionalEligibilityDecision, RegionalPublishArtifact } from "./types.ts";
import type { V714FirewallPass } from "./epistemic-firewall.ts";

export interface PublicationArtifactEvidence {
  evidence?: unknown[];
  semanticClaims?: unknown[];
  completeness?: string;
}

export interface PublicationArtifact {
  pageContentHash?: string;
  canonicalUrl?: string;
  hreflangSet?: readonly string[];
  evidence?: PublicationArtifactEvidence;
  bindings?: readonly unknown[];
  [key: string]: unknown;
}

export interface ProductionFlags {
  whitePaper?: boolean;
  publishedArtifact?: boolean;
  automaticPublication?: boolean;
  existingSiteContentModified?: boolean;
  historicalBatch01Modified?: boolean;
}

export interface PublicationAuthorization {
  eligibility?: unknown;
  firewall?: unknown;
}

export interface PublicationMetadata {
  schema?: string;
  producerVersion?: string;
  factoryRun?: string;
  articleId?: string;
  targetSlug?: string;
  route?: string;
  sourceArticleSlug?: string;
  sourceArtifactHash?: string;
  canonicalUrl?: string;
  publicationAuthorization?: PublicationAuthorization;
  artifact?: PublicationArtifact;
  articleContract?: Record<string, unknown>;
  production?: ProductionFlags;
  [key: string]: unknown;
}

export interface PublicationReport {
  schema?: string;
  results?: PublicationReportItem[];
  [key: string]: unknown;
}

export interface PublicationReportItem {
  id?: string;
  slug?: string;
  targetSlug?: string;
  status?: string;
  route?: string;
  pageContentHash?: string;
  canonicalUrl?: string;
  articleId?: string;
  reasonCodes?: string[];
  [key: string]: unknown;
}

export interface RuntimePublicationAuthorization {
  readonly eligibility: RegionalEligibilityDecision;
  readonly firewall: V714FirewallPass;
}

export interface RuntimeGatePass {
  readonly ok: true;
  readonly metadata: PublicationMetadata;
  readonly artifact: RegionalPublishArtifact;
  readonly reportItem: PublicationReportItem;
}

export interface RuntimeGateBlock {
  readonly ok: false;
  readonly reason: string;
}

export type RuntimeGateResult = RuntimeGatePass | RuntimeGateBlock;

const PUBLIC_ROUTE_PREFIX = "/industries/v714/";
const SITE_ORIGIN = "https://www.nexmold.com";
const EXPECTED_METADATA_SCHEMA = "nexmold.v7.14.article-contract.v2";
const EXPECTED_PRODUCER_VERSION = "v714-article-producer";
const EXPECTED_REPORT_STATUSES = new Set(["PRODUCED", "EXISTING_OUTPUT_VALID"]);

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRuntimeEligibility(value: unknown): value is RegionalEligibilityDecision {
  if (!isRecord(value)) return false;
  if (!nonEmptyString(value.pageId) || !nonEmptyString(value.locale) || !nonEmptyString(value.region) || value.status !== "ELIGIBLE" || value.applicability !== "APPLICABLE" || value.compliance !== "VERIFIED") return false;
  if (!isRecord(value.evidence)) return false;
  return value.evidence.completeness === "COMPLETE" && Array.isArray(value.evidence.evidence) && value.evidence.evidence.length > 0 && Array.isArray(value.evidence.semanticClaims) && value.evidence.semanticClaims.length > 0 && isStringArray(value.reasonCodes);
}

function isRuntimeFirewall(value: unknown): value is V714FirewallPass {
  if (!isRecord(value) || value.ok !== true) return false;

  const checkedClaims = value.checkedClaims;
  const checkedEvidence = value.checkedEvidence;

  return (
    typeof checkedClaims === "number" &&
    Number.isInteger(checkedClaims) &&
    checkedClaims >= 0 &&
    typeof checkedEvidence === "number" &&
    Number.isInteger(checkedEvidence) &&
    checkedEvidence >= 0
  );
}

function readRuntimeAuthorization(metadata: PublicationMetadata): RuntimePublicationAuthorization | null {
  const authorization = metadata.publicationAuthorization;
  if (!isRecord(authorization)) return null;
  if (!isRuntimeEligibility(authorization.eligibility)) return null;
  if (!isRuntimeFirewall(authorization.firewall)) return null;
  return { eligibility: authorization.eligibility, firewall: authorization.firewall };
}

function validateFactoryEnvelope(metadata: PublicationMetadata | null, reportItem: PublicationReportItem | null, slug: string): string | null {
  if (!metadata || !metadata.artifact) return "V714_PUBLIC_ARTIFACT_ABSENT";
  if (metadata.schema !== EXPECTED_METADATA_SCHEMA) return "V714_METADATA_SCHEMA_INVALID";
  if (metadata.producerVersion !== EXPECTED_PRODUCER_VERSION) return "V714_PRODUCER_VERSION_INVALID";
  if (!reportItem) return "V714_PUBLICATION_REPORT_MISSING";
  if (!EXPECTED_REPORT_STATUSES.has(String(reportItem.status ?? "").trim())) return "V714_PUBLICATION_REPORT_NOT_AUTHORIZED";
  const route = `${PUBLIC_ROUTE_PREFIX}${slug}/`;
  if (metadata.targetSlug !== slug || metadata.route !== route) return "V714_ARTIFACT_ROUTE_MISMATCH";
  if (reportItem.slug && reportItem.slug !== slug) return "V714_REPORT_SLUG_MISMATCH";
  if (reportItem.targetSlug && reportItem.targetSlug !== slug) return "V714_REPORT_TARGET_SLUG_MISMATCH";
  if (reportItem.articleId && reportItem.articleId !== metadata.articleId) return "V714_REPORT_ARTICLE_ID_MISMATCH";
  if (reportItem.route && reportItem.route !== route) return "V714_REPORT_ROUTE_MISMATCH";
  if (!validateRegionalPublishArtifactRuntime(metadata.artifact)) return "V714_PUBLIC_ARTIFACT_INVALID";
  const artifact = metadata.artifact;
  if (metadata.sourceArtifactHash !== artifact.pageContentHash) return "V714_ARTIFACT_HASH_MISMATCH";
  if (reportItem.pageContentHash && reportItem.pageContentHash !== artifact.pageContentHash) return "V714_REPORT_ARTIFACT_HASH_MISMATCH";
  const expectedCanonical = `${SITE_ORIGIN}${route}`;
  if (!nonEmptyString(metadata.canonicalUrl) || metadata.canonicalUrl !== artifact.canonicalUrl || artifact.canonicalUrl !== expectedCanonical) return "V714_ARTIFACT_CANONICAL_MISMATCH";
  if (reportItem.canonicalUrl && reportItem.canonicalUrl !== artifact.canonicalUrl) return "V714_REPORT_CANONICAL_MISMATCH";
  if (!metadata.articleId) return "V714_ARTICLE_ID_MISSING";
  if (!metadata.articleContract || !isRecord(metadata.articleContract)) return "V714_ARTICLE_CONTRACT_MISSING";
  const contract = metadata.articleContract;
  if (contract.slug !== slug) return "V714_ARTICLE_CONTRACT_SLUG_MISMATCH";
  if (contract.articleId !== metadata.articleId) return "V714_ARTICLE_CONTRACT_ID_MISMATCH";
  const lineage = contract.lineage;
  if (!isRecord(lineage)) return "V714_ARTICLE_CONTRACT_LINEAGE_MISSING";
  if (lineage.sourceArtifactHash !== artifact.pageContentHash) return "V714_ARTICLE_CONTRACT_ARTIFACT_HASH_MISMATCH";
  if (lineage.canonicalUrl !== artifact.canonicalUrl) return "V714_ARTICLE_CONTRACT_CANONICAL_MISMATCH";
  if (!Array.isArray(lineage.evidenceIds) || lineage.evidenceIds.length === 0) return "V714_ARTICLE_CONTRACT_EVIDENCE_LINEAGE_MISSING";
  if (!Array.isArray(lineage.semanticClaimIds) || lineage.semanticClaimIds.length === 0) return "V714_ARTICLE_CONTRACT_SEMANTIC_LINEAGE_MISSING";
  const production = metadata.production;
  if (production?.whitePaper !== true) return "V714_WHITE_PAPER_FLAG_INVALID";
  if (production?.publishedArtifact !== true) return "V714_PUBLISHED_ARTIFACT_FLAG_INVALID";
  if (production?.automaticPublication !== false) return "V714_AUTOMATIC_PUBLICATION_FLAG_INVALID";
  if (production?.existingSiteContentModified !== false) return "V714_EXISTING_SITE_CONTENT_MODIFIED";
  if (production?.historicalBatch01Modified !== false) return "V714_HISTORICAL_BATCH01_MODIFIED";
  return null;
}

export function runRuntimePublicationGate(metadata: PublicationMetadata | null, reportItem: PublicationReportItem | null, slug: string): RuntimeGateResult {
  const envelopeError = validateFactoryEnvelope(metadata, reportItem, slug);
  if (envelopeError) return { ok: false, reason: envelopeError };
  const authorization = readRuntimeAuthorization(metadata as PublicationMetadata);
  if (!authorization) return { ok: false, reason: "V714_RUNTIME_PUBLICATION_AUTHORIZATION_INVALID" };
  const artifact = (metadata as PublicationMetadata).artifact;
  if (!validateRegionalPublishArtifactRuntime(artifact)) return { ok: false, reason: "V714_PUBLIC_ARTIFACT_INVALID" };
  const publication = runPublicationGate({ eligibility: authorization.eligibility, firewall: authorization.firewall, artifact });
  if (!publication.ok) return { ok: false, reason: publication.reasonCodes.join(",") };
  if (publication.artifact.pageId !== authorization.eligibility.pageId || publication.artifact.locale !== authorization.eligibility.locale || publication.artifact.region !== authorization.eligibility.region) return { ok: false, reason: "V714_ARTIFACT_ELIGIBILITY_MISMATCH" };
  return { ok: true, metadata: metadata as PublicationMetadata, artifact: publication.artifact, reportItem: reportItem as PublicationReportItem };
}
