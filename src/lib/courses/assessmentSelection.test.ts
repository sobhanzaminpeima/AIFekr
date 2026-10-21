import {describe,it,expect,vi,afterEach} from "vitest";
import {selectAssessment,verifyAssessment} from "./assessmentSelection";
afterEach(()=>{vi.unstubAllEnvs();vi.useRealTimers();});
describe("signed assessment bank selection",()=>{
 const scope={userId:"student",versionId:"immutable-version",lessonId:"0:0"},settings={randomize:true,questionCount:3};
 it("selects unique bank questions and binds selection to learner, lesson and version",()=>{vi.stubEnv("JWT_SECRET","isolated-selection-test-key");const s=selectAssessment(scope,10,settings);expect(s.indices).toHaveLength(3);expect(new Set(s.indices).size).toBe(3);expect(verifyAssessment(s.token,scope,10,settings)).toEqual(s.indices);for(const field of ["userId","versionId","lessonId"])expect(()=>verifyAssessment(s.token,{...scope,[field]:"forged"},10,settings)).toThrow("ASSESSMENT_EXPIRED_RELOAD");expect(()=>verifyAssessment(s.token+"x",scope,10,settings)).toThrow();});
 it("rejects expired tokens without accepting a client selected question set",()=>{vi.stubEnv("JWT_SECRET","isolated-selection-test-key");vi.useFakeTimers();const s=selectAssessment(scope,10,settings);vi.advanceTimersByTime(2*3600000+1);expect(()=>verifyAssessment(s.token,scope,10,settings)).toThrow();expect(()=>verifyAssessment(undefined,scope,10,settings)).toThrow();});
});
