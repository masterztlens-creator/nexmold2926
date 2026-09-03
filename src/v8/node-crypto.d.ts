declare module 'node:crypto' { export function createHash(algorithm:string): { update(data:string, encoding?:string): any; digest(encoding:string): string; }; }
