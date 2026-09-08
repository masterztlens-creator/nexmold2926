import type {
  KnowledgeGap,
  KnowledgeRequirement,
} from "./types.js";
export function detectKnowledgeGaps(
  requirements: KnowledgeRequirement[],
  observedSignals: Iterable<string>,
): KnowledgeGap[] {
  const observed = new Set(
    Array.from(observedSignals, (value) =>
      value.trim().toLowerCase(),
    ),
  );
  return requirements.map((requirement) => {
    const missingSignals = requirement.requiredSignals.filter(
      (signal) => !observed.has(signal.trim().toLowerCase()),
    );
    return {
      requirementId: requirement.id,
      description: requirement.description,
      status:
        missingSignals.length === 0
          ? "COVERED"
          : "OPEN",
      missingSignals,
      observedSignals: requirement.requiredSignals.filter(
        (signal) => observed.has(signal.trim().toLowerCase()),
      ),
    };
  });
}