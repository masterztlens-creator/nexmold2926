import type {
  ClaimEpistemicLevel,
  EvidencePayload,
} from "../../index.js";

export type TruthConfidence =
  | "HIGH"
  | "MEDIUM"
  | "LOW";

export interface ClaimCandidate {
  readonly statement: string;
  readonly evidenceIds: readonly string[];

  readonly epistemicLevel:
    | ClaimEpistemicLevel;

  readonly confidence:
    | TruthConfidence;

  readonly scope?: string;
  readonly conditions?: readonly string[];
  readonly units?: readonly string[];
  readonly isUniversal?: boolean;
}

export interface ClaimInterpreter {
  interpret(
    evidence: readonly EvidencePayload[],
  ): readonly ClaimCandidate[];
}

export interface TruthProducerInput {
  readonly evidence: readonly EvidencePayload[];
  readonly actor: {
    readonly id: string;
    readonly role: string;
  };
}

export interface TruthProducerResult {
  readonly claims: readonly string[];
  readonly knowledge: readonly string[];
  readonly rejectedCandidates: readonly {
    readonly statement: string;
    readonly reason: string;
  }[];
}