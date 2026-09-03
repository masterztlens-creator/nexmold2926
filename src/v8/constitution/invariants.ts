export class V8InvariantError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "V8InvariantError";
    this.code = code;
  }
}

export function invariant(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new V8InvariantError(code, message);
}

export function requireKnown<T extends string>(value: T, code: string, field: string): Exclude<T, "UNKNOWN"> {
  invariant(value !== "UNKNOWN", code, `${field} is UNKNOWN; V8 is fail-closed.`);
  return value as Exclude<T, "UNKNOWN">;
}

/** Constitution-level deep immutability boundary. */
export function immutable<T extends object>(value: T): Readonly<T> {
  const seen = new WeakSet<object>();
  const freeze = (current: unknown): void => {
    if (current === null || typeof current !== "object") return;
    const objectValue = current as object;
    if (seen.has(objectValue)) return;
    seen.add(objectValue);
    for (const key of Reflect.ownKeys(objectValue)) {
      const descriptor = Object.getOwnPropertyDescriptor(objectValue, key);
      if (descriptor && "value" in descriptor) freeze(descriptor.value);
    }
    Object.freeze(objectValue);
  };
  freeze(value);
  return value as Readonly<T>;
}
