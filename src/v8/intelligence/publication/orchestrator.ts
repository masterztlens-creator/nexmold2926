
import { type ContentDraft } from "../shared.js";
import type { QualityReport } from "../shared.js";
export interface PublicationDecision { readonly eligible: boolean; readonly slug: string; readonly reasons: readonly string[]; }
export function evaluatePublication(draft: ContentDraft, quality: QualityReport, collisions=0, noveltyScore=1): PublicationDecision {
  const reasons:string[]=[]; if(!quality.passed) reasons.push("quality-firewall"); if(collisions>0) reasons.push("semantic-collision"); if(noveltyScore<.35) reasons.push("low-novelty"); if(!draft.evidence.length) reasons.push("missing-evidence");
  return Object.freeze({eligible:reasons.length===0,slug:draft.slug,reasons:Object.freeze(reasons)});
}
