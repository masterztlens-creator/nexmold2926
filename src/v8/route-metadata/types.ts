import type {
  LineageLink,
} from "../foundation/types.js";

import type {
  Fingerprint,
} from "../domain/primitives.js";

import type {
  RegionalProjection,
} from "../regional-projection/types.js";

export interface RouteAlternate {
  readonly locale: string;
  readonly route: string;
}

export interface RouteMetadataInput {
  readonly regional: RegionalProjection;
  readonly alternates: readonly RouteAlternate[];
}

export interface RouteMetadataProjection {
  readonly id: string;

  readonly regionalProjectionId: string;
  readonly projectionId: string;

  readonly contentId: string;
  readonly decisionId: string;
  readonly scopeId: string;
  readonly contextId: string;

  readonly region: string;
  readonly locale: string;

  readonly canonicalRoute: string;
  readonly alternates: readonly RouteAlternate[];

  readonly title: string;
  readonly body: string;

  readonly fingerprint: Fingerprint;
  readonly lineage: readonly LineageLink[];
}

export interface RouteMetadataResult {
  readonly routeMetadata: RouteMetadataProjection;
}