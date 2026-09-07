import { invariant } from "../constitution/invariants.js";
import type { Source } from "../domain/source.js";

const FORBIDDEN=new Set(["LEGACY","CANDIDATE"]);
export function assertAuthoritativeSource(source:Source):void{
 invariant(Boolean(source.publisher),"V8_SOURCE_PUBLISHER_REQUIRED","Authoritative Source requires publisher.");
 invariant(Boolean(source.authority)&&!FORBIDDEN.has(source.authority!),"V8_SOURCE_AUTHORITY_REQUIRED","Authoritative Source requires a non-legacy authority class.");
 invariant(Boolean(source.canonicalUrl),"V8_SOURCE_CANONICAL_REQUIRED","Authoritative Source requires canonicalUrl.");
 invariant(Boolean(source.retrievedAt),"V8_SOURCE_RETRIEVED_AT_REQUIRED","Authoritative Source requires retrievedAt.");
 invariant(Boolean(source.documentHash)&&/^[a-f0-9]{64}$/i.test(source.documentHash!),"V8_SOURCE_HASH_REQUIRED","Authoritative Source requires a SHA-256 documentHash.");
 invariant(source.status! !== "SUPERSEDED" && source.status! !== "WITHDRAWN" && source.status! !== "RETRACTED","V8_SOURCE_NOT_ACTIVE","Superseded/withdrawn/retracted sources cannot become authoritative.");
}
