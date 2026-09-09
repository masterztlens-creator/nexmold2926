
import { tokenize, type ContentDraft } from "../shared.js";
export interface Collision { readonly a: string; readonly b: string; readonly similarity: number; readonly sharedTerms: readonly string[]; }
export function detectCannibalization(drafts: readonly ContentDraft[], threshold=.62): readonly Collision[] {
  const out: Collision[]=[];
  for(let i=0;i<drafts.length;i++) for(let j=i+1;j<drafts.length;j++){
    const a=new Set(tokenize(drafts[i].title)); const b=new Set(tokenize(drafts[j].title)); const shared=[...a].filter(x=>b.has(x)); const sim=shared.length/Math.max(1,new Set([...a,...b]).size);
    if(sim>=threshold) out.push({a:drafts[i].slug,b:drafts[j].slug,similarity:sim,sharedTerms:Object.freeze(shared)});
  }
  return Object.freeze(out);
}
