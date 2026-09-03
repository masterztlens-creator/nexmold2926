import { immutable, invariant } from "../constitution/invariants.js";
import { contentFingerprint } from "../foundation/hash.js";
import type { PublicationArtifact } from "../publication/types.js";
import type { Projection } from "./types.js";

export class ProjectionGate {
  check(a: PublicationArtifact, p: Projection) {
    invariant(p.publicationId === a.id, "V8_PROJECTION_PUBLICATION_MISMATCH", "Projection must reference the exact publication artifact.");
    invariant(p.route.startsWith("/") && p.route !== "/", "V8_PROJECTION_ROUTE_INVALID", "Projection route must be a non-root path.");

    const expected = contentFingerprint({
      publicationId: a.id,
      route: p.route.trim(),
      title: a.title,
      body: a.body,
    });

    invariant(
      p.fingerprint === expected,
      "V8_PROJECTION_FINGERPRINT_MISMATCH",
      "Projection fingerprint does not match its canonical payload.",
    );
    invariant(
      p.id === `projection:${expected}`,
      "V8_PROJECTION_ID_MISMATCH",
      "Projection id does not match its canonical fingerprint.",
    );
    invariant(p.title === a.title && p.body === a.body, "V8_PROJECTION_CONTENT_MISMATCH", "Projection content does not match publication.");
    return immutable({ passed: true, publicationId: a.id, projectionId: p.id });
  }
}
