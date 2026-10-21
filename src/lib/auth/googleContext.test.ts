import {describe,it,expect} from "vitest";
import {googleContext,readGoogleContext,safeGoogleRedirect} from "./googleContext";
describe("Google journey context",()=>{
 it("preserves plan, language, audience and inviter through cookies",()=>{
  const context=googleContext(new URLSearchParams({plan:"STUDENT_QUARTERLY",language:"tr",accountType:"STUDENT",ref:"sobhan",promo:"sobhan",period:"monthly"}));
  expect(readGoogleContext(JSON.stringify(context))).toEqual(context);
 });
 it.each(["https://evil.example","//evil.example","/\\evil.example","/\n/evil.example"])("rejects external redirect %s",value=>expect(safeGoogleRedirect(value)).toBeNull());
 it("allows only same-origin paths",()=>{expect(safeGoogleRedirect("/plans?plan=STUDENT_MONTHLY")).toBe("/plans?plan=STUDENT_MONTHLY");expect(readGoogleContext("bad-json").selectedPlan).toBe("");});
});
