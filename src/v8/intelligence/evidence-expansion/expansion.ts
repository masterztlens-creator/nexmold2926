
import { normalizeText, type EvidenceRef } from "../shared.js";
export interface EvidenceCandidate { readonly url: string; readonly title: string; readonly publisher: string; readonly authority: number; readonly relevance: number; readonly query: string; }
export function rankEvidenceCandidates(query: string, candidates: readonly EvidenceCandidate[]): readonly EvidenceCandidate[] {
  return Object.freeze([...candidates].map(c=>({ ...c, relevance: Math.min(1, c.relevance + (normalizeText(c.title).includes(normalizeText(query)) ? .15 : 0)) })).sort((a,b)=>(b.authority+b.relevance)-(a.authority+a.relevance)));
}
export function toEvidenceRefs(candidates: readonly EvidenceCandidate[], limit=8): readonly EvidenceRef[] {
  return Object.freeze(candidates.slice(0,limit).map(c=>({ sourceUrl:c.url, title:c.title, publisher:c.publisher })));
}
