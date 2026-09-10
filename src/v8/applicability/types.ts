export interface ApplicabilityInput {
  readonly knowledgeId: string;
  readonly scopeId: string;
  readonly contextId: string;
}
export interface ApplicabilityLineage {
  readonly type: "KNOWLEDGE" | "SCOPE" | "CONTEXT";
  readonly id: string;
  readonly version: number;
  readonly fingerprint: string;
}
export interface ApplicabilityResult {
  readonly applicable: boolean;
  readonly knowledgeId: string;
  readonly scopeId: string;
  readonly contextId: string;
  readonly reasons: readonly string[];
  readonly lineage: readonly ApplicabilityLineage[];
}