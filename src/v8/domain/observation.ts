import {
  immutable,
  invariant,
} from "../constitution/invariants.js";

import {
  nonEmpty,
  observationId,
  type ObservationId,
} from "./primitives.js";

export type ObservationKind =
  | "OUTCOME"
  | "BEHAVIOR"
  | "MEASUREMENT"
  | "FEEDBACK"
  | "SYSTEM_EVENT";

export interface Observation {
  readonly id: ObservationId;
  readonly kind: ObservationKind;
  readonly subject: string;
  readonly value: string;
  readonly observedAt: string;
  readonly unit?: string;
  readonly contextId?: string;
  readonly sourceId?: string;
}

export function createObservation(
  input: Omit<Observation, "id"> & {
    readonly id?: string;
  },
): Readonly<Observation> {
  const kind = input.kind;
  const subject = nonEmpty(input.subject, "observation.subject");
  const value = nonEmpty(input.value, "observation.value");
  const observedAt = nonEmpty(
    input.observedAt,
    "observation.observedAt",
  );

  invariant(
    typeof kind === "string",
    "V8_OBSERVATION_KIND_REQUIRED",
    "Observation kind is required.",
  );

  if (input.unit !== undefined) {
    nonEmpty(input.unit, "observation.unit");
  }

  if (input.contextId !== undefined) {
    nonEmpty(input.contextId, "observation.contextId");
  }

  if (input.sourceId !== undefined) {
    nonEmpty(input.sourceId, "observation.sourceId");
  }

  const id =
    input.id ??
    `${kind}:${subject}:${observedAt}:${value}`;

  return immutable({
    id: observationId(id),
    kind,
    subject,
    value,
    observedAt,
    ...(input.unit === undefined
      ? {}
      : { unit: nonEmpty(input.unit, "observation.unit") }),
    ...(input.contextId === undefined
      ? {}
      : {
          contextId: nonEmpty(
            input.contextId,
            "observation.contextId",
          ),
        }),
    ...(input.sourceId === undefined
      ? {}
      : {
          sourceId: nonEmpty(
            input.sourceId,
            "observation.sourceId",
          ),
        }),
  });
}