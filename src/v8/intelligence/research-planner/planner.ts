
import { type ContentBrief, type Opportunity, type EvidenceRef } from "../shared.js";
export interface ResearchPlan { readonly brief: ContentBrief; readonly sourceQueries: readonly string[]; readonly evidenceRequirements: readonly string[]; readonly stopConditions: readonly string[]; }
export function planResearch(opportunity: Opportunity, evidence: readonly EvidenceRef[] = []): ResearchPlan {
  const q = opportunity.keyword.keyword; const terms = opportunity.keyword.terms;
  const questions = [`${q} specifications`, `${q} design considerations`, `${q} common defects`, `${q} standards`, `${q} cost factors`];
  const outline = ["Definition and scope","Engineering requirements","Design and process considerations","Failure modes and trade-offs","Evidence-backed recommendations","Practical checklist"];
  const brief: ContentBrief = Object.freeze({ primaryKeyword:q, intent:opportunity.keyword.intent, title:`${q}: engineering guide`, outline, questions, evidenceQueries:questions, competitorGaps:[], internalLinkTargets:[] });
  return Object.freeze({ brief, sourceQueries:Object.freeze([...new Set([...questions, ...terms.map(t=>`${t} engineering`)])]), evidenceRequirements:Object.freeze(["at least one authoritative source","claim-level source binding","conditions and units when applicable"]), stopConditions:Object.freeze(["no authoritative evidence","conflicting evidence unresolved","duplicate intent already covered"]) });
}
