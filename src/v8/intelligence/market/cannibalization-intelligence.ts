import { immutable } from "../../constitution/invariants.js";
export type CannibalizationRelation="DISTINCT"|"HIGH_OVERLAP"|"EXACT_DUPLICATE";
export interface CoverageIntent { readonly ref:string; readonly query:string; readonly problem:string; readonly entities:readonly string[]; }
export interface CannibalizationFinding { readonly ref:string; readonly relation:CannibalizationRelation; readonly sharedTerms:readonly string[]; }
function norm(v:string):string{return v.trim().toLowerCase();}
function terms(v:string):Set<string>{return new Set(norm(v).split(/[^\p{L}\p{N}]+/u).filter(x=>x.length>2));}
export function detectCannibalization(target:CoverageIntent,existing:readonly CoverageIntent[]):readonly CannibalizationFinding[]{const a=terms(`${target.query} ${target.problem} ${target.entities.join(" ")}`);const out:CannibalizationFinding[]=[];for(const item of existing){const b=terms(`${item.query} ${item.problem} ${item.entities.join(" ")}`);const shared=[...a].filter(x=>b.has(x)).sort();const ratio=Math.min(a.size,b.size)?shared.length/Math.min(a.size,b.size):0;const relation=norm(item.query)===norm(target.query)&&norm(item.problem)===norm(target.problem)?"EXACT_DUPLICATE":ratio>=0.7?"HIGH_OVERLAP":"DISTINCT";if(relation!=="DISTINCT")out.push({ref:item.ref,relation,sharedTerms:immutable(shared)});}return immutable(out);}
