export const V8_CONSTITUTION_VERSION="V8-00" as const;
export const V8_RULES=Object.freeze({failClosed:true,unknownIsFailure:true,contentCannotCreateTruth:true,contentCannotCreateKnowledge:true,decisionIdentityMustBeDeterministic:true,truthLayerOrder:Object.freeze(["SOURCE","EVIDENCE","CLAIM","KNOWLEDGE","DECISION","CONTENT"] as const),immutableDomainObjects:true} as const);
export type V8RuleKey=keyof typeof V8_RULES;
