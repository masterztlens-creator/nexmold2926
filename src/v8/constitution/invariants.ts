
export class V8InvariantError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "V8InvariantError";
    this.code = code;
  }
}

export function invariant(
  condition: unknown,
  code: string,
  message: string,
): asserts condition {
  if (!condition) {
    throw new V8InvariantError(code, message);
  }
}

export function requireKnown<T extends string>(
  value: T,
  code: string,
  field: string,
): Exclude<T, "UNKNOWN"> {
  invariant(
    value !== "UNKNOWN",
    code,
    `${field} is UNKNOWN; V8 is fail-closed.`,
  );

  return value as Exclude<T, "UNKNOWN">;
}

/**
 * Recursively freezes ordinary objects and arrays.
 *
 * JavaScript cannot freeze non-empty typed-array views in the same
 * manner as ordinary objects. Such views are traversed as terminal
 * values rather than passed to Object.freeze(), preventing runtime
 * failures when immutable domain records contain binary payloads.
 *
 * Callers must treat binary views as immutable after construction.
 * This function does not make their underlying bytes intrinsically
 * read-only.
 */
export function immutable<T extends object>(
  value: T,
): Readonly<T> {
  const seen = new WeakSet<object>();

  const freeze = (current: unknown): void => {
    if (
      current === null ||
      typeof current !== "object"
    ) {
      return;
    }

    const object = current as object;

    if (seen.has(object)) {
      return;
    }

    seen.add(object);

    // ArrayBuffer views can throw when frozen if they contain elements.
    // Do not call Object.freeze() on typed arrays or DataView instances.
    if (ArrayBuffer.isView(object)) {
      return;
    }

    // ArrayBuffer itself can be frozen as an object, but freezing does
    // not prevent mutation through its bytes. Keep it out of this
    // generic object-freezing path for the same reason as typed views.
    if (object instanceof ArrayBuffer) {
      return;
    }

    for (const key of Reflect.ownKeys(object)) {
      const descriptor = Object.getOwnPropertyDescriptor(
        object,
        key,
      );

      if (
        descriptor !== undefined &&
        "value" in descriptor
      ) {
        freeze(descriptor.value);
      }
    }

    Object.freeze(object);
  };

  freeze(value);

  return value as Readonly<T>;
}
