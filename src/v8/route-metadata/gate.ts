import {
  immutable,
  invariant,
} from "../constitution/invariants.js";

import {
  contentFingerprint,
} from "../foundation/hash.js";

import type {
  RouteMetadataProjection,
} from "./types.js";

function canonicalRoute(
  value: string,
): string {
  const route = value.trim();

  invariant(
    route.startsWith("/") &&
      route !== "/" &&
      !route.includes(" ") &&
      !route.includes("#") &&
      !route.includes("?"),
    "V8_ROUTE_METADATA_CANONICAL_ROUTE_INVALID",
    "Canonical route must be a non-root path without query or fragment.",
  );

  return route;
}

function validateLocale(
  value: string,
): string {
  const locale = value.trim();

  invariant(
    /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(
      locale,
    ),
    "V8_ROUTE_METADATA_LOCALE_INVALID",
    "Locale must use a BCP-47-compatible structural form.",
  );

  return locale;
}

export class RouteMetadataGate {
  check(
    routeMetadata: RouteMetadataProjection,
  ) {
    invariant(
      routeMetadata.id.trim().length > 0,
      "V8_ROUTE_METADATA_ID_EMPTY",
      "Route metadata id is required.",
    );

    invariant(
      routeMetadata.regionalProjectionId.trim().length > 0,
      "V8_ROUTE_METADATA_REGIONAL_ID_REQUIRED",
      "Regional Projection id is required.",
    );

    invariant(
      routeMetadata.projectionId.trim().length > 0,
      "V8_ROUTE_METADATA_PROJECTION_ID_REQUIRED",
      "Projection id is required.",
    );

    invariant(
      routeMetadata.contentId.trim().length > 0,
      "V8_ROUTE_METADATA_CONTENT_ID_REQUIRED",
      "Content id is required.",
    );

    invariant(
      routeMetadata.decisionId.trim().length > 0,
      "V8_ROUTE_METADATA_DECISION_ID_REQUIRED",
      "Decision id is required.",
    );

    invariant(
      routeMetadata.scopeId.trim().length > 0,
      "V8_ROUTE_METADATA_SCOPE_ID_REQUIRED",
      "Scope id is required.",
    );

    invariant(
      routeMetadata.contextId.trim().length > 0,
      "V8_ROUTE_METADATA_CONTEXT_ID_REQUIRED",
      "Context id is required.",
    );

    invariant(
      routeMetadata.region.trim().length > 0,
      "V8_ROUTE_METADATA_REGION_REQUIRED",
      "Region is required.",
    );

    validateLocale(
      routeMetadata.locale,
    );

    canonicalRoute(
      routeMetadata.canonicalRoute,
    );

    invariant(
      routeMetadata.title.trim().length > 0,
      "V8_ROUTE_METADATA_TITLE_REQUIRED",
      "Route metadata title is required.",
    );

    invariant(
      routeMetadata.body.trim().length > 0,
      "V8_ROUTE_METADATA_BODY_REQUIRED",
      "Route metadata body is required.",
    );

    invariant(
      routeMetadata.alternates.length > 0,
      "V8_ROUTE_METADATA_NO_ALTERNATES",
      "Route metadata requires at least one alternate.",
    );

    const localeKeys =
      routeMetadata.alternates.map(
        (item) =>
          validateLocale(
            item.locale,
          ).toLowerCase(),
      );

    invariant(
      new Set(localeKeys).size ===
        localeKeys.length,
      "V8_ROUTE_METADATA_DUPLICATE_LOCALE",
      "Route metadata locales must be unique.",
    );

    const selfIndex =
      localeKeys.indexOf(
        routeMetadata.locale.toLowerCase(),
      );

    invariant(
      selfIndex >= 0,
      "V8_ROUTE_METADATA_SELF_LOCALE_MISSING",
      "Route metadata must contain its own locale.",
    );

    const self =
      routeMetadata.alternates[
        selfIndex
      ];

    invariant(
      self.route ===
        routeMetadata.canonicalRoute,
      "V8_ROUTE_METADATA_CANONICAL_MISMATCH",
      "Self-locale route must equal the canonical route.",
    );

    for (
      let index = 0;
      index <
        routeMetadata.alternates.length;
      index += 1
    ) {
      const alternate =
        routeMetadata.alternates[index];

      canonicalRoute(
        alternate.route,
      );

      invariant(
        alternate.locale.trim().length > 0,
        "V8_ROUTE_METADATA_ALTERNATE_LOCALE_REQUIRED",
        `Alternate locale ${index} is required.`,
      );
    }

    const regionalLink =
      routeMetadata.lineage.find(
        (item) =>
          item.type === "PROJECTION" &&
          item.id ===
            routeMetadata.regionalProjectionId,
      );

    invariant(
      regionalLink !== undefined,
      "V8_ROUTE_METADATA_REGIONAL_LINEAGE_MISSING",
      "Route metadata must contain Regional Projection lineage.",
    );

    const projectionLink =
      routeMetadata.lineage.find(
        (item) =>
          item.type === "PROJECTION" &&
          item.id ===
            routeMetadata.projectionId,
      );

    invariant(
      projectionLink !== undefined,
      "V8_ROUTE_METADATA_PROJECTION_LINEAGE_MISSING",
      "Route metadata must contain source Projection lineage.",
    );

    const expectedFingerprint =
      contentFingerprint({
        regionalProjectionId:
          routeMetadata.regionalProjectionId,
        projectionId:
          routeMetadata.projectionId,
        contentId:
          routeMetadata.contentId,
        decisionId:
          routeMetadata.decisionId,
        scopeId:
          routeMetadata.scopeId,
        contextId:
          routeMetadata.contextId,
        region:
          routeMetadata.region,
        locale:
          routeMetadata.locale,
        canonicalRoute:
          routeMetadata.canonicalRoute,
        alternates:
          routeMetadata.alternates,
      });

    invariant(
      routeMetadata.fingerprint ===
        expectedFingerprint,
      "V8_ROUTE_METADATA_FINGERPRINT_MISMATCH",
      "Route metadata fingerprint does not match canonical payload.",
    );

    invariant(
      routeMetadata.id ===
        `route-metadata:${expectedFingerprint}`,
      "V8_ROUTE_METADATA_ID_MISMATCH",
      "Route metadata id does not match its fingerprint.",
    );

    return immutable({
      passed: true,
      routeMetadataId:
        routeMetadata.id,
      regionalProjectionId:
        routeMetadata.regionalProjectionId,
      projectionId:
        routeMetadata.projectionId,
      locale:
        routeMetadata.locale,
      region:
        routeMetadata.region,
      canonicalRoute:
        routeMetadata.canonicalRoute,
      alternateCount:
        routeMetadata.alternates.length,
    });
  }
}