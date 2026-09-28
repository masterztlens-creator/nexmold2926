export type CapabilityFit = "DIRECT" | "PARTIAL" | "NO_FIT" | "UNKNOWN";
export interface BusinessCapability { readonly id: string; readonly label: string; readonly problemKinds: readonly string[]; readonly decisionKinds: readonly string[]; }
export interface CapabilityMatch { readonly capabilityId: string; readonly fit: CapabilityFit; readonly reasons: readonly string[]; }
export function matchCapability(capability: BusinessCapability, input: { problemKind: string; decisionKind: string }): CapabilityMatch {
  const p = capability.problemKinds.includes(input.problemKind), d = capability.decisionKinds.includes(input.decisionKind);
  const fit: CapabilityFit = p && d ? "DIRECT" : p || d ? "PARTIAL" : "NO_FIT";
  return Object.freeze({ capabilityId: capability.id, fit, reasons: Object.freeze([p ? "PROBLEM_MATCH" : "PROBLEM_MISS", d ? "DECISION_MATCH" : "DECISION_MISS"]) });
}
