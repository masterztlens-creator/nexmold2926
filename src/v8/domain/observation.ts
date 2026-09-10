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

  invariant(
    typeof kind === "string" && kind.trim().length > 0,
    "V8_EMPTY_ID",
    "Observation.kind cannot be empty.",
  );

  invariant(
    typeof input.subject === "string" &&
      input.subject.trim().length > 0,
    "V8_EMPTY_ID",
    "Observation.subject cannot be empty.",
  );

  invariant(
    typeof input.value === "string" &&
      input.value.trim().length > 0,
    "V8_EMPTY_ID",
    "Observation.value cannot be empty.",
  );

  invariant(
    typeof input.observedAt === "string" &&
      input.observedAt.trim().length > 0,
    "V8_EMPTY_ID",
    "Observation.observedAt cannot be empty.",
  );

  const subject = nonEmpty(
    input.subject,
    "observation.subject",
  );

  const value = nonEmpty(
    input.value,
    "observation.value",
  );

  const observedAt = nonEmpty(
    input.observedAt,
    "observation.observedAt",
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
      : {
          unit: nonEmpty(
            input.unit,
            "observation.unit",
          ),
        }),
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
