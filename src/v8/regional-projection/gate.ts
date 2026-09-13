import {
  immutable,
  invariant,
} from "../constitution/invariants.js";

import {
  contentFingerprint,
} from "../foundation/hash.js";

import type {
  RegionalProjection,
} from "./types.js";

export class RegionalProjectionGate {
  check(
    regional: RegionalProjection,
  ) {
    invariant(
      regional.id.trim().length > 0,
      "V8_REGIONAL_PROJECTION_ID_EMPTY",
      "Regional projection id is required.",
    );

    invariant(
      regional.projectionId.trim().length > 0,
      "V8_REGIONAL_PROJECTION_SOURCE_REQUIRED",
      "Regional projection must reference a Projection.",
    );

    invariant(
      regional.contentId.trim().length > 0,
      "V8_REGIONAL_PROJECTION_CONTENT_REQUIRED",
      "Regional projection must reference Content.",
    );

    invariant(
      regional.decisionId.trim().length > 0,
      "V8_REGIONAL_PROJECTION_DECISION_REQUIRED",
      "Regional projection must reference a Decision.",
    );

    invariant(
      regional.scopeId.trim().length > 0,
      "V8_REGIONAL_PROJECTION_SCOPE_REQUIRED",
      "Regional projection must reference a Scope.",
    );

    invariant(
      regional.contextId.trim().length > 0,
      "V8_REGIONAL_PROJECTION_CONTEXT_REQUIRED",
      "Regional projection must reference a Context.",
    );

    invariant(
      regional.region.trim().length > 0,
      "V8_REGIONAL_PROJECTION_REGION_REQUIRED",
      "Regional projection requires a region.",
    );

    invariant(
      regional.locale.trim().length > 0,
      "V8_REGIONAL_PROJECTION_LOCALE_REQUIRED",
      "Regional projection requires a locale.",
    );

    invariant(
      regional.canonicalRoute.startsWith("/") &&
        regional.canonicalRoute !== "/",
      "V8_REGIONAL_PROJECTION_CANONICAL_ROUTE_INVALID",
      "Canonical route must be a non-root path.",
    );

    invariant(
      regional.alternates.length > 0,
      "V8_REGIONAL_PROJECTION_NO_ALTERNATES",
      "Regional projection requires at least one alternate.",
    );

    const localeKeys =
      regional.alternates.map(
        (item) => item.locale.toLowerCase(),
      );

    invariant(
      new Set(localeKeys).size ===
        localeKeys.length,
      "V8_REGIONAL_PROJECTION_DUPLICATE_LOCALE",
      "Regional alternates must contain unique locales.",
    );

    invariant(
      localeKeys.includes(
        regional.locale.toLowerCase(),
      ),
      "V8_REGIONAL_PROJECTION_SELF_ALTERNATE_MISSING",
      "Regional projection must contain its own locale.",
    );

    for (const alternate of regional.alternates) {
      invariant(
        alternate.route.startsWith("/") &&
          alternate.route !== "/",
        "V8_REGIONAL_PROJECTION_ALTERNATE_ROUTE_INVALID",
        `Invalid alternate route for locale ${alternate.locale}.`,
      );
    }

    const projectionLink =
      regional.lineage.find(
        (item) =>
          item.type === "PROJECTION" &&
          item.id === regional.projectionId,
      );

    invariant(
      projectionLink !== undefined,
      "V8_REGIONAL_PROJECTION_LINEAGE_MISSING",
      "Regional projection must contain its source Projection lineage.",
    );

    const expectedFingerprint =
      contentFingerprint({
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
        region:
          regional.region,
        locale:
          regional.locale,
        canonicalRoute:
          regional.canonicalRoute,
        alternates:
          regional.alternates,
        title:
          regional.title,
        body:
          regional.body,
        sourceFingerprint:
          projectionLink.fingerprint,
      });

    invariant(
      regional.fingerprint ===
        expectedFingerprint,
      "V8_REGIONAL_PROJECTION_FINGERPRINT_MISMATCH",
      "Regional projection fingerprint does not match canonical payload.",
    );

    invariant(
      regional.id ===
        `regional-projection:${expectedFingerprint}`,
      "V8_REGIONAL_PROJECTION_ID_MISMATCH",
      "Regional projection id does not match its fingerprint.",
    );

    return immutable({
      passed: true,
      regionalProjectionId:
        regional.id,
      projectionId:
        regional.projectionId,
      locale:
        regional.locale,
      region:
        regional.region,
    });
  }
}