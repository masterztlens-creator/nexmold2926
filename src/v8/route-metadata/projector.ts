import {
  immutable,
  invariant,
} from "../constitution/invariants.js";

import {
  contentFingerprint,
} from "../foundation/hash.js";

import {
  fingerprint as brandFingerprint,
} from "../domain/primitives.js";

import type {
  LineageLink,
} from "../foundation/types.js";

import type {
  RegionalProjection,
} from "../regional-projection/types.js";

import type {
  RouteAlternate,
  RouteMetadataInput,
  RouteMetadataProjection,
  RouteMetadataResult,
} from "./types.js";

function normalizeRequired(
  value: string,
  field: string,
): string {
  const normalized = value.trim();

  invariant(
    normalized.length > 0,
    "V8_ROUTE_METADATA_REQUIRED",
    `${field} is required.`,
  );

  return normalized;
}

function normalizeRoute(
  value: string,
  field: string,
): string {
  const route = normalizeRequired(
    value,
    field,
  );

  invariant(
    route.startsWith("/") &&
      route !== "/" &&
      !route.includes(" ") &&
      !route.includes("#") &&
      !route.includes("?"),
    "V8_ROUTE_METADATA_ROUTE_INVALID",
    `${field} must be a non-root path without query or fragment.`,
  );

  return route;
}

function normalizeLocale(
  value: string,
): string {
  const locale = normalizeRequired(
    value,
    "locale",
  );

  invariant(
    /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(
      locale,
    ),
    "V8_ROUTE_METADATA_LOCALE_INVALID",
    "locale must use a BCP-47-compatible structural form.",
  );

  return locale;
}

function normalizeAlternate(
  alternate: RouteAlternate,
): RouteAlternate {
  return immutable({
    locale: normalizeLocale(
      alternate.locale,
    ),
    route: normalizeRoute(
      alternate.route,
      `alternate.${alternate.locale}.route`,
    ),
  });
}

function canonicalizeAlternates(
  regional: RegionalProjection,
  alternates: readonly RouteAlternate[],
): readonly RouteAlternate[] {
  const normalized = alternates.map(
    normalizeAlternate,
  );

  const localeKeys = normalized.map(
    (item) => item.locale.toLowerCase(),
  );

  invariant(
    new Set(localeKeys).size === localeKeys.length,
    "V8_ROUTE_METADATA_DUPLICATE_LOCALE",
    "Route metadata alternates must contain unique locales.",
  );

  const regionalLocale = regional.locale.toLowerCase();

  invariant(
    localeKeys.includes(regionalLocale),
    "V8_ROUTE_METADATA_SELF_LOCALE_MISSING",
    "Route metadata must contain the Regional Projection locale.",
  );

  const self = normalized.find(
    (item) =>
      item.locale.toLowerCase() ===
      regionalLocale,
  );

  invariant(
    self !== undefined,
    "V8_ROUTE_METADATA_SELF_LOCALE_MISSING",
    "Route metadata must contain its own locale.",
  );

  invariant(
    self.route === regional.canonicalRoute,
    "V8_ROUTE_METADATA_CANONICAL_MISMATCH",
    "The self-locale route must equal the Regional Projection canonical route.",
  );

  invariant(
    normalized.length ===
      regional.alternates.length,
    "V8_ROUTE_METADATA_ALTERNATE_SET_MISMATCH",
    "Route metadata alternate set must preserve the Regional Projection locale set.",
  );

  const regionalAlternates =
    new Map(
      regional.alternates.map(
        (item) => [
          item.locale.toLowerCase(),
          item.route,
        ],
      ),
    );

  for (const item of normalized) {
    const regionalRoute =
      regionalAlternates.get(
        item.locale.toLowerCase(),
      );

    invariant(
      regionalRoute === item.route,
      "V8_ROUTE_METADATA_REGIONAL_ROUTE_MISMATCH",
      `Route metadata route does not match Regional Projection for locale ${item.locale}.`,
    );
  }

  return immutable(
    [...normalized].sort(
      (a, b) =>
        a.locale.localeCompare(b.locale) ||
        a.route.localeCompare(b.route),
    ),
  );
}

function hasLineage(
  lineage: readonly LineageLink[],
  target: LineageLink,
): boolean {
  return lineage.some(
    (item) =>
      item.type === target.type &&
      item.id === target.id &&
      item.version === target.version &&
      item.fingerprint === target.fingerprint,
  );
}

function buildLineage(
  regional: RegionalProjection,
): readonly LineageLink[] {
  const regionalLink: LineageLink = {
    type: "PROJECTION",
    id: regional.projectionId,
    version: 1,
    fingerprint: brandFingerprint(
      regional.fingerprint,
    ),
  };

  const lineage: LineageLink[] = [];

  const regionalProjectionLink: LineageLink = {
    type: "PROJECTION",
    id: regional.id,
    version: 1,
    fingerprint: brandFingerprint(
      regional.fingerprint,
    ),
  };

  if (!hasLineage(lineage, regionalProjectionLink)) {
    lineage.push(
      regionalProjectionLink,
    );
  }

  if (
    !hasLineage(
      lineage,
      regionalLink,
    )
  ) {
    lineage.push(
      regionalLink,
    );
  }

  for (const item of regional.lineage) {
    if (!hasLineage(lineage, item)) {
      lineage.push(item);
    }
  }

  return immutable(lineage);
}

export class RouteMetadataProjector {
  project(
    input: RouteMetadataInput,
  ): RouteMetadataResult {
    const regional =
      input.regional;

    invariant(
      regional.id.trim().length > 0,
      "V8_ROUTE_METADATA_REGIONAL_ID_EMPTY",
      "Route metadata requires a Regional Projection id.",
    );

    invariant(
      regional.projectionId.trim().length > 0,
      "V8_ROUTE_METADATA_PROJECTION_ID_EMPTY",
      "Route metadata requires a Projection id.",
    );

    invariant(
      regional.contentId.trim().length > 0,
      "V8_ROUTE_METADATA_CONTENT_ID_EMPTY",
      "Route metadata requires a Content id.",
    );

    invariant(
      regional.decisionId.trim().length > 0,
      "V8_ROUTE_METADATA_DECISION_ID_EMPTY",
      "Route metadata requires a Decision id.",
    );

    const region =
      normalizeRequired(
        regional.region,
        "regional.region",
      );

    const locale =
      normalizeLocale(
        regional.locale,
      );

    const canonicalRoute =
      normalizeRoute(
        regional.canonicalRoute,
        "regional.canonicalRoute",
      );

    invariant(
      canonicalRoute ===
        regional.canonicalRoute,
      "V8_ROUTE_METADATA_CANONICAL_NORMALIZATION_MISMATCH",
      "Regional Projection canonical route is not canonical.",
    );

    const title =
      normalizeRequired(
        regional.title,
        "regional.title",
      );

    const body =
      normalizeRequired(
        regional.body,
        "regional.body",
      );

    const alternates =
      canonicalizeAlternates(
        regional,
        input.alternates,
      );

    const lineage =
      buildLineage(regional);

    const fingerprint =
      contentFingerprint({
        regionalProjectionId:
          regional.id,
        projectionId:
          regional.projectionId,
        contentId:
          regional.contentId,
        decisionId:
          regional.decisionId,
        scopeId:
          regional.scopeId,
        contextId:
          regional.contextId,
        region,
        locale,
        canonicalRoute,
        alternates,
      });

    const id =
      `route-metadata:${fingerprint}`;

    const routeMetadata:
      RouteMetadataProjection =
      immutable({
        id,

        regionalProjectionId:
          regional.id,
        projectionId:
          regional.projectionId,

        contentId:
          regional.contentId,
        decisionId:
          regional.decisionId,
        scopeId:
          regional.scopeId,
        contextId:
          regional.contextId,

        region,
        locale,

        canonicalRoute,
        alternates,

        title,
        body,

        fingerprint:
          brandFingerprint(
            fingerprint,
          ),

        lineage,
      });

    return immutable({
      routeMetadata,
    });
  }

  assert(
    input: RouteMetadataInput,
  ): void {
    this.project(input);
  }
}