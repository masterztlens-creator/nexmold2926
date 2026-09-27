import { immutable, invariant } from "../../constitution/invariants.js";
import type { MarketDemand } from "./demand.js";
import { createMarketDecision, type MarketAssetType, type MarketDecision, type MarketDecisionConfidence } from "./decision.js";
import { createResearchAction, type ResearchAction, type ResearchActionPriority, type ResearchActionType } from "./research-action.js";
import { assertMarketDecisionInvariant, assertMarketDecisionResearchConsistency, assertResearchActionInvariant } from "./invariants.js";

export interface MarketDecisionEvidenceState {
  readonly availableEvidence: readonly string[];
  readonly missingEvidence: readonly string[];
  readonly contradictions: readonly string[];
  readonly unresolvedQuestions: readonly string[];
}
export interface MarketCoverageState {
  readonly existingCoverageRefs: readonly string[];
  readonly equivalentCoverage: readonly string[];
  readonly relatedCoverage: readonly string[];
}
export interface MarketReasoningSignal {
  readonly type: "DEMAND_VALID"|"DEMAND_WEAK"|"BUSINESS_RELEVANCE"|"OUT_OF_SCOPE"|"EVIDENCE_SUFFICIENT"|"EVIDENCE_INSUFFICIENT"|"CONTRADICTION"|"DUPLICATE_COVERAGE"|"COVERAGE_GAP"|"REQUIRES_HUMAN_REVIEW";
  readonly value: string;
}
export interface MarketDecisionEngineInput {
  readonly decisionId: string;
  readonly demand: MarketDemand;
  readonly evidence: MarketDecisionEvidenceState;
  readonly coverage: MarketCoverageState;
  readonly signals?: readonly MarketReasoningSignal[];
  readonly targetAsset?: MarketAssetType;
  readonly confidence?: MarketDecisionConfidence;
  readonly evidenceRequirements?: readonly string[];
  readonly researchPriority?: ResearchActionPriority;
}
export interface MarketDecisionEngineResult {
  readonly decision: Readonly<MarketDecision>;
  readonly researchActions: readonly ResearchAction[];
  readonly terminal: boolean;
}
function clean(v:string):string{return v.trim().replace(/\s+/g," ");}
function unique(v:readonly string[]):readonly string[]{return immutable([...new Set(v.map(clean).filter(Boolean))].sort());}
function has(s:readonly MarketReasoningSignal[],t:MarketReasoningSignal["type"]):boolean{return s.some(x=>x.type===t);}
function actionType(input:MarketDecisionEngineInput):ResearchActionType{
  if(input.evidence.contradictions.length||has(input.signals??[],"CONTRADICTION"))return "SEARCH_CONTRADICTION";
  if(input.coverage.equivalentCoverage.length)return "SEARCH_COVERAGE";
  if(input.demand.entities.length)return "SEARCH_ENTITY";
  if(input.demand.problem.trim())return "SEARCH_PROBLEM";
  return "SEARCH_DEMAND";
}
function makeAction(input:MarketDecisionEngineInput,decisionId:string,index:number):Readonly<ResearchAction>{
  const type=actionType(input);
  const missing=[...input.evidence.missingEvidence,...input.evidence.unresolvedQuestions];
  const question=input.evidence.contradictions[0] ? `Resolve contradictory evidence: ${input.evidence.contradictions[0]}` : missing[0] ? `Find authoritative evidence for: ${missing[0]}` : `Research authoritative evidence for: ${input.demand.problem}`;
  const required=unique([...missing,"source-bound evidence"]);
  const id=`research-action:${decisionId}:${type.toLowerCase()}:${index+1}`;
  return createResearchAction({id,decisionId:id?decisionId as any:decisionId as any,type,question,target:input.demand.problem,priority:input.researchPriority??(type==="SEARCH_CONTRADICTION"?"CRITICAL":"HIGH"),requiredEvidence:required,status:"PLANNED"});
}
function researchActions(input:MarketDecisionEngineInput,decisionId:string):readonly ResearchAction[]{
  const out:ResearchAction[]=[];
  if(input.evidence.contradictions.length||has(input.signals??[],"CONTRADICTION"))out.push(makeAction(input,decisionId,out.length));
  for(const q of input.evidence.unresolvedQuestions)out.push(createResearchAction({id:`research-action:${decisionId}:question:${out.length+1}`,decisionId:decisionId as any,type:"SEARCH_EVIDENCE",question:q,target:input.demand.problem,priority:input.researchPriority??"HIGH",requiredEvidence:["authoritative source",q],status:"PLANNED"}));
  for(const m of input.evidence.missingEvidence)out.push(createResearchAction({id:`research-action:${decisionId}:evidence:${out.length+1}`,decisionId:decisionId as any,type:"SEARCH_EVIDENCE",question:`What authoritative evidence establishes ${m}?`,target:input.demand.problem,priority:input.researchPriority??"HIGH",requiredEvidence:["authoritative source",m],status:"PLANNED"}));
  if(!out.length&&has(input.signals??[],"EVIDENCE_INSUFFICIENT"))out.push(makeAction(input,decisionId,0));
  out.forEach(assertResearchActionInvariant);
  return immutable(out);
}
function evaluate(input:MarketDecisionEngineInput):MarketDecision["state"]{
  const s=input.signals??[];
  if(has(s,"OUT_OF_SCOPE"))return "BLOCK";
  if(has(s,"REQUIRES_HUMAN_REVIEW"))return "DEFER";
  if(has(s,"DEMAND_WEAK"))return "IGNORE";
  if(input.evidence.contradictions.length||input.evidence.unresolvedQuestions.length||input.evidence.missingEvidence.length||has(s,"EVIDENCE_INSUFFICIENT"))return "RESEARCH_REQUIRED";
  if(input.coverage.equivalentCoverage.length||has(s,"DUPLICATE_COVERAGE"))return "MERGE";
  if(!input.evidence.availableEvidence.length&&!has(s,"EVIDENCE_SUFFICIENT"))return "RESEARCH_REQUIRED";
  if(input.demand.uncertainty==="UNKNOWN")return "RESEARCH_REQUIRED";
  return "COVER";
}
export function evaluateMarketDecision(input:MarketDecisionEngineInput):MarketDecisionEngineResult{
  invariant(input.decisionId.trim().length>0,"V8_MARKET_DECISION_ENGINE_EMPTY_ID","decisionId is required.");
  invariant(input.demand.queryObservations.length>0,"V8_MARKET_DECISION_ENGINE_NO_OBSERVATION","Observed demand is required.");
  invariant(input.demand.problem.trim().length>0,"V8_MARKET_DECISION_ENGINE_NO_PROBLEM","A concrete market problem is required.");
  const state=evaluate(input);
  const actions=state==="RESEARCH_REQUIRED"?researchActions(input,input.decisionId):immutable([]);
  invariant(state!=="RESEARCH_REQUIRED"||actions.length>0,"V8_MARKET_DECISION_ENGINE_NO_RESEARCH_ACTION","RESEARCH_REQUIRED must have research actions.");
  const uncertainty=state==="COVER"?false:(input.evidence.contradictions.length>0||input.evidence.missingEvidence.length>0||input.evidence.unresolvedQuestions.length>0||input.demand.uncertainty!=="LOW");
  const confidence=state==="COVER"?(input.confidence&&input.confidence!=="UNKNOWN"?input.confidence:"HIGH"):(state==="RESEARCH_REQUIRED"?"LOW":input.confidence??"UNKNOWN");
  const decision=createMarketDecision({id:input.decisionId as any,demandId:input.demand.id,state,rationale:state==="COVER"?"Observed demand is sufficiently evidenced and has no equivalent coverage.":state==="MERGE"?"Equivalent existing coverage already addresses this demand.":state==="RESEARCH_REQUIRED"?"Evidence or uncertainty remains unresolved; further research is required.":`Market policy selected terminal state ${state}.`,evidenceRequirements:unique([...(input.evidenceRequirements??[]),...input.evidence.availableEvidence,...input.evidence.missingEvidence,"claim-level source binding"]),researchActions:actions.map(x=>String(x.id)),existingCoverageRefs:unique([...input.coverage.existingCoverageRefs,...input.coverage.equivalentCoverage]),targetAsset:state==="COVER"?(input.targetAsset??"ARTICLE"):state==="MERGE"?(input.targetAsset??"ARTICLE"):null,confidence,uncertainty});
  assertMarketDecisionInvariant(decision); assertMarketDecisionResearchConsistency(decision,actions);
  return immutable({decision,researchActions:actions,terminal:["COVER","MERGE","DEFER","IGNORE","BLOCK"].includes(state)});
}
