declare module "node:fs" {
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): string | undefined;
  export function appendFileSync(path: string, data: string, encoding?: string): void;
  export function readFileSync(path: string, encoding: string): string;
}
