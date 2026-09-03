import { immutable } from "../constitution/invariants.js";
import { entityId, nonEmpty, type EntityId } from "./primitives.js";

export interface Entity { readonly id: EntityId; readonly type: string; readonly canonicalName: string; }
export function createEntity(input: Omit<Entity, "id"> & { id?: string }): Readonly<Entity> {
  return immutable({ id: entityId(input.id ?? `${input.type}:${input.canonicalName}`), type: nonEmpty(input.type, "entity.type"), canonicalName: nonEmpty(input.canonicalName, "entity.canonicalName") });
}
