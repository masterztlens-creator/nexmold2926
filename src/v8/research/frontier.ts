export interface FrontierItem { readonly url: string; readonly depth: number; readonly discoveredFrom?: string; readonly priority: number; }
export class ResearchFrontier {
  private readonly queue: FrontierItem[] = [];
  private readonly seen = new Set<string>();
  enqueue(items: readonly FrontierItem[]): void { for (const item of items) { if (this.seen.has(item.url)) continue; this.seen.add(item.url); this.queue.push(item); } this.queue.sort((a,b) => b.priority-a.priority || a.depth-b.depth || a.url.localeCompare(b.url)); }
  next(): FrontierItem | undefined { return this.queue.shift(); }
  get size(): number { return this.queue.length; }
  has(url: string): boolean { return this.seen.has(url); }
}
