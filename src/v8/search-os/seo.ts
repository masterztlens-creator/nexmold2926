import type { AssetCandidate, SearchIntent } from "./contracts.js";

export interface SeoCompilation {
  title: string;
  description: string;
  canonicalKey: string;
}

export function compileSeo(asset: AssetCandidate, intent: SearchIntent): Readonly<SeoCompilation> {
  const title = asset.title.trim();
  if (!title) throw new Error("V8_SEO_TITLE_REQUIRED");
  return Object.freeze({
    title,
    description: `Engineering guidance for ${intent.requiredEntities.join(", ")} with explicit applicability and evidence boundaries.`,
    canonicalKey: asset.canonicalKey,
  });
}
