import { describe, expect, it } from "vitest";
import { studentEntryHref } from "./entry";
describe("student entry for existing accounts",()=>{
  it("takes existing personal and business accounts to activation instead of registration",()=>{for(const accountType of ["PERSONAL","BUSINESS","STUDENT"])expect(studentEntryHref({accountType,plan:"FREE"})).toBe("/plans?plan=STUDENT_FIRST_THREE_MONTHS&period=monthly")});
  it("opens the workspace only with an active paid student account",()=>{expect(studentEntryHref({accountType:"STUDENT",plan:"STUDENT_MONTHLY",planExpiry:new Date(Date.now()+86400000)})).toBe("/student");expect(studentEntryHref({accountType:"STUDENT",plan:"STUDENT_MONTHLY",planExpiry:new Date(0)})).toContain("/plans?");});
  it("preserves the selected plan for renewal and anonymous registration",()=>{expect(studentEntryHref({accountType:"STUDENT",plan:"STUDENT_MONTHLY",planExpiry:new Date(Date.now()+86400000)},"STUDENT_MONTHLY","purchase")).toBe("/plans?plan=STUDENT_MONTHLY&period=monthly");expect(studentEntryHref(null)).toBe("/register?plan=STUDENT_FIRST_THREE_MONTHS&period=monthly")});
});
