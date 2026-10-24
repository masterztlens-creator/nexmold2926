import type {
  FoundationRecord,
  LineageLink,
} from "../foundation/types.js";

import type {
  Content,
} from "../domain/content.js";

/**
 * Input contract for deterministic Content compilation.
 *
 * Every identifier is deliberately represented as string at the
 * compiler boundary because FoundationStore resolves canonical
 * aggregate identities internally.
 */
export interface ContentCompilerInput {
  readonly decisionId: string;
  readonly scopeId: string;
  readonly contextId: string;
  readonly title: string;
}

/**
 * Immutable result produced by ContentCompiler.
 *
 * The compiler does not persist Content as a second mutable
 * Foundation aggregate. Instead it returns:
 *
 *   Content
 *   +
 *   deterministic Content fingerprint
 *   +
 *   exact Foundation lineage
 *   +
 *   exact Decision record used for compilation
 */
export interface CompiledContent {
  readonly content: Readonly<Content>;
  readonly fingerprint: string;
  readonly lineage: readonly LineageLink[];
  readonly decision: FoundationRecord;
}