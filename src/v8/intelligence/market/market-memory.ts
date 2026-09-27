import {
  immutable,
} from "../../constitution/invariants.js";

import {
  contentFingerprint,
} from "../../foundation/hash.js";

export interface MarketMemoryEvent {
  readonly id: string;

  readonly kind:
    | "DEMAND"
    | "DECISION"
    | "RESEARCH"
    | "COVERAGE"
    | "CONFLICT"
    | "FEEDBACK";

  readonly subjectId: string;

  readonly occurredAt: string;

  readonly payload:
    Readonly<
      Record<string, unknown>
    >;

  readonly fingerprint: string;
}

export interface MarketMemory {
  append(
    event: Omit<
      MarketMemoryEvent,
      "fingerprint"
    >,
  ): Readonly<MarketMemoryEvent>;

  get(
    subjectId: string,
  ): readonly MarketMemoryEvent[];

  all(): readonly MarketMemoryEvent[];
}

export class InMemoryMarketMemory
  implements MarketMemory
{
  private readonly events:
    MarketMemoryEvent[] = [];

  append(
    input: Omit<
      MarketMemoryEvent,
      "fingerprint"
    >,
  ): Readonly<MarketMemoryEvent> {
    const canonical = {
      id: input.id,
      kind: input.kind,
      subjectId: input.subjectId,
      occurredAt: input.occurredAt,
      payload: immutable({
        ...input.payload,
      }),
    };

    const event =
      immutable({
        ...canonical,
        fingerprint:
          String(
            contentFingerprint(
              canonical,
            ),
          ),
      });

    const existing =
      this.events.find(
        (candidate) =>
          candidate.fingerprint ===
          event.fingerprint,
      );

    if (
      existing !== undefined
    ) {
      return existing;
    }

    this.events.push(
      event,
    );

    this.events.sort(
      (left, right) =>
        left.fingerprint.localeCompare(
          right.fingerprint,
        ),
    );

    return event;
  }

  get(
    subjectId: string,
  ): readonly MarketMemoryEvent[] {
    return immutable(
      this.events.filter(
        (event) =>
          event.subjectId ===
          subjectId,
      ),
    );
  }

  all(): readonly MarketMemoryEvent[] {
    return immutable([
      ...this.events,
    ]);
  }
}