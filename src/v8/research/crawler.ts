import type { PageFetcher } from "../acquisition/types.js";
import { evaluateSourceUrl } from "../acquisition/source-policy.js";
import { canonicalizeUrl } from "./canonicalizer.js";
import { ResearchFrontier, type FrontierItem } from "./frontier.js";
export interface CrawlPage { readonly url:string; readonly title?:string; readonly links:readonly string[]; readonly body:string; readonly fetchedAt:string; }
export interface CrawlOptions { readonly maxPages?:number; readonly maxDepth?:number; readonly sameHostOnly?:boolean; readonly signal?:AbortSignal; }
function titleOf(html:string):string|undefined { const m=html.match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i); return m?.[1]?.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim() || undefined; }
function linksOf(html:string, base:string):string[] { const out:string[]=[]; const re=/<a(?:\s[^>]*)?\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi; let m:RegExpExecArray|null; while((m=re.exec(html))){ try{const c=canonicalizeUrl(new URL(m[1],base).toString()); if(c) out.push(c);}catch{}} return [...new Set(out)]; }
export async function crawl(seedUrls:readonly string[], fetcher:PageFetcher, options:CrawlOptions={}):Promise<readonly CrawlPage[]> {
 const maxPages=Math.max(1,options.maxPages??50), maxDepth=Math.max(0,options.maxDepth??2), sameHost=options.sameHostOnly??true; const frontier=new ResearchFrontier(); const seeds:FrontierItem[]=[];
 for(const raw of seedUrls){const u=canonicalizeUrl(raw); if(!u) continue; if(evaluateSourceUrl(u).status!=="ELIGIBLE") continue; seeds.push({url:u,depth:0,priority:100});} frontier.enqueue(seeds);
 const pages:CrawlPage[]=[]; const hosts=new Set(seeds.map(s=>new URL(s.url).host));
 while(frontier.size && pages.length<maxPages){ if(options.signal?.aborted) throw new Error("V8_RESEARCH_ABORTED"); const item=frontier.next()!; try{const p=await fetcher.fetch(item.url,{signal:options.signal}); if(!/^text\/(html|plain)|application\/xhtml\+xml$/i.test(p.mediaType)) continue; const links=linksOf(p.body,p.finalUrl).filter(u=>!sameHost||hosts.has(new URL(u).host)); pages.push(Object.freeze({url:p.finalUrl,title:titleOf(p.body),links:Object.freeze(links),body:p.body,fetchedAt:p.fetchedAt})); if(item.depth<maxDepth) frontier.enqueue(links.map(url=>({url,depth:item.depth+1,discoveredFrom:p.finalUrl,priority:100-item.depth-1})));}catch{} }
 return Object.freeze(pages);
}
