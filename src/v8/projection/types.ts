import type {
  FoundationRecord,
  LineageLink,
} from "../foundation/types.js";

import type {
  CompiledContent,
} from "../content-compiler/types.js";

export interface ProjectionInput {
  readonly compiled: CompiledContent;
  readonly scopeId: string;
  readonly contextId: string;
}

export interface ProjectionPayload {
  readonly contentId: string;
  readonly decisionId: string;
  readonly sourceFingerprint: string;
  readonly scopeId: string;
  readonly contextId: string;
  readonly title: string;
  readonly body: string;
}

export interface ProjectedContent {
  readonly projectionId: string;
  readonly contentId: string;
  readonly decisionId: string;
  readonly scopeId: string;
  readonly contextId: string;
  readonly title: string;
  readonly body: string;
  readonly fingerprint: string;
  readonly lineage: readonly LineageLink[];
  readonly sourceContent: FoundationRecord;
}

export interface ProjectionResult {
  readonly projected: ProjectedContent;
}import type {Fingerprint} from "../domain/primitives.js";import type {PublicationArtifact} from "../publication/types.js";export interface Projection{readonly id:string;readonly publicationId:string;readonly route:string;readonly title:string;readonly body:string;readonly fingerprint:Fingerprint;}export interface ProjectionInput{readonly artifact:PublicationArtifact;readonly route:string;}
