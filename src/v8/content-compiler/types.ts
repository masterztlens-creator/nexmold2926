import type {
  FoundationRecord,
  LineageLink,
} from "../foundation/types.js";
import type { Content } from "../domain/content.js";

export interface ContentCompilerInput {
  readonly decisionId: string;
  readonly scopeId: string;
  readonly contextId: string;
  readonly title: string;
}

export interface CompiledContent {
  readonly content: Content;
  readonly fingerprint: string;
  readonly lineage: readonly LineageLink[];
  readonly decision: FoundationRecord;
}