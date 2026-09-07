import {immutable,invariant} from "../constitution/invariants.js";
export type Brand<T,B extends string>=T&{readonly __brand:B};
export type SourceId=Brand<string,"SourceId">;export type EvidenceId=Brand<string,"EvidenceId">;export type ClaimId=Brand<string,"ClaimId">;export type KnowledgeId=Brand<string,"KnowledgeId">;export type Fingerprint=Brand<string,"Fingerprint">;
function branded(v:string,label:string){invariant(typeof v==="string"&&v.trim().length>0,"V8_EMPTY_ID",`${label} cannot be empty.`);return v;}
export const sourceId=(v:string)=>branded(v,"SourceId") as SourceId;export const evidenceId=(v:string)=>branded(v,"EvidenceId") as EvidenceId;export const claimId=(v:string)=>branded(v,"ClaimId") as ClaimId;export const knowledgeId=(v:string)=>branded(v,"KnowledgeId") as KnowledgeId;export const fingerprint=(v:string)=>branded(v,"Fingerprint") as Fingerprint;
export function nonEmpty(v:string,field:string){invariant(typeof v==="string"&&v.trim().length>0,"V8_INVALID_TEXT",`${field} must be non-empty.`);return v.trim();}
export function canonicalize(v:unknown):unknown{if(Array.isArray(v))return v.map(canonicalize);if(v&&typeof v==="object")return Object.fromEntries(Object.entries(v as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,canonicalize(x)]));return v;}
