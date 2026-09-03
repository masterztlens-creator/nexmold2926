import { immutable } from "../constitution/invariants.js";
import { contextId, nonEmpty, scopeId, type ContextId, type ScopeId } from "./primitives.js";
export interface Context { readonly id: ContextId; readonly scopeId: ScopeId; readonly purpose: string; readonly variables: Readonly<Record<string, string>>; }
export function createContext(input: Omit<Context, "id"> & { id?: string }): Readonly<Context> {
  const variables = Object.fromEntries(Object.entries(input.variables).sort(([a],[b]) => a.localeCompare(b)));
  return immutable({ id: contextId(input.id ?? `${input.scopeId}:${input.purpose}`), scopeId: scopeId(input.scopeId), purpose: nonEmpty(input.purpose, "context.purpose"), variables: immutable(variables) });
}
