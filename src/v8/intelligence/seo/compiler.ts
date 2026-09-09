
import { slugify, uniqueStrings, type ContentDraft } from "../shared.js";
export interface SeoArtifact { readonly title: string; readonly slug: string; readonly description: string; readonly canonicalPath: string; readonly keywords: readonly string[]; readonly headings: readonly string[]; }
export function compileSeo(draft: ContentDraft): SeoArtifact {
  const headings = draft.sections.map(s=>s.heading); const keywords = uniqueStrings([draft.title, ...headings]);
  return Object.freeze({ title:draft.title, slug:slugify(draft.slug), description:draft.description.slice(0,160), canonicalPath:`/knowledge-hub/${slugify(draft.slug)}/`, keywords:Object.freeze(keywords.slice(0,32)), headings:Object.freeze(headings) });
}
