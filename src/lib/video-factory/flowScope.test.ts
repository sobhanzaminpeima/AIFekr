import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/video-factory/flow-worker/route";

const db = vi.hoisted(() => ({
  videoFactoryResource: { upsert: vi.fn(), update: vi.fn() },
  videoFactoryStep: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { ...db, $transaction: (run: (tx: typeof db) => unknown) => run(db) },
}));
vi.mock("@/lib/utils/rateLimit", () => ({ rateLimit: () => ({ allowed: true }) }));
vi.mock("./http", () => ({ boundedJson: (req: Request) => req.json() }));
vi.mock("./assets", () => ({ assetBytes: vi.fn(), saveAsset: vi.fn(), storagePath: vi.fn() }));

const token = "x".repeat(40);
const claim = { workerId: "worker-1", stepId: "other-step", leaseToken: "b175faac-3d8a-4fe9-9b5d-c560a5eb899c" };
function request(action: string) {
  const complete = action === "complete";
  const headers = new Headers({ authorization: "Bearer " + token });
  if (complete) {
    headers.set("x-worker-id", claim.workerId);
    headers.set("x-step-id", claim.stepId);
    headers.set("x-lease-token", claim.leaseToken);
  } else headers.set("content-type", "application/json");
  const body = action === "claim" ? { workerId: claim.workerId }
    : action === "blocked" ? { ...claim, code: "UI_CHANGED" } : claim;
  return POST(new NextRequest("https://example.test/api?action=" + action, {
    method: "POST", headers, body: complete ? new Uint8Array([1]) : JSON.stringify(body),
  }));
}

describe("server-side Flow acceptance scope", () => {
  beforeEach(() => {
    vi.stubEnv("VIDEO_FACTORY_FLOW_WORKER_TOKEN", token);
    vi.stubEnv("VIDEO_FACTORY_FLOW_TEST_JOB_ID", "fixture-job");
    db.videoFactoryStep.findMany.mockResolvedValue([]);
    db.videoFactoryStep.findUnique.mockResolvedValue(null);
  });
  afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
  it("limits claim candidates to the configured job", async () => {
    expect((await request("claim")).status).toBe(200);
    expect(db.videoFactoryStep.findMany.mock.calls[0][0].where.jobId).toBe("fixture-job");
  });
  it("preserves normal claims when the scope is absent", async () => {
    delete process.env.VIDEO_FACTORY_FLOW_TEST_JOB_ID;
    expect((await request("claim")).status).toBe(200);
    expect(db.videoFactoryStep.findMany.mock.calls[0][0].where).not.toHaveProperty("jobId");
  });
  it.each(["receipt", "reference", "start", "complete", "blocked"])("checks the job before %s", async action => {
    const response = await request(action);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: "FLOW_TASK_NOT_FOUND" });
    expect(db.videoFactoryStep.findUnique.mock.calls[0][0].where).toEqual({ id: claim.stepId, jobId: "fixture-job" });
    expect(db.videoFactoryStep.update).not.toHaveBeenCalled();
  });
});
