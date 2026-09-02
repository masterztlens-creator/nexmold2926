/**
 * NEXMOLD V6.2 Canonical Resolver
 * URL authority only. It never calculates page score.
 */
export type CanonicalAction = "GENERATE_INDEX" | "GENERATE_NOINDEX" | "MERGE" | "REJECT";

export interface CanonicalInput {
  readonly action: CanonicalAction;
  readonly candidateUrl: string;
  readonly winnerUrl?: string;
  readonly industryUrl: string;
}

export interface CanonicalDecision {
  readonly canonical?: string;
  readonly indexable: boolean;
  readonly robots: "index,follow" | "noindex,follow";
}

function normalizeUrl(path: string): string {
  const value = path.trim();
  if (!value) throw new Error("[CanonicalResolver] Empty URL");
  if (!value.startsWith("/")) throw new Error(`[CanonicalResolver] URL must be root-relative: ${value}`);
  if (value.includes("?") || value.includes("#")) throw new Error(`[CanonicalResolver] Query/hash not allowed: ${value}`);
  return `${value.replace(/\/+/g, "/").replace(/\/$/, "")}/`;
}

export function resolveCanonical(input: CanonicalInput): CanonicalDecision {
  const candidate = normalizeUrl(input.candidateUrl);
  const industry = normalizeUrl(input.industryUrl);

  switch (input.action) {
    case "GENERATE_INDEX":
      return { canonical: candidate, indexable: true, robots: "index,follow" };
    case "GENERATE_NOINDEX":
      return { canonical: industry, indexable: false, robots: "noindex,follow" };
    case "MERGE": {
      if (!input.winnerUrl) throw new Error("[CanonicalResolver] MERGE requires winnerUrl");
      const winner = normalizeUrl(input.winnerUrl);
      return { canonical: winner, indexable: false, robots: "noindex,follow" };
    }
    case "REJECT":
      return { indexable: false, robots: "noindex,follow" };
  }
}
