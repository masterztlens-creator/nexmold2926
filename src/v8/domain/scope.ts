import { immutable, invariant } from "../constitution/invariants.js";
import { nonEmpty, scopeId, sortedUnique, type ScopeId } from "./primitives.js";
export interface Scope { readonly id: ScopeId; readonly geography: string; readonly industries: readonly string[]; readonly languages: readonly string[]; }
export function createScope(input: Omit<Scope, "id"> & { id?: string }): Readonly<Scope> {
  invariant(input.languages.length > 0, "V8_SCOPE_NO_LANGUAGE", "Scope requires at least one language.");
  return immutable({ id: scopeId(input.id ?? `${input.geography}:${input.languages.join(",")}`), geography: nonEmpty(input.geography, "scope.geography"), industries: sortedUnique(input.industries, "scope.industries"), languages: sortedUnique(input.languages, "scope.languages") });
}
