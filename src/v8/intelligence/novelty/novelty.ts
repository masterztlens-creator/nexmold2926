
import { tokenize, type ContentDraft } from "../shared.js";
export interface NoveltyReport { readonly noveltyScore: number; readonly overlapRatio: number; readonly uniqueClaims: readonly string[]; }
export function assessNovelty(draft: ContentDraft, existing: readonly ContentDraft[]): NoveltyReport {
  const base = new Set(tokenize(draft.title+" "+draft.sections.map(s=>s.body).join(" ")));
  let maxOverlap=0;
  for (const other of existing) {
    const terms = new Set(tokenize(other.title+" "+other.sections.map(s=>s.body).join(" ")));
    const overlap=[...base].filter(t=>terms.has(t)).length/Math.max(1,base.size); maxOverlap=Math.max(maxOverlap,overlap);
  }
  const uniqueClaims=draft.claims.filter(c=>!existing.some(e=>e.claims.includes(c)));
  return Object.freeze({noveltyScore:Math.max(0,1-maxOverlap),overlapRatio:maxOverlap,uniqueClaims:Object.freeze(uniqueClaims)});
}
