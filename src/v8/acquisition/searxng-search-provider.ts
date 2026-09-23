import type {
  SearchProvider,
  SearchResult,
} from "./types.js";

interface SearXNGSearchResponse {
  readonly results?: readonly unknown[];
}

export interface SearXNGSearchProviderOptions {
  readonly endpoint?: string;
  readonly name?: string;
  readonly language?: string;
  readonly categories?: string;
  readonly page?: number;
  readonly safeSearch?: 0 | 1 | 2;
}

function normalizeEndpoint(endpoint: string): URL {
  const normalized = endpoint.trim();

  if (!normalized) {
    throw new Error(
      "V8_ACQUISITION_SEARXNG_ENDPOINT_MISSING",
    );
  }

  let parsed: URL;

  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(
      "V8_ACQUISITION_SEARXNG_ENDPOINT_INVALID",
    );
  }

  if (
    parsed.protocol !== "http:" &&
    parsed.protocol !== "https:"
  ) {
    throw new Error(
      "V8_ACQUISITION_SEARXNG_ENDPOINT_PROTOCOL_INVALID",
    );
  }

  parsed.hash = "";

  return parsed;
}

function normalizeQuery(query: string): string {
  const normalized = query.trim();

  if (!normalized) {
    throw new Error(
      "V8_ACQUISITION_EMPTY_SEARCH_QUERY",
    );
  }

  return normalized;
}

function normalizePage(page: number): number {
  if (
    !Number.isInteger(page) ||
    page < 1
  ) {
    throw new Error(
      "V8_ACQUISITION_SEARXNG_PAGE_INVALID",
    );
  }

  return page;
}

function normalizeLanguage(
  language: string,
): string {
  const normalized = language.trim();

  if (!normalized) {
    throw new Error(
      "V8_ACQUISITION_SEARXNG_LANGUAGE_INVALID",
    );
  }

  return normalized;
}

function normalizeCategories(
  categories: string,
): string {
  const normalized = categories.trim();

  if (!normalized) {
    throw new Error(
      "V8_ACQUISITION_SEARXNG_CATEGORIES_INVALID",
    );
  }

  return normalized;
}

function validateSearchResultUrl(
  value: unknown,
): string | undefined {
  if (
    typeof value !== "string"
  ) {
    return undefined;
  }

  const rawUrl = value.trim();

  if (!rawUrl) {
    return undefined;
  }

  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    return undefined;
  }

  if (
    parsed.protocol !== "http:" &&
    parsed.protocol !== "https:"
  ) {
    return undefined;
  }

  return parsed.toString();
}

function normalizeOptionalText(
  value: unknown,
): string | undefined {
  if (
    typeof value !== "string"
  ) {
    return undefined;
  }

  const normalized = value.trim();

  return normalized || undefined;
}

function parseResults(
  data: unknown,
): readonly SearchResult[] {
  if (
    !data ||
    typeof data !== "object"
  ) {
    throw new Error(
      "V8_ACQUISITION_SEARXNG_RESPONSE_INVALID",
    );
  }

  const results =
    (data as SearXNGSearchResponse).results;

  if (!Array.isArray(results)) {
    throw new Error(
      "V8_ACQUISITION_SEARXNG_RESULTS_INVALID",
    );
  }

  const output: SearchResult[] = [];

  for (const item of results) {
    if (
      !item ||
      typeof item !== "object"
    ) {
      continue;
    }

    const record =
      item as Record<string, unknown>;

    const url =
      validateSearchResultUrl(
        record.url,
      );

    if (!url) {
      continue;
    }

    output.push({
      url,

      title:
        normalizeOptionalText(
          record.title,
        ),

      snippet:
        normalizeOptionalText(
          record.content,
        ) ??
        normalizeOptionalText(
          record.snippet,
        ),
    });
  }

  return output;
}

export class SearXNGSearchProvider
  implements SearchProvider
{
  readonly name: string;

  private readonly endpoint: URL;
  private readonly language: string;
  private readonly categories: string;
  private readonly page: number;
  private readonly safeSearch: 0 | 1 | 2;

  constructor(
    options: SearXNGSearchProviderOptions = {},
  ) {
    this.endpoint = normalizeEndpoint(
      options.endpoint ??
        "http://127.0.0.1:8080",
    );

    this.name =
      options.name?.trim() ||
      "searxng-search";

    this.language =
      normalizeLanguage(
        options.language ??
          "en",
      );

    this.categories =
      normalizeCategories(
        options.categories ??
          "general",
      );

    this.page =
      normalizePage(
        options.page ??
          1,
      );

    this.safeSearch =
      options.safeSearch ??
      0;

    if (
      ![0, 1, 2].includes(
        this.safeSearch,
      )
    ) {
      throw new Error(
        "V8_ACQUISITION_SEARXNG_SAFE_SEARCH_INVALID",
      );
    }
  }

  async search(
    query: string,
    options: {
      readonly signal?: AbortSignal;
    } = {},
  ): Promise<readonly SearchResult[]> {
    const normalizedQuery =
      normalizeQuery(query);

    const requestUrl =
      new URL(
        "/search",
        this.endpoint,
      );

    requestUrl.searchParams.set(
      "q",
      normalizedQuery,
    );

    requestUrl.searchParams.set(
      "format",
      "json",
    );

    requestUrl.searchParams.set(
      "language",
      this.language,
    );

    requestUrl.searchParams.set(
      "categories",
      this.categories,
    );

    requestUrl.searchParams.set(
      "pageno",
      String(this.page),
    );

    requestUrl.searchParams.set(
      "safesearch",
      String(this.safeSearch),
    );

    const response =
      await fetch(
        requestUrl,
        {
          method: "GET",

          headers: {
            accept:
              "application/json",
          },

          signal:
            options.signal,
        },
      );

    if (!response.ok) {
      let detail = "";

      try {
        detail =
          (
            await response.text()
          ).trim();
      } catch {
        detail = "";
      }

      const suffix =
        detail
          ? `:${detail.slice(0, 1000)}`
          : "";

      throw new Error(
        `V8_ACQUISITION_SEARXNG_HTTP_${response.status}${suffix}`,
      );
    }

    const contentType =
      response.headers.get(
        "content-type",
      );

    if (
      contentType &&
      !contentType
        .toLowerCase()
        .includes("json")
    ) {
      throw new Error(
        `V8_ACQUISITION_SEARXNG_CONTENT_TYPE_INVALID:${contentType}`,
      );
    }

    let data: unknown;

    try {
      data =
        await response.json();
    } catch {
      throw new Error(
        "V8_ACQUISITION_SEARXNG_JSON_INVALID",
      );
    }

    return parseResults(data);
  }
}