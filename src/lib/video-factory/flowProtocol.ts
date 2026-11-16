import { z } from "zod";
import { FactoryError } from "./errors";

export const FLOW_LEASE_MS = 90_000;
export const flowTaskSchema = z.object({
  transport: z.literal("GOOGLE_FLOW"),
  state: z.enum(["QUEUED", "CLAIMED", "SUBMITTED", "UPLOADING", "COMPLETED", "NEEDS_REVIEW"]),
  prompt: z.string().min(1).max(12000), ratio: z.enum(["16:9", "9:16", "1:1"]),
  model: z.string().max(100), credits: z.number().int().nonnegative(),
  fingerprint: z.string(), reuseFingerprint: z.string(),
  referenceAssetId: z.string().nullable().default(null),
  workerId: z.string().nullable().default(null), leaseToken: z.string().nullable().default(null),
  leaseUntil: z.number().nonnegative().default(0),
  submittedAt: z.number().nullable().default(null), assetId: z.string().nullable().default(null),
  error: z.string().max(100).nullable().default(null),
}).strict();
export type FlowTask = z.infer<typeof flowTaskSchema>;

/** Only a claim that never crossed the generation boundary can be reassigned. */
export function claimFlowState(task: FlowTask, workerId: string, token: string, now: number): FlowTask {
  if (task.state === "QUEUED" || (task.state === "CLAIMED" && task.leaseUntil <= now)) {
    return {...task, state:"CLAIMED", workerId, leaseToken:token, leaseUntil:now+FLOW_LEASE_MS};
  }
  if (task.workerId === workerId && ["CLAIMED", "SUBMITTED", "NEEDS_REVIEW"].includes(task.state)) return task;
  throw new FactoryError("FLOW_WORKER_BUSY",409);
}

/** Persist BEFORE clicking Generate. A crash then requires reconciliation, never a blind retry. */
export function submitFlowState(task: FlowTask, workerId: string, token: string, now: number): {task:FlowTask; charge:boolean} {
  requireFlowClaim(task,workerId,token);
  if (task.state === "SUBMITTED") return {task,charge:false};
  if (task.state !== "CLAIMED" || task.leaseUntil <= now) throw new FactoryError("FLOW_STALE_CLAIM",409);
  return {task:{...task,state:"SUBMITTED",submittedAt:now,leaseUntil:0},charge:true};
}

export function requireFlowClaim(task:FlowTask,workerId:string,token:string) {
  if (!token || task.workerId!==workerId || task.leaseToken!==token) throw new FactoryError("FLOW_STALE_CLAIM",409);
}

export function flowRecoveryAction(task:FlowTask):"GENERATE"|"RECOVER_OUTPUT"|"WAIT" {
  if(task.state==="CLAIMED")return "GENERATE";
  if(task.state==="SUBMITTED" || task.state==="NEEDS_REVIEW")return "RECOVER_OUTPUT";
  return "WAIT";
}
