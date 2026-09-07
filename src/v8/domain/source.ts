import { immutable, invariant } from "../constitution/invariants.js";
import { nonEmpty, sourceId, type SourceId } from "./primitives.js";

export type SourceKind = "PUBLIC_WEB" | "STANDARD_METADATA" | "FACTORY_RECORD" | "INTERNAL_DOCUMENT";
export type SourceAccess = "PAYLOAD_ALLOWED" | "METADATA_ONLY";
export type SourceAuthority = "AUTHORITATIVE_STANDARD" | "MANUFACTURER_PRIMARY" | "OFFICIAL_CERTIFICATION" | "OFFICIAL_TECHNICAL_MANUAL" | "PEER_REVIEWED_RESEARCH" | "ENGINEERING_SOFTWARE_DB" | "ENGINEERING_REFERENCE" | "UL_PROSPECTOR" | "DISTRIBUTOR" | "EMPIRICAL" | "LEGACY" | "CANDIDATE";
export type SourceStatus = "ACTIVE" | "SUPERSEDED" | "WITHDRAWN" | "RETRACTED" | "UNAVAILABLE" | "UNVERIFIED";

export interface Source {
  id: SourceId; kind: SourceKind; locator: string; access: SourceAccess; title: string; version: string;
  publisher?: string; authority?: SourceAuthority; status?: SourceStatus; canonicalUrl?: string;
  publicationDate?: string; publicationDatePrecision?: "DAY" | "MONTH" | "YEAR" | "UNKNOWN";
  retrievedAt?: string; documentHash?: string; language?: string; productGrade?: string; sourceType?: string;
}

export function createSource(i: Omit<Source, "id"> & { id?: string }): Readonly<Source> {
  invariant(i.access !== undefined, "V8_SOURCE_ACCESS_REQUIRED", "Source access policy is required.");
  const locator = nonEmpty(i.locator, "source.locator");
  const title = nonEmpty(i.title, "source.title");
  const version = nonEmpty(i.version, "source.version");
  if (i.authority !== undefined) invariant(i.authority !== "LEGACY" && i.authority !== "CANDIDATE", "V8_SOURCE_UNTRUSTED_AUTHORITY", "Legacy/candidate sources cannot be authoritative.");
  if (i.canonicalUrl !== undefined) invariant(/^https?:\/\//i.test(i.canonicalUrl), "V8_SOURCE_CANONICAL_URL_INVALID", "canonicalUrl must be HTTP(S).");
  if (i.documentHash !== undefined) invariant(/^[a-f0-9]{64}$/i.test(i.documentHash), "V8_SOURCE_DOCUMENT_HASH_INVALID", "documentHash must be SHA-256.");
  return immutable({
    id: sourceId(i.id ?? `${i.kind}:${locator}:${version}`), kind: i.kind, locator, access: i.access, title, version,
    ...(i.publisher === undefined ? {} : { publisher: nonEmpty(i.publisher, "source.publisher") }),
    ...(i.authority === undefined ? {} : { authority: i.authority }), ...(i.status === undefined ? {} : { status: i.status }),
    ...(i.canonicalUrl === undefined ? {} : { canonicalUrl: i.canonicalUrl.trim() }),
    ...(i.publicationDate === undefined ? {} : { publicationDate: nonEmpty(i.publicationDate, "source.publicationDate") }),
    ...(i.publicationDatePrecision === undefined ? {} : { publicationDatePrecision: i.publicationDatePrecision }),
    ...(i.retrievedAt === undefined ? {} : { retrievedAt: nonEmpty(i.retrievedAt, "source.retrievedAt") }),
    ...(i.documentHash === undefined ? {} : { documentHash: i.documentHash.toLowerCase() }),
    ...(i.language === undefined ? {} : { language: nonEmpty(i.language, "source.language") }),
    ...(i.productGrade === undefined ? {} : { productGrade: nonEmpty(i.productGrade, "source.productGrade") }),
    ...(i.sourceType === undefined ? {} : { sourceType: nonEmpty(i.sourceType, "source.sourceType") }),
  });
}
