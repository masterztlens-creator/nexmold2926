
import { tokenize, type ContentDraft } from "../shared.js";
export interface LinkCandidate { readonly fromSlug: string; readonly toSlug: string; readonly anchor: string; readonly score: number; }
export function suggestInternalLinks(from: ContentDraft, targets: readonly ContentDraft[], maxLinks=8): readonly LinkCandidate[] {
  const fromTerms = new Set(tokenize(from.title)); const out: LinkCandidate[] = [];
  for (const target of targets) {
    if (target.slug === from.slug) continue;
    const terms = tokenize(target.title); const overlap = terms.filter(t=>fromTerms.has(t)).length;
    if (!overlap) continue;
    out.push({fromSlug:from.slug,toSlug:target.slug,anchor:target.title,score:overlap/Math.max(1,terms.length)});
  }
  return Object.freeze(out.sort((a,b)=>b.score-a.score).slice(0,maxLinks));
}
