
import { normalizeText } from "../shared.js";
export interface GraphNode { readonly id: string; readonly type: "ENTITY"|"TOPIC"|"KEYWORD"|"SOURCE"|"PAGE"; readonly label: string; }
export interface GraphEdge { readonly from: string; readonly to: string; readonly relation: "COVERS"|"SUPPORTS"|"TARGETS"|"RELATED_TO"|"LINKS_TO"; }
export interface AuthorityGraph { readonly nodes: readonly GraphNode[]; readonly edges: readonly GraphEdge[]; }
export function buildAuthorityGraph(topic: string, keywords: readonly string[], sourceUrls: readonly string[]): AuthorityGraph {
  const nodes: GraphNode[] = [{id:`topic:${normalizeText(topic)}`,type:"TOPIC",label:topic}, ...keywords.map(k=>({id:`keyword:${normalizeText(k)}`,type:"KEYWORD" as const,label:k})), ...sourceUrls.map(u=>({id:`source:${u}`,type:"SOURCE" as const,label:u}))];
  const edges: GraphEdge[] = [...keywords.map(k=>({from:`topic:${normalizeText(topic)}`,to:`keyword:${normalizeText(k)}`,relation:"COVERS" as const})), ...sourceUrls.map(u=>({from:`source:${u}`,to:`topic:${normalizeText(topic)}`,relation:"SUPPORTS" as const}))];
  return Object.freeze({nodes:Object.freeze(nodes),edges:Object.freeze(edges)});
}
