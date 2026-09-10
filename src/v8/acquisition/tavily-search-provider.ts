import type { SearchProvider, SearchResult } from "./types.js";
interface TavilySearchResponse {
  readonly results?: readonly unknown[];
}
export class TavilySearchProvider implements SearchProvider {
  readonly name: string;
  private readonly endpoint: URL;
  private readonly apiKey: string;
  constructor(
    apiKey: string,
    endpoint = "https://api.tavily.com/search",
    name = "tavily-search",
  ) {
    if (!apiKey.trim()) {
      throw new Error("V8_ACQUISITION_TAVILY_API_KEY_MISSING");
    }
    this.apiKey = apiKey.trim();
    this.endpoint = new URL(endpoint);
    this.name = name;
  }
  async search(
    query: string,
    options: { readonly signal?: AbortSignal } = {},
  ): Promise<readonly SearchResult[]> {
    const normalized = query.trim();
    if (!normalized) {
      throw new Error("V8_ACQUISITION_EMPTY_SEARCH_QUERY");
    }
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        query: normalized,
        search_depth: "basic",
        max_results: 5,
        include_answer: false,
        include_raw_content: false,
      }),
      signal: options.signal,
    });
    if (!response.ok) {
      throw new Error(`V8_ACQUISITION_TAVILY_HTTP_${response.status}`);
    }
    const data: unknown = await response.json();
    if (!data || typeof data !== "object") {
      throw new Error("V8_ACQUISITION_TAVILY_RESPONSE_INVALID");
    }
    const results = (data as TavilySearchResponse).results;
    if (!Array.isArray(results)) {
      throw new Error("V8_ACQUISITION_TAVILY_RESULTS_INVALID");
    }
    return results.flatMap((item): SearchResult[] => {
      if (!item || typeof item !== "object") {
        return [];
      }
      const record = item as Record<string, unknown>;
      const rawUrl =
        typeof record.url === "string"
          ? record.url.trim()
          : "";
      if (!rawUrl) {
        return [];
      }
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(rawUrl);
      } catch {
        return [];
      }
      if (
        parsedUrl.protocol !== "http:" &&
        parsedUrl.protocol !== "https:"
      ) {
        return [];
      }
      const title =
        typeof record.title === "string"
          ? record.title.trim()
          : undefined;
      const snippet =
        typeof record.content === "string"
          ? record.content.trim()
          : undefined;
      return [
        {
          url: parsedUrl.toString(),
          title: title || undefined,
          snippet: snippet || undefined,
        },
      ];
    });
  }
}