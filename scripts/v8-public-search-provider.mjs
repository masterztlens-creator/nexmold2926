
const DEFAULT_RESULT_LIMIT = 10;
const MAX_RESULT_LIMIT = 50;

function decodeHtml(value) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, decimal) => {
      const codePoint = Number(decimal);

      return Number.isInteger(codePoint) &&
        codePoint >= 0 &&
        codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hexadecimal) => {
      const codePoint = Number.parseInt(hexadecimal, 16);

      return Number.isInteger(codePoint) &&
        codePoint >= 0 &&
        codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : "";
    });
}

function stripHtml(value) {
  return decodeHtml(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function normalizeResultUrl(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  try {
    const url = new URL(value.trim());

    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username !== "" ||
      url.password !== "" ||
      url.hostname === "" ||
      url.hostname === "localhost" ||
      url.hostname.endsWith(".localhost") ||
      url.hostname.endsWith(".local") ||
      url.hostname === "bing.com" ||
      url.hostname.endsWith(".bing.com")
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function extractAttribute(tag, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const expression = new RegExp(
    `\\b${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i",
  );

  const match = tag.match(expression);

  return match
    ? decodeHtml(match[1] ?? match[2] ?? match[3] ?? "")
    : null;
}

function extractAnchor(block) {
  const match = block.match(
    /<h2\b[^>]*>[\s\S]*?<a\b([^>]*)>([\s\S]*?)<\/a>/i,
  );

  if (!match) {
    return null;
  }

  const attributes = match[1] ?? "";
  const innerHtml = match[2] ?? "";
  const href = extractAttribute(attributes, "href");
  const title = stripHtml(innerHtml);

  const url = normalizeResultUrl(href);

  if (!url || !title) {
    return null;
  }

  return { url, title };
}

function extractSnippet(block) {
  const match = block.match(
    /<p\b[^>]*>([\s\S]*?)<\/p>/i,
  );

  if (!match) {
    return undefined;
  }

  const snippet = stripHtml(match[1] ?? "");

  return snippet
    ? snippet.slice(0, 4000)
    : undefined;
}

function extractBingResults(html, sourceUrl, observedAt, limit) {
  /*
   * Restrict extraction to Bing's organic-result containers.
   * Do not turn arbitrary page links, navigation links, or the bootstrap
   * corpus into search results.
   */
  const blocks = html.match(
    /<li\b[^>]*class\s*=\s*(?:"[^"]*\bb_algo\b[^"]*"|'[^']*\bb_algo\b[^']*')[^>]*>[\s\S]*?<\/li>/gi,
  ) ?? [];

  const results = [];
  const seen = new Set();

  for (const block of blocks) {
    if (results.length >= limit) {
      break;
    }

    const anchor = extractAnchor(block);

    if (!anchor || seen.has(anchor.url)) {
      continue;
    }

    seen.add(anchor.url);

    results.push(
      Object.freeze({
        url: anchor.url,
        title: anchor.title,
        snippet: extractSnippet(block),

        /*
         * These are actual response provenance fields consumed by the
         * first-hop observer. sourceUrl is the search page returned by
         * the HTTP request, not the target result URL.
         */
        searchSourceUrl: sourceUrl,
        searchObservedAt: observedAt,
      }),
    );
  }

  return Object.freeze(results);
}

export class BingHtmlSearchProvider {
  constructor({
    endpoint = "https://www.bing.com/search",
    resultLimit = DEFAULT_RESULT_LIMIT,
    timeoutMs = 15000,
  } = {}) {
    let parsedEndpoint;

    try {
      parsedEndpoint = new URL(endpoint);
    } catch {
      throw new Error("V8_SEARCH_PROVIDER_ENDPOINT_INVALID");
    }

    if (
      parsedEndpoint.protocol !== "https:" ||
      parsedEndpoint.hostname !== "www.bing.com"
    ) {
      throw new Error("V8_SEARCH_PROVIDER_ENDPOINT_NOT_ALLOWED");
    }

    if (
      !Number.isInteger(resultLimit) ||
      resultLimit < 1 ||
      resultLimit > MAX_RESULT_LIMIT
    ) {
      throw new Error("V8_SEARCH_PROVIDER_RESULT_LIMIT_INVALID");
    }

    if (
      !Number.isInteger(timeoutMs) ||
      timeoutMs < 1000 ||
      timeoutMs > 120000
    ) {
      throw new Error("V8_SEARCH_PROVIDER_TIMEOUT_INVALID");
    }

    this.name = "bing-html";
    this.endpoint = parsedEndpoint;
    this.resultLimit = resultLimit;
    this.timeoutMs = timeoutMs;
  }

  async search(query, options = {}) {
    if (typeof query !== "string" || query.trim() === "") {
      throw new Error("V8_ACQUISITION_EMPTY_SEARCH_QUERY");
    }

    if (options.signal?.aborted) {
      throw new Error("V8_SEARCH_PROVIDER_ABORTED");
    }

    const requestUrl = new URL(this.endpoint);

    requestUrl.searchParams.set("q", query.trim());
    requestUrl.searchParams.set("count", String(this.resultLimit));
    requestUrl.searchParams.set("setlang", "en");
    requestUrl.searchParams.set("ensearch", "1");

    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(
        new Error("V8_SEARCH_PROVIDER_TIMEOUT"),
      ),
      this.timeoutMs,
    );

    const forwardAbort = () => controller.abort(
      options.signal?.reason,
    );

    options.signal?.addEventListener(
      "abort",
      forwardAbort,
      { once: true },
    );

    try {
      if (options.signal?.aborted) {
        throw new Error("V8_SEARCH_PROVIDER_ABORTED");
      }

      const response = await fetch(requestUrl, {
        method: "GET",
        redirect: "follow",
        headers: {
          accept: "text/html,application/xhtml+xml",
          "accept-language": "en-US,en;q=0.9",
          "user-agent":
            "Mozilla/5.0 (compatible; NEXMOLD-V8/1.0; +https://nexmold.com/)",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `V8_SEARCH_PROVIDER_HTTP_${response.status}`,
        );
      }

      const mediaType = (
        response.headers.get("content-type") ?? ""
      ).toLowerCase();

      if (
        !mediaType.includes("text/html") &&
        !mediaType.includes("application/xhtml+xml")
      ) {
        throw new Error(
          "V8_SEARCH_PROVIDER_RESPONSE_NOT_HTML",
        );
      }

      const html = await response.text();

      if (!html.trim()) {
        throw new Error("V8_SEARCH_PROVIDER_RESPONSE_EMPTY");
      }

      /*
       * response.url is the final URL after HTTP redirects. It records
       * the actual search page that produced the parsed result set.
       */
      const sourceUrl = normalizeResultUrl(response.url);

      if (!sourceUrl) {
        throw new Error(
          "V8_SEARCH_PROVIDER_SOURCE_URL_INVALID",
        );
      }

      const observedAt = new Date().toISOString();

      const results = extractBingResults(
        html,
        sourceUrl,
        observedAt,
        this.resultLimit,
      );

      if (results.length === 0) {
        throw new Error(
          "V8_SEARCH_PROVIDER_NO_PARSEABLE_RESULTS",
        );
      }

      return results;
    } catch (error) {
      if (options.signal?.aborted) {
        throw new Error("V8_SEARCH_PROVIDER_ABORTED");
      }

      if (
        controller.signal.aborted &&
        !options.signal?.aborted
      ) {
        throw new Error("V8_SEARCH_PROVIDER_TIMEOUT");
      }

      throw error;
    } finally {
      clearTimeout(timeout);

      options.signal?.removeEventListener(
        "abort",
        forwardAbort,
      );
    }
  }
}
