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
  RegionalAlternate,
  RegionalProjection,
  RegionalProjectionInput,
  RegionalProjectionResult,
} from "./types.js";

function normalizeRequired(
  value: string,
  field: string,
): string {
  const normalized = value.trim();

  invariant(
    normalized.length > 0,
    "V8_REGIONAL_PROJECTION_REQUIRED",
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
    "V8_REGIONAL_PROJECTION_ROUTE_INVALID",
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
    "V8_REGIONAL_PROJECTION_LOCALE_INVALID",
    "locale must use a BCP-47-compatible structural form.",
  );

  return locale;
}

function normalizeAlternate(
  alternate: RegionalAlternate,
): RegionalAlternate {
  const locale = normalizeLocale(
    alternate.locale,
  );

  const route = normalizeRoute(
    alternate.route,
    `alternate.${locale}.route`,
  );

  return immutable({
    locale,
    route,
  });
}

function canonicalizeAlternates(
  locale: string,
  canonicalRoute: string,
  alternates: readonly RegionalAlternate[],
): readonly RegionalAlternate[] {
  const normalized = alternates.map(
    normalizeAlternate,
  );

  const locales = normalized.map(
    (item) => item.locale.toLowerCase(),
  );

  invariant(
    new Set(locales).size === locales.length,
    "V8_REGIONAL_PROJECTION_DUPLICATE_LOCALE",
    "Regional alternates must contain unique locales.",
  );

  const selfAlternate = normalized.find(
    (item) =>
      item.locale.toLowerCase() ===
      locale.toLowerCase(),
  );

  invariant(
    selfAlternate !== undefined,
    "V8_REGIONAL_PROJECTION_SELF_ALTERNATE_MISSING",
    "Regional projection must contain its own locale in alternates.",
  );

  invariant(
    selfAlternate.route === canonicalRoute,
    "V8_REGIONAL_PROJECTION_CANONICAL_SELF_MISMATCH",
    "The self-locale alternate must equal the canonical route.",
  );

  return immutable(
    [...normalized].sort(
      (a, b) =>
        a.locale.localeCompare(b.locale) ||
        a.route.localeCompare(b.route),
    ),
  );
}

function projectionLineage(
  projected: RegionalProjectionInput["projected"],
): readonly LineageLink[] {
  const link: LineageLink = {
    type: "PROJECTION",
    id: projected.projectionId,
    version: 1,
    fingerprint: brandFingerprint(
      projected.fingerprint,
    ),
  };

  const lineage = [
    link,
    ...projected.lineage,
  ];

  const seen = new Set<string>();

  return immutable(
    lineage.filter((item) => {
      const key = [
        item.type,
        item.id,
        item.version,
        item.fingerprint,
      ].join(":");

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    }),
  );
}

export class RegionalProjectionProjector {
  project(
    input: RegionalProjectionInput,
  ): RegionalProjectionResult {
    const projected = input.projected;

    const region = normalizeRequired(
      input.region,
      "region",
    );

    const locale = normalizeLocale(
      input.locale,
    );

    const canonicalRoute = normalizeRoute(
      input.canonicalRoute,
      "canonicalRoute",
    );

    const title = normalizeRequired(
      projected.title,
      "projected.title",
    );

    const body = normalizeRequired(
      projected.body,
      "projected.body",
    );

    invariant(
      projected.projectionId.trim().length > 0,
      "V8_REGIONAL_PROJECTION_SOURCE_ID_EMPTY",
      "Regional projection requires a Projection id.",
    );

    invariant(
      projected.contentId.trim().length > 0,
      "V8_REGIONAL_PROJECTION_CONTENT_ID_EMPTY",
      "Regional projection requires a Content id.",
    );

    const alternates =
      canonicalizeAlternates(
        locale,
        canonicalRoute,
        input.alternates,
      );

    const fingerprint =
      contentFingerprint({
        projectionId:
          projected.projectionId,
        contentId:
          projected.contentId,
        decisionId:
          projected.decisionId,
        scopeId:
          projected.scopeId,
        contextId:
          projected.contextId,
        region,
        locale,
        canonicalRoute,
        alternates,
        title,
        body,
        sourceFingerprint:
          projected.fingerprint,
      });

    const id =
      `regional-projection:${fingerprint}`;

    const regional: RegionalProjection =
      immutable({
        id,
        projectionId:
          projected.projectionId,
        contentId:
          projected.contentId,
        decisionId:
          projected.decisionId,
        scopeId:
          projected.scopeId,
        contextId:
          projected.contextId,
        region,
        locale,
        canonicalRoute,
        alternates,
        title,
        body,
        fingerprint,
        lineage:
          projectionLineage(projected),
      });

    return immutable({
      regional,
    });
  }

  assert(
    input: RegionalProjectionInput,
  ): void {
    this.project(input);
  }
}