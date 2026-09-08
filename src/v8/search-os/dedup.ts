export interface ExistingAsset {
  id: string;
  canonicalKey: string;
  title: string;
}

export function canonicalAssetKey(query: string, intent: string): string {
  return `${query.trim().toLowerCase().replace(/\s+/g, " ")}::${intent}`;
}

export function duplicateRisk(candidateKey: string, existing: readonly ExistingAsset[]): number {
  return existing.some((item) => item.canonicalKey === candidateKey) ? 1 : 0;
}
