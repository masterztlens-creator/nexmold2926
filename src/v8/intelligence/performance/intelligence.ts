
export interface SearchPerformanceObservation { readonly slug: string; readonly impressions: number; readonly clicks: number; readonly averagePosition: number; readonly ctr: number; readonly capturedAt: string; }
export interface PerformanceSignal { readonly slug: string; readonly growth: number; readonly action: "EXPAND"|"REFRESH"|"DEFEND"|"WAIT"; }
export function analyzePerformance(current: SearchPerformanceObservation, previous?: SearchPerformanceObservation): PerformanceSignal {
  const ctr=current.ctr || (current.impressions ? current.clicks/current.impressions : 0);
  if(!previous) return {slug:current.slug,growth:0,action:current.impressions>100?"EXPAND":"WAIT"};
  const growth=(current.impressions-previous.impressions)/Math.max(1,previous.impressions);
  const positionDelta=previous.averagePosition-current.averagePosition;
  const action=growth>.2&&positionDelta>0?"EXPAND":positionDelta<-.8?"REFRESH":positionDelta>.8?"DEFEND":ctr<.01?"REFRESH":"WAIT";
  return {slug:current.slug,growth,action};
}
