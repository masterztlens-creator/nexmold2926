import { immutable, invariant } from "../constitution/invariants.js";
import { contentFingerprint } from "../foundation/hash.js";
import type { ProjectionInput, Projection } from "./types.js";

export function project(i: ProjectionInput): Readonly<Projection> {
  const route = i.route.trim();
  invariant(route.startsWith("/") && route !== "/", "V8_PROJECTION_ROUTE_INVALID", "Projection route must be a non-root path.");

  const fp = contentFingerprint({
    publicationId: i.artifact.id,
    route,
    title: i.artifact.title,
    body: i.artifact.body,
  });

  return immutable({
    id: `projection:${fp}`,
    publicationId: i.artifact.id,
    route,
    title: i.artifact.title,
    body: i.artifact.body,
    fingerprint: fp,
  });
}
