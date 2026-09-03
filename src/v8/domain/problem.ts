import { immutable, invariant } from "../constitution/invariants.js";
import { contextId, nonEmpty, problemId, type ContextId, type ProblemId } from "./primitives.js";
export interface Problem { readonly id: ProblemId; readonly contextId: ContextId; readonly question: string; readonly constraints: readonly string[]; }
export function createProblem(input: Omit<Problem, "id"> & { id?: string }): Readonly<Problem> {
  invariant(input.constraints.every(c => c.trim().length > 0), "V8_PROBLEM_EMPTY_CONSTRAINT", "Problem constraints cannot be empty.");
  const constraints = immutable([...new Set(input.constraints.map(c => c.trim()))].sort());
  return immutable({ id: problemId(input.id ?? `${input.contextId}:${input.question}`), contextId: contextId(input.contextId), question: nonEmpty(input.question, "problem.question"), constraints });
}
