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

export function immutable<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}
