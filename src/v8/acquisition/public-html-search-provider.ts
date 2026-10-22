
import type {
  SearchProvider,
  SearchResult,
} from "./types.js";

export interface PublicHtmlSearchProviderOptions {
  readonly endpoint?: string;
  readonly name?: string;
  readonly language?: string;
  readonly safeSearch?: "off" | "moderate" | "strict";
  readonly maxResults?: number;
  readonly timeoutMs?: number;
  readonly maxResponseBytes?: number;
  readonly userAgent?: string;
  readonly robotsCacheTtlMs?: number;
}

interface RobotsRule {
  readonly allow: boolean;
  readonly pattern: string;
  readonly specificity: number;
  readonly order: number;
}

interface RobotsPolicy {
  readonly fetchedAt: number;
  readonly rules: readonly RobotsRule[];
}

interface HttpTextResponse {
  readonly status: number;
  readonly headers: Headers;
  readonly text: string;
  readonly finalUrl: string;
}

const DEFAULT_ENDPOINT = "https://www.bing.com/search";
const DEFAULT_USER_AGENT =
  "NEXMOLD-V8-ResearchBot/1.0 (+https://nexmold.com/)";

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const DEFAULT_MAX_RESULTS = 10;
const DEFAULT_ROBOTS_TTL_MS = 60 * 60 * 1000;
const MAX_REDIRECTS = 5;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const robotsCache = new Map<string, RobotsPolicy>();

function normalizeEndpoint(value: string): URL {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("PUBLIC_HTML_SEARCH_ENDPOINT_INVALID");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("PUBLIC_HTML_SEARCH_ENDPOINT_PROTOCOL_INVALID");
  }

  if (url.username.length > 0 || url.password.length > 0) {
    throw new Error("PUBLIC_HTML_SEARCH_ENDPOINT_CREDENTIALS_FORBIDDEN");
  }

  if (url.hash.length > 0) {
    url.hash = "";
  }

  return url;
}

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
  maximum: number,
): number {
  if (value === undefined) {
    return fallback;
  }

  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > maximum
  ) {
    throw new Error("PUBLIC_HTML_SEARCH_CONFIGURATION_INVALID");
  }

  return value;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new Error("PUBLIC_HTML_SEARCH_ABORTED");
  }
}

function decodeHtmlEntities(value: string): string {
  const named: Readonly<Record<string, string>> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
    colon: ":",
    sol: "/",
  };

  return value.replace(
    /&(#(?:x[0-9a-f]+|[0-9]+)|[a-z][a-z0-9]+);/gi,
    (entity, reference: string) => {
      if (
        reference.startsWith("#x") ||
        reference.startsWith("#X")
      ) {
        const codePoint = Number.parseInt(reference.slice(2), 16);

        return Number.isFinite(codePoint) &&
          codePoint > 0 &&
          codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : entity;
      }

      if (reference.startsWith("#")) {
        const codePoint = Number.parseInt(reference.slice(1), 10);

        return Number.isFinite(codePoint) &&
          codePoint > 0 &&
          codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : entity;
      }

      return named[reference.toLowerCase()] ?? entity;
    },
  );
}

function htmlToText(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " "),
  ).trim();
}

function getAttribute(
  attributes: string,
  name: string,
): string | undefined {
  const escapedName = name.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );

  const expression = new RegExp(
    `(?:^|\\s)${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i",
  );

  const match = expression.exec(attributes);
  const value = match?.[1] ?? match?.[2] ?? match?.[3];

  return value === undefined
    ? undefined
    : decodeHtmlEntities(value.trim());
}

/**
 * Decode a Base64 string without requiring Node.js Buffer typings.
 *
 * Bing's "a1" redirect parameter contains a Base64-encoded destination.
 * Invalid input fails closed by throwing; callers preserve the original
 * redirect URL rather than trusting an undecodable destination.
 */
function decodeBase64Utf8(value: string): string {
  const normalized = value
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );

  const binary = atob(padded);
  const bytes = Uint8Array.from(
    binary,
    (character) => character.charCodeAt(0),
  );

  return new TextDecoder("utf-8", {
    fatal: true,
  }).decode(bytes);
}

function canonicalResultUrl(
  rawUrl: string,
  endpoint: URL,
): string | undefined {
  let url: URL;

  try {
    url = new URL(rawUrl, endpoint);
  } catch {
    return undefined;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return undefined;
  }

  if (url.username.length > 0 || url.password.length > 0) {
    return undefined;
  }

  if (
    url.hostname === "www.bing.com" &&
    url.pathname === "/ck/a"
  ) {
    const target = url.searchParams.get("u");

    if (target) {
      try {
        const decoded = target.startsWith("a1")
          ? target.slice(2)
          : target;

        const decodedTarget = decodeBase64Utf8(decoded);
        const decodedUrl = new URL(decodedTarget);

        if (
          (decodedUrl.protocol === "https:" ||
            decodedUrl.protocol === "http:") &&
          decodedUrl.username.length === 0 &&
          decodedUrl.password.length === 0
        ) {
          url = decodedUrl;
        }
      } catch {
        // Keep the original URL if the redirect cannot be decoded safely.
      }
    }
  }

  url.hash = "";

  if (
    url.hostname === "www.bing.com" &&
    (url.pathname === "/search" || url.pathname === "/ck/a")
  ) {
    return undefined;
  }

  return url.toString();
}

function parseBingResults(
  html: string,
  endpoint: URL,
  maxResults: number,
): readonly SearchResult[] {
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  const blocks = html.matchAll(
    /<li\b(?=[^>]*\bclass\s*=\s*(?:"[^"]*\bb_algo\b[^"]*"|'[^']*\bb_algo\b[^']*'))[^>]*>[\s\S]*?<\/li\s*>/gi,
  );

  for (const blockMatch of blocks) {
    if (results.length >= maxResults) {
      break;
    }

    const block = blockMatch[0];

    const heading = /<h2\b[^>]*>([\s\S]*?)<\/h2\s*>/i.exec(
      block,
    );

    if (!heading) {
      continue;
    }

    const anchor = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/i.exec(
      heading[1],
    );

    if (!anchor) {
      continue;
    }

    const rawHref = getAttribute(anchor[1], "href");

    if (!rawHref) {
      continue;
    }

    const url = canonicalResultUrl(rawHref, endpoint);

    if (!url || seen.has(url)) {
      continue;
    }

    const title = htmlToText(anchor[2]);

    if (!title) {
      continue;
    }

    const snippetMatch =
      /<p\b[^>]*>([\s\S]*?)<\/p\s*>/i.exec(block) ??
      /<div\b[^>]*class\s*=\s*(?:"[^"]*\bb_caption\b[^"]*"|'[^']*\bb_caption\b[^']*')[^>]*>([\s\S]*?)<\/div\s*>/i.exec(
        block,
      );

    const snippet = snippetMatch
      ? htmlToText(snippetMatch[1])
      : "";

    seen.add(url);

    results.push(
      Object.freeze({
        url,
        title,
        ...(snippet ? { snippet } : {}),
      }),
    );
  }

  return Object.freeze(results);
}

function parseRobotsRules(
  content: string,
  userAgent: string,
): readonly RobotsRule[] {
  const lines = content.split(/\r?\n/);

  const groups: {
    agents: string[];
    rules: Array<{
      allow: boolean;
      pattern: string;
      order: number;
    }>;
  }[] = [];

  let current:
    | {
        agents: string[];
        rules: Array<{
          allow: boolean;
          pattern: string;
          order: number;
        }>;
      }
    | undefined;

  let order = 0;

  for (const rawLine of lines) {
    const line = rawLine.split("#", 1)[0]?.trim() ?? "";

    if (!line) {
      continue;
    }

    const separator = line.indexOf(":");

    if (separator < 0) {
      continue;
    }

    const directive = line
      .slice(0, separator)
      .trim()
      .toLowerCase();

    const value = line.slice(separator + 1).trim();

    if (directive === "user-agent") {
      if (!current || current.rules.length > 0) {
        current = {
          agents: [],
          rules: [],
        };

        groups.push(current);
      }

      current.agents.push(value.toLowerCase());
      continue;
    }

    if (
      !current ||
      (directive !== "allow" && directive !== "disallow") ||
      value.length === 0
    ) {
      continue;
    }

    current.rules.push({
      allow: directive === "allow",
      pattern: value,
      order: order++,
    });
  }

  const agentToken = userAgent
    .split(/[ /]/, 1)[0]
    .toLowerCase();

  let bestSpecificity = -1;

  for (const group of groups) {
    for (const agent of group.agents) {
      if (agent === "*") {
        bestSpecificity = Math.max(bestSpecificity, 0);
      } else if (
        agentToken.startsWith(agent) &&
        agent.length > bestSpecificity
      ) {
        bestSpecificity = agent.length;
      }
    }
  }

  const selectedRules: RobotsRule[] = [];

  for (const group of groups) {
    const groupSpecificity = Math.max(
      -1,
      ...group.agents.map((agent) =>
        agent === "*"
          ? 0
          : agentToken.startsWith(agent)
            ? agent.length
            : -1,
      ),
    );

    if (
      groupSpecificity < 0 ||
      groupSpecificity !== bestSpecificity
    ) {
      continue;
    }

    for (const rule of group.rules) {
      const pattern = rule.pattern;
      const specificity = pattern
        .replace(/\*|\$$/g, "")
        .length;

      selectedRules.push({
        allow: rule.allow,
        pattern,
        specificity,
        order: rule.order,
      });
    }
  }

  return Object.freeze(selectedRules);
}

function robotsRuleMatches(
  rule: RobotsRule,
  pathname: string,
): boolean {
  const endAnchored = rule.pattern.endsWith("$");
  const rawPattern = endAnchored
    ? rule.pattern.slice(0, -1)
    : rule.pattern;

  const escaped = rawPattern
    .split("*")
    .map((part) =>
      part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join(".*");

  try {
    const expression = new RegExp(
      `^${escaped}${endAnchored ? "$" : ""}`,
    );

    return expression.test(pathname);
  } catch {
    return false;
  }
}

function isAllowedByRobots(
  url: URL,
  rules: readonly RobotsRule[],
): boolean {
  const pathname = `${url.pathname}${url.search}`;

  const matches = rules
    .filter((rule) => robotsRuleMatches(rule, pathname))
    .sort((left, right) => {
      if (right.specificity !== left.specificity) {
        return right.specificity - left.specificity;
      }

      if (left.allow !== right.allow) {
        return left.allow ? -1 : 1;
      }

      return left.order - right.order;
    });

  return matches.length === 0 || matches[0].allow;
}

async function readResponseBody(
  response: Response,
  maxBytes: number,
  signal: AbortSignal,
): Promise<string> {
  const contentLength = response.headers.get("content-length");

  if (contentLength) {
    const parsed = Number(contentLength);

    if (Number.isFinite(parsed) && parsed > maxBytes) {
      throw new Error("PUBLIC_HTML_SEARCH_RESPONSE_TOO_LARGE");
    }
  }

  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      throwIfAborted(signal);

      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      totalBytes += value.byteLength;

      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error("PUBLIC_HTML_SEARCH_RESPONSE_TOO_LARGE");
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8", {
    fatal: false,
  }).decode(combined);
}

async function fetchTextWithTimeout(
  inputUrl: URL,
  options: {
    readonly signal?: AbortSignal;
    readonly timeoutMs: number;
    readonly maxBytes: number;
    readonly userAgent: string;
    readonly accept: string;
    readonly expectedOrigin: string;
  },
): Promise<HttpTextResponse> {
  const controller = new AbortController();

  const abortFromParent = () => {
    controller.abort(
      options.signal?.reason ??
        new Error("PUBLIC_HTML_SEARCH_ABORTED"),
    );
  };

  if (options.signal?.aborted) {
    abortFromParent();
  } else {
    options.signal?.addEventListener(
      "abort",
      abortFromParent,
      { once: true },
    );
  }

  const timer = setTimeout(() => {
    controller.abort(
      new Error("PUBLIC_HTML_SEARCH_TIMEOUT"),
    );
  }, options.timeoutMs);

  let currentUrl = new URL(inputUrl);
  let redirectCount = 0;

  try {
    while (true) {
      throwIfAborted(options.signal);

      if (currentUrl.origin !== options.expectedOrigin) {
        throw new Error(
          "PUBLIC_HTML_SEARCH_CROSS_ORIGIN_REDIRECT_BLOCKED",
        );
      }

      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": options.userAgent,
          Accept: options.accept,
        },
      });

      if (REDIRECT_STATUSES.has(response.status)) {
        const location = response.headers.get("location");

        if (!location) {
          throw new Error(
            "PUBLIC_HTML_SEARCH_REDIRECT_WITHOUT_LOCATION",
          );
        }

        if (redirectCount >= MAX_REDIRECTS) {
          throw new Error("PUBLIC_HTML_SEARCH_TOO_MANY_REDIRECTS");
        }

        const nextUrl = new URL(location, currentUrl);

        if (
          nextUrl.protocol !== "https:" &&
          nextUrl.protocol !== "http:"
        ) {
          throw new Error(
            "PUBLIC_HTML_SEARCH_REDIRECT_PROTOCOL_INVALID",
          );
        }

        if (
          nextUrl.username.length > 0 ||
          nextUrl.password.length > 0
        ) {
          throw new Error(
            "PUBLIC_HTML_SEARCH_REDIRECT_CREDENTIALS_FORBIDDEN",
          );
        }

        if (nextUrl.origin !== options.expectedOrigin) {
          throw new Error(
            "PUBLIC_HTML_SEARCH_CROSS_ORIGIN_REDIRECT_BLOCKED",
          );
        }

        await response.body?.cancel().catch(() => undefined);

        currentUrl = nextUrl;
        redirectCount += 1;
        continue;
      }

      const text = await readResponseBody(
        response,
        options.maxBytes,
        controller.signal,
      );

      return Object.freeze({
        status: response.status,
        headers: response.headers,
        text,
        finalUrl: currentUrl.toString(),
      });
    }
  } catch (error) {
    if (options.signal?.aborted) {
      throw new Error("PUBLIC_HTML_SEARCH_ABORTED");
    }

    if (controller.signal.aborted) {
      const reason = controller.signal.reason;

      if (
        reason instanceof Error &&
        reason.message === "PUBLIC_HTML_SEARCH_TIMEOUT"
      ) {
        throw new Error("PUBLIC_HTML_SEARCH_TIMEOUT");
      }
    }

    throw error;
  } finally {
    clearTimeout(timer);

    options.signal?.removeEventListener(
      "abort",
      abortFromParent,
    );
  }
}

export class PublicHtmlSearchProvider implements SearchProvider {
  public readonly name: string;

  private readonly endpoint: URL;
  private readonly language: string;
  private readonly safeSearch: "off" | "moderate" | "strict";
  private readonly maxResults: number;
  private readonly timeoutMs: number;
  private readonly maxResponseBytes: number;
  private readonly userAgent: string;
  private readonly robotsCacheTtlMs: number;

  public constructor(
    options: PublicHtmlSearchProviderOptions = {},
  ) {
    this.endpoint = normalizeEndpoint(
      options.endpoint ?? DEFAULT_ENDPOINT,
    );

    this.name = options.name?.trim() || "public-html-search";
    this.language = options.language?.trim() || "en";
    this.safeSearch = options.safeSearch ?? "moderate";

    this.maxResults = normalizePositiveInteger(
      options.maxResults,
      DEFAULT_MAX_RESULTS,
      50,
    );

    this.timeoutMs = normalizePositiveInteger(
      options.timeoutMs,
      DEFAULT_TIMEOUT_MS,
      120_000,
    );

    this.maxResponseBytes = normalizePositiveInteger(
      options.maxResponseBytes,
      DEFAULT_MAX_RESPONSE_BYTES,
      16 * 1024 * 1024,
    );

    this.robotsCacheTtlMs = normalizePositiveInteger(
      options.robotsCacheTtlMs,
      DEFAULT_ROBOTS_TTL_MS,
      24 * 60 * 60 * 1000,
    );

    this.userAgent =
      options.userAgent?.trim() || DEFAULT_USER_AGENT;

    if (
      this.userAgent.length < 8 ||
      this.userAgent.length > 300
    ) {
      throw new Error("PUBLIC_HTML_SEARCH_USER_AGENT_INVALID");
    }

    if (
      !["off", "moderate", "strict"].includes(this.safeSearch)
    ) {
      throw new Error("PUBLIC_HTML_SEARCH_SAFE_SEARCH_INVALID");
    }
  }

  private async getRobotsPolicy(
    signal?: AbortSignal,
  ): Promise<RobotsPolicy> {
    const origin = this.endpoint.origin;
    const cached = robotsCache.get(origin);
    const now = Date.now();

    if (
      cached &&
      now - cached.fetchedAt < this.robotsCacheTtlMs
    ) {
      return cached;
    }

    const robotsUrl = new URL("/robots.txt", this.endpoint);

    const response = await fetchTextWithTimeout(
      robotsUrl,
      {
        signal,
        timeoutMs: this.timeoutMs,
        maxBytes: 512 * 1024,
        userAgent: this.userAgent,
        accept: "text/plain,*/*;q=0.1",
        expectedOrigin: origin,
      },
    );

    if (response.status === 404 || response.status === 410) {
      const policy = Object.freeze({
        fetchedAt: now,
        rules: Object.freeze([]),
      });

      robotsCache.set(origin, policy);
      return policy;
    }

    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `PUBLIC_HTML_SEARCH_ROBOTS_HTTP_${response.status}`,
      );
    }

    const rules = parseRobotsRules(
      response.text,
      this.userAgent,
    );

    const policy = Object.freeze({
      fetchedAt: now,
      rules,
    });

    robotsCache.set(origin, policy);

    return policy;
  }

  public async search(
    query: string,
    options: {
      readonly signal?: AbortSignal;
    } = {},
  ): Promise<readonly SearchResult[]> {
    throwIfAborted(options.signal);

    if (
      typeof query !== "string" ||
      query.trim().length === 0
    ) {
      throw new Error("PUBLIC_HTML_SEARCH_QUERY_EMPTY");
    }

    const normalizedQuery = query
      .trim()
      .replace(/\s+/g, " ");

    if (normalizedQuery.length > 500) {
      throw new Error("PUBLIC_HTML_SEARCH_QUERY_TOO_LONG");
    }

    const policy = await this.getRobotsPolicy(options.signal);

    if (!isAllowedByRobots(this.endpoint, policy.rules)) {
      throw new Error("PUBLIC_HTML_SEARCH_BLOCKED_BY_ROBOTS");
    }

    const searchUrl = new URL(this.endpoint);

    searchUrl.searchParams.set("q", normalizedQuery);
    searchUrl.searchParams.set("setlang", this.language);

    const safeSearchValue: Record<
      "off" | "moderate" | "strict",
      string
    > = {
      off: "Off",
      moderate: "Moderate",
      strict: "Strict",
    };

    searchUrl.searchParams.set(
      "safeSearch",
      safeSearchValue[this.safeSearch],
    );

    const response = await fetchTextWithTimeout(
      searchUrl,
      {
        signal: options.signal,
        timeoutMs: this.timeoutMs,
        maxBytes: this.maxResponseBytes,
        userAgent: this.userAgent,
        accept: "text/html,application/xhtml+xml",
        expectedOrigin: this.endpoint.origin,
      },
    );

    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `PUBLIC_HTML_SEARCH_HTTP_${response.status}`,
      );
    }

    const contentType = (
      response.headers.get("content-type") ?? ""
    ).toLowerCase();

    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml")
    ) {
      throw new Error(
        "PUBLIC_HTML_SEARCH_UNEXPECTED_CONTENT_TYPE",
      );
    }

    const lowerHtml = response.text.toLowerCase();

    if (
      lowerHtml.includes("captcha") &&
      (
        lowerHtml.includes("verify you are human") ||
        lowerHtml.includes("unusual traffic") ||
        lowerHtml.includes("robot check")
      )
    ) {
      throw new Error("PUBLIC_HTML_SEARCH_CHALLENGE_DETECTED");
    }

    const results = parseBingResults(
      response.text,
      this.endpoint,
      this.maxResults,
    );

    if (results.length === 0) {
      throw new Error("PUBLIC_HTML_SEARCH_NO_PARSEABLE_RESULTS");
    }

    return results;
  }
}
