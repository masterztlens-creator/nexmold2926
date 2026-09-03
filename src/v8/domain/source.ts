import { immutable, invariant } from "../constitution/invariants.js";
import { nonEmpty, sourceId, type SourceId } from "./primitives.js";

export type SourceKind = "PUBLIC_WEB" | "STANDARD_METADATA" | "FACTORY_RECORD" | "INTERNAL_DOCUMENT";
export type SourceAccess = "PAYLOAD_ALLOWED" | "METADATA_ONLY";

export interface Source {
  readonly id: SourceId;
  readonly kind: SourceKind;
  readonly locator: string;
  readonly access: SourceAccess;
  readonly title: string;
  readonly version: string;
}

export function createSource(input: Omit<Source, "id"> & { id?: string }): Readonly<Source> {
  invariant(input.access !== undefined, "V8_SOURCE_ACCESS_REQUIRED", "Source access policy is required.");
  return immutable({
    id: sourceId(input.id ?? `${input.kind}:${input.locator}:${input.version}`),
    kind: input.kind,
    locator: nonEmpty(input.locator, "source.locator"),
    access: input.access,
    title: nonEmpty(input.title, "source.title"),
    version: nonEmpty(input.version, "source.version"),
  });
}
