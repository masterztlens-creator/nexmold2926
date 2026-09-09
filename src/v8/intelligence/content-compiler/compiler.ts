
import { slugify, type ContentBrief, type ContentDraft, type EvidenceRef } from "../shared.js";
export interface CompilerInput { readonly brief: ContentBrief; readonly evidence: readonly EvidenceRef[]; readonly facts?: readonly string[]; }
export function compileIndustrialContent(input: CompilerInput): ContentDraft {
  const sections = input.brief.outline.map((heading, i)=>({ heading, body: i===0 ? `${input.brief.primaryKeyword} is addressed here with defined scope and terminology.` : `This section presents engineering considerations for ${input.brief.primaryKeyword}, with explicit conditions, trade-offs, and evidence where applicable.` }));
  return Object.freeze({ title:input.brief.title, slug:slugify(input.brief.primaryKeyword), description:`Engineering guidance for ${input.brief.primaryKeyword}.`, sections:Object.freeze(sections), claims:Object.freeze(input.facts ?? []), evidence:Object.freeze(input.evidence) });
}
