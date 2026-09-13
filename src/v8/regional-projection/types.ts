import type {
  LineageLink,
} from "../foundation/types.js";

import type {
  Fingerprint,
} from "../domain/primitives.js";

import type {
  ProjectedContent,
} from "../projection/types.js";

export interface RegionalAlternate {
  readonly locale: string;
  readonly route: string;
}

export interface RegionalProjectionInput {
  readonly projected: ProjectedContent;
  readonly region: string;
  readonly locale: string;
  readonly canonicalRoute: string;
  readonly alternates: readonly RegionalAlternate[];
}

export interface RegionalProjection {
  readonly id: string;
  readonly projectionId: string;
  readonly contentId: string;
  readonly decisionId: string;
  readonly scopeId: string;
  readonly contextId: string;

  readonly region: string;
  readonly locale: string;

  readonly canonicalRoute: string;
  readonly alternates: readonly RegionalAlternate[];

  readonly title: string;
  readonly body: string;

  readonly fingerprint: Fingerprint;
  readonly lineage: readonly LineageLink[];
}

export interface RegionalProjectionResult {
  readonly regional: RegionalProjection;
}