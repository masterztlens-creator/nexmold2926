export interface ProblemNode { readonly id: string; readonly question: string; readonly evidenceIds: readonly string[]; }
export interface ProblemEdge { readonly from: string; readonly to: string; readonly kind: "CAUSES" | "DEPENDS_ON" | "RELATED"; }
export interface ProblemGraph { readonly nodes: readonly ProblemNode[]; readonly edges: readonly ProblemEdge[]; }
export interface DecisionNode { readonly id: string; readonly problemId: string; readonly requiredKnowledgeIds: readonly string[]; readonly outcome: string; }
export interface DecisionEdge { readonly from: string; readonly to: string; readonly kind: "PREREQUISITE" | "ALTERNATIVE" | "REFINES"; }
export interface DecisionGraph { readonly nodes: readonly DecisionNode[]; readonly edges: readonly DecisionEdge[]; }

function validateIds(ids: readonly string[], code: string): void { const s = new Set<string>(); for (const id of ids) { if (!id || s.has(id)) throw new Error(`${code}:${id}`); s.add(id); } }
export function buildProblemGraph(nodes: readonly ProblemNode[], edges: readonly ProblemEdge[]): Readonly<ProblemGraph> {
  validateIds(nodes.map(n => n.id), "V8_PROBLEM_GRAPH_DUPLICATE"); const ids = new Set(nodes.map(n => n.id));
  for (const e of edges) if (!ids.has(e.from) || !ids.has(e.to)) throw new Error("V8_PROBLEM_GRAPH_DANGLING_EDGE");
  return Object.freeze({ nodes: Object.freeze([...nodes]), edges: Object.freeze([...edges]) });
}
export function buildDecisionGraph(nodes: readonly DecisionNode[], edges: readonly DecisionEdge[]): Readonly<DecisionGraph> {
  validateIds(nodes.map(n => n.id), "V8_DECISION_GRAPH_DUPLICATE"); const ids = new Set(nodes.map(n => n.id));
  for (const n of nodes) if (!n.problemId) throw new Error("V8_DECISION_GRAPH_PROBLEM_REQUIRED");
  for (const e of edges) if (!ids.has(e.from) || !ids.has(e.to)) throw new Error("V8_DECISION_GRAPH_DANGLING_EDGE");
  const adjacency = new Map<string,string[]>(); for (const id of ids) adjacency.set(id, []);
  for (const e of edges) adjacency.get(e.from)!.push(e.to);
  const visiting = new Set<string>(), visited = new Set<string>();
  const dfs = (id: string): void => { if (visiting.has(id)) throw new Error("V8_DECISION_GRAPH_CYCLE"); if (visited.has(id)) return; visiting.add(id); for (const next of adjacency.get(id)!) dfs(next); visiting.delete(id); visited.add(id); };
  for (const id of ids) dfs(id);
  return Object.freeze({ nodes: Object.freeze([...nodes]), edges: Object.freeze([...edges]) });
}
