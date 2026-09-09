
export interface ConversionObservation { readonly slug: string; readonly sessions: number; readonly inquiries: number; readonly qualifiedInquiries: number; readonly capturedAt: string; }
export interface ConversionSignal { readonly slug: string; readonly inquiryRate: number; readonly qualificationRate: number; readonly action: "IMPROVE_CTA"|"IMPROVE_TARGETING"|"SCALE"|"WAIT"; }
export function analyzeConversion(o: ConversionObservation): ConversionSignal {
  const inquiryRate=o.inquiries/Math.max(1,o.sessions); const qualificationRate=o.qualifiedInquiries/Math.max(1,o.inquiries);
  const action=inquiryRate<.005?"IMPROVE_CTA":qualificationRate<.35?"IMPROVE_TARGETING":inquiryRate>.03?"SCALE":"WAIT";
  return {slug:o.slug,inquiryRate,qualificationRate,action};
}
