import {it,expect} from "vitest";
import {shouldShowFitness} from "./navigation";
it("shows a manually activated business user without a fitness profile",()=>{expect(shouldShowFitness({accountType:"BUSINESS",industryPackId:"business",crmActive:true,fitnessAccessExpiry:"2030-01-01"},new Date("2026-10-26"))).toBe(true);});
it("does not treat an expired grant as active for a business account",()=>{expect(shouldShowFitness({accountType:"BUSINESS",industryPackId:"business",crmActive:true,fitnessAccessExpiry:"2025-01-01"},new Date("2026-10-26"))).toBe(false);});
it("retains profile, administrator and personal-account navigation",()=>{expect(shouldShowFitness({accountType:"BUSINESS",hasProfile:true})).toBe(true);expect(shouldShowFitness({role:"SUPER_ADMIN",accountType:"BUSINESS"})).toBe(true);expect(shouldShowFitness({accountType:"PERSONAL"})).toBe(true);});
