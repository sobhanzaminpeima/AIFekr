import { describe, expect, it } from "vitest";
import { claimFlowState, flowRecoveryAction, flowTaskSchema, submitFlowState } from "./flowProtocol";

const queued=()=>flowTaskSchema.parse({transport:"GOOGLE_FLOW",state:"QUEUED",prompt:"A train crossing a bridge",ratio:"16:9",model:"flow-image",credits:2,fingerprint:"test",reuseFingerprint:"test"});
describe("Flow worker crash boundaries",()=>{
  it("leases an unsubmitted scene to only one worker",()=>{
    const first=claimFlowState(queued(),"pc1","lease1",100);
    expect(()=>claimFlowState(first,"pc2","lease2",101)).toThrow("FLOW_WORKER_BUSY");
    expect(claimFlowState(first,"pc1","ignored",102).leaseToken).toBe("lease1");
  });
  it("recovers an expired claim only before generation was committed",()=>{
    const old=claimFlowState(queued(),"pc1","lease1",100);
    const next=claimFlowState(old,"pc2","lease2",old.leaseUntil);
    expect(next.workerId).toBe("pc2");
    expect(()=>submitFlowState(next,"pc1","lease1",101)).toThrow("FLOW_STALE_CLAIM");
  });
  it("charges the generation boundary once and never reassigns uncertain output",()=>{
    const claimed=claimFlowState(queued(),"pc1","lease1",100);
    const submitted=submitFlowState(claimed,"pc1","lease1",101);
    expect(submitted.charge).toBe(true);
    expect(submitFlowState(submitted.task,"pc1","lease1",102).charge).toBe(false);
    expect(()=>claimFlowState(submitted.task,"pc2","lease2",99999999)).toThrow("FLOW_WORKER_BUSY");
    expect(flowRecoveryAction(claimFlowState(submitted.task,"pc1","new-lease",99999999))).toBe("RECOVER_OUTPUT");
  });
  it("does not submit an expired claim or reuse a completed task",()=>{
    const claimed=claimFlowState(queued(),"pc1","lease1",100);
    expect(()=>submitFlowState(claimed,"pc1","lease1",claimed.leaseUntil)).toThrow("FLOW_STALE_CLAIM");
    expect(flowRecoveryAction({...claimed,state:"COMPLETED",assetId:"result"})).toBe("WAIT");
    expect(()=>claimFlowState({...claimed,state:"COMPLETED"},"pc1","lease1",101)).toThrow("FLOW_WORKER_BUSY");
  });
});
