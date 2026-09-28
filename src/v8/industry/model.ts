import { contentFingerprint } from "../foundation/hash.js";
import { nonEmpty, type Fingerprint } from "../domain/primitives.js";

export type IndustryNodeKind =
  | "DOMAIN" | "PROCESS" | "MATERIAL" | "EQUIPMENT" | "STANDARD"
  | "APPLICATION" | "ENTITY" | "METRIC" | "DEFECT" | "SERVICE";

export interface IndustryNode {
  readonly id: string;
  readonly kind: IndustryNodeKind;
  readonly label: string;
  readonly parentId?: string;
  readonly aliases?: readonly string[];
  readonly tags?: readonly string[];
}

export interface IndustryModel {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly rootNodeId: string;
  readonly nodes: readonly IndustryNode[];
  readonly fingerprint: Fingerprint;
}

export function createIndustryModel(input: {
  id: string; name: string; rootNodeId: string; nodes: readonly IndustryNode[]; version?: number;
}): Readonly<IndustryModel> {
  const id = nonEmpty(input.id, "industry.id");
  const name = nonEmpty(input.name, "industry.name");
  const nodes = [...input.nodes].map((n) => ({ ...n, id: nonEmpty(n.id, "industry.node.id"), label: nonEmpty(n.label, "industry.node.label") }));
  const ids = new Set<string>();
  for (const n of nodes) {
    if (ids.has(n.id)) throw new Error(`V8_INDUSTRY_DUPLICATE_NODE:${n.id}`);
    ids.add(n.id);
  }
  if (!ids.has(input.rootNodeId)) throw new Error("V8_INDUSTRY_ROOT_MISSING");
  const roots = nodes.filter((n) => !n.parentId);
  if (roots.length !== 1 || roots[0].id !== input.rootNodeId) throw new Error("V8_INDUSTRY_SINGLE_ROOT_REQUIRED");
  for (const n of nodes) if (n.parentId && !ids.has(n.parentId)) throw new Error(`V8_INDUSTRY_PARENT_MISSING:${n.id}`);
  const fingerprint = contentFingerprint({ id, name, version: input.version ?? 1, rootNodeId: input.rootNodeId, nodes });
  return Object.freeze({ id, name, version: input.version ?? 1, rootNodeId: input.rootNodeId, nodes: Object.freeze(nodes), fingerprint });
}
