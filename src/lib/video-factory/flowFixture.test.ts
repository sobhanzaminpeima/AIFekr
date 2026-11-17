import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/cron/video-factory-flow-fixture/route";
import { processFactoryTick } from "./worker";
import { isCronAuthorized } from "@/lib/auth/cronAuth";
import { factoryQueueFilter } from "./flowScope";

vi.mock("./worker", () => ({ processFactoryTick: vi.fn().mockResolvedValue("fixture-job") }));
vi.mock("@/lib/auth/cronAuth", () => ({ isCronAuthorized: vi.fn().mockReturnValue(true) }));
const request = (id: string) => POST(new NextRequest("https://example.test/check?jobId=" + id, { method: "POST" }));

describe("fixture checkpoint", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
  it("partitions the regular and fixture scheduler selections", () => {
    vi.stubEnv("VIDEO_FACTORY_FLOW_TEST_JOB_ID", "fixed");
    expect(factoryQueueFilter()).toEqual({ id: { not: "fixed" } });
    expect(factoryQueueFilter("fixed")).toEqual({ id: "fixed", stage: "ASSET_GENERATION" });
    expect(() => factoryQueueFilter("other")).toThrow("FIXTURE_SCOPE_MISMATCH");
    delete process.env.VIDEO_FACTORY_FLOW_TEST_JOB_ID;
    expect(factoryQueueFilter()).toEqual({});
  });
  it("rejects a missing or different server scope before processing", async () => {
    vi.stubEnv("VIDEO_FACTORY_FLOW_TEST_JOB_ID", "");
    expect((await request("fixture-job")).status).toBe(409);
    vi.stubEnv("VIDEO_FACTORY_FLOW_TEST_JOB_ID", "other-job");
    expect((await request("fixture-job")).status).toBe(409);
    expect(processFactoryTick).not.toHaveBeenCalled();
  });
  it("requires cron authorization", async () => {
    vi.stubEnv("VIDEO_FACTORY_FLOW_TEST_JOB_ID", "fixture-job");
    vi.mocked(isCronAuthorized).mockReturnValueOnce(false);
    expect((await request("fixture-job")).status).toBe(401);
    expect(processFactoryTick).not.toHaveBeenCalled();
  });
  it("passes the explicit fixture job to only one checkpoint", async () => {
    vi.stubEnv("VIDEO_FACTORY_FLOW_TEST_JOB_ID", "fixture-job");
    expect((await request("fixture-job")).status).toBe(200);
    expect(processFactoryTick).toHaveBeenCalledExactlyOnceWith("fixture-job");
  });
});
