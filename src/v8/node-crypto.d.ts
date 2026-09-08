declare module "node:crypto" {
  export function createHash(algorithm: string): {
    update(data: string, encoding?: string): any;
    update(data: Uint8Array): any;
    digest(encoding: string): string;
  };
}
