
export type SerpResultType = "ORGANIC" | "FEATURED_SNIPPET" | "VIDEO" | "IMAGE" | "NEWS" | "LOCAL" | "SHOPPING" | "OTHER";
export interface SerpQuery { readonly query: string; readonly market?: string; readonly language?: string; readonly device?: "DESKTOP" | "MOBILE"; }
export interface SerpRawResult { readonly url: string; readonly title: string; readonly snippet?: string; readonly position?: number; readonly type?: SerpResultType; readonly domain?: string; readonly features?: readonly string[]; }
export interface SerpObservation { readonly query: string; readonly position: number; readonly url: string; readonly domain: string; readonly title: string; readonly snippet: string; readonly resultType: SerpResultType; readonly features: readonly string[]; }
export interface NormalizedSerp { readonly query: SerpQuery; readonly provider: string; readonly retrievedAt: string; readonly results: readonly SerpObservation[]; }
export interface SerpProvider { readonly name: string; search(query: SerpQuery): Promise<readonly SerpRawResult[]>; }
