
import { type ContentDraft, uniqueStrings } from "../shared.js";
export interface GeoArtifact { readonly directAnswer: string; readonly facts: readonly string[]; readonly questions: readonly string[]; readonly entityTerms: readonly string[]; readonly citationTargets: readonly string[]; }
export function compileGeo(draft: ContentDraft): GeoArtifact {
  const first = draft.sections[0]?.body ?? draft.description;
  const questions = draft.sections.flatMap(s=>s.heading.endsWith("?")?[s.heading]:[]);
  return Object.freeze({ directAnswer:first.slice(0,500), facts:Object.freeze(draft.claims), questions:Object.freeze(questions), entityTerms:Object.freeze(uniqueStrings([draft.title,...draft.sections.map(s=>s.heading)])), citationTargets:Object.freeze(draft.evidence.map(e=>e.sourceUrl)) });
}
