import { invariant } from "../constitution/invariants.js";
import type { Evidence } from "../domain/evidence.js";
export function assertEvidenceReady(e:Evidence):void{
 invariant(e.excerpt.trim().length>0,"V8_EVIDENCE_EXCERPT_REQUIRED","Evidence requires raw excerpt.");
 invariant(e.locator.trim().length>0,"V8_EVIDENCE_LOCATOR_REQUIRED","Evidence requires exact locator.");
 invariant(e.verificationStatus!=="VERIFIED" || Boolean(e.page||e.section||e.table||e.row),"V8_EVIDENCE_EXACT_LOCATOR_REQUIRED","Verified Evidence requires a document locator.");
 if(e.parameter!==undefined) invariant(e.value!==undefined,"V8_EVIDENCE_VALUE_REQUIRED","Parameter evidence requires a value.");
 invariant(e.verificationStatus!=="VERIFIED" || Boolean(e.materialGrade||e.testMethod||e.testCondition||e.parameter),"V8_EVIDENCE_CONTEXT_REQUIRED","Verified engineering evidence requires applicability context.");
}
