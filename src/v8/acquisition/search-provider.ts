import type { SearchProvider, SearchResult } from "./types.js";

export class HttpSearchProvider implements SearchProvider {
  readonly name: string;
  private readonly endpoint: URL;
  private readonly apiKey: string;

  constructor(endpoint: string, apiKey: string, name = "http-search") {
    this.name = name;
    this.endpoint = new URL(endpoint);
    this.apiKey = apiKey;
  }

  async search(query: string, options: { readonly signal?: AbortSignal } = {}): Promise<readonly SearchResult[]> {
    const normalized = query.trim();
    if (!normalized) throw new Error("V8_ACQUISITION_EMPTY_SEARCH_QUERY");
    const url = new URL(this.endpoint);
    url.searchParams.set("q", normalized);
    const response = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json", authorization: `Bearer ${this.apiKey}` },
      signal: options.signal,
    });
    if (!response.ok) throw new Error(`V8_ACQUISITION_SEARCH_HTTP_${response.status}`);
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error("V8_ACQUISITION_SEARCH_RESPONSE_INVALID");
    return data.flatMap((item): SearchResult[] => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      return typeof record.url === "string" && record.url.trim()
        ? [{ url: record.url.trim(), title: typeof record.title === "string" ? record.title : undefined, snippet: typeof record.snippet === "string" ? record.snippet : undefined }]
        : [];
    });
  }
}
