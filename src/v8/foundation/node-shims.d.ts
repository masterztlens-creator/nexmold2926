declare module "node:fs" {
  export function appendFileSync(path: string, data: string, options?: { encoding?: string; flag?: string }): void;
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function readFileSync(path: string, encoding: string): string;
}
declare module "node:path" {
  export function dirname(path: string): string;
}

declare module "node:crypto" {
  interface Hash { update(data: string, encoding?: string): Hash; digest(encoding: "hex"): string; }
  export function createHash(algorithm: string): Hash;
}
