import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ project: vi.fn(), edit: vi.fn(), assets: vi.fn(), asset: vi.fn() }));
vi.mock("@/lib/video-factory/http", () => ({
  factoryRoute: async (_req: unknown, _admin: boolean, handler: (u: string) => Promise<Response>) => { try { return await handler("u1"); } catch (e) { const err = e as { code?: string; status?: number }; return Response.json({ code: err.code }, { status: err.status ?? 500 }); } },
  boundedJson: async (req: Request) => req.json(),
}));
vi.mock("@/lib/video-factory/service", () => ({ getProject: m.project, editManifest: m.edit }));
vi.mock("@/lib/video-factory/assets", () => ({ storagePath: (k: string) => k }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { videoFactoryAsset: { findMany: m.assets, findFirst: m.asset } } }));
vi.mock("node:fs/promises", () => ({ readFile: async (p: string) => Buffer.from("bytes of " + p) }));
import { GET, POST } from "./route";

const shot = (id: string, prompt: string, assetId?: string) => ({ id, title: id, narration: "", visualPrompt: prompt, motion: "PUSH_IN", notes: "", revision: 0, sfxPrompt: "", ...(assetId ? { assetId } : {}) });
const manifest = { characters: [], chapters: [{ title: "A", continuity: "", shots: [shot("a1", "Store at night"), shot("a2", "Boardroom", "up-2")] }] };
const configuration = { durationSeconds: 60, language: "en", ratio: "16:9", mode: "AUTOPILOT", quality: "SMART", budgetCap: 1000, styleBible: "Stickman" };
const params = { params: Promise.resolve({ id: "p1" }) };
const get = (q = "") => GET(new NextRequest("http://localhost/api/video-factory/projects/p1/media" + q), params);

beforeEach(() => {
  vi.clearAllMocks();
  m.project.mockResolvedValue({ id: "p1", version: 3, manifest: JSON.stringify(manifest), configuration: JSON.stringify(configuration) });
  m.assets.mockResolvedValue([{ id: "gen-1", shotId: "a1", mimeType: "image/png", createdAt: new Date() }, { id: "up-2", shotId: null, mimeType: "image/jpeg", createdAt: new Date() }]);
  m.asset.mockImplementation(async ({ where }: { where: { id: string } }) => ({ storageKey: where.id, mimeType: where.id === "up-2" ? "image/jpeg" : "image/png" }));
});

describe("video factory media library route", () => {
  it("lists every shot with its prompt and image, preferring the chosen image", async () => {
    const body = await (await get()).json();
    expect(body.shots.map((s: { code: string }) => s.code)).toEqual(["SHOT_001", "SHOT_002"]);
    expect(body.shots[0].image).toMatchObject({ id: "gen-1", source: "generated" });
    expect(body.shots[1].image).toMatchObject({ id: "up-2", source: "chosen" });
    expect(m.assets.mock.calls[0][0].where.userId).toBe("u1");
  });

  it("downloads the prompt list for bulk tools", async () => {
    const res = await get("?format=prompts");
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(await res.text()).toContain("[SHOT 2]\nBoardroom\nStyle: Stickman");
  });

  it("downloads every image as SHOT_###.ext in one ZIP", async () => {
    const res = await get("?format=zip");
    expect(res.headers.get("content-type")).toBe("application/zip");
    const zip = Buffer.from(await res.arrayBuffer());
    expect(zip.toString("latin1")).toContain("SHOT_001.png");
    expect(zip.toString("latin1")).toContain("SHOT_002.jpg");
    expect(zip.toString("latin1")).toContain("prompts.txt");
  });

  it("attaches dropped images to their shots through the guarded manifest edit", async () => {
    m.edit.mockResolvedValue({ version: 4 });
    const res = await POST(new NextRequest("http://localhost/api/video-factory/projects/p1/media", { method: "POST", body: JSON.stringify({ action: "attach", expectedVersion: 3, items: [{ shotId: "a1", assetId: "up-9" }] }) }), params);
    expect(res.status).toBe(200);
    const [, , version, next] = m.edit.mock.calls[0];
    expect(version).toBe(3);
    expect(next.chapters[0].shots[0].assetId).toBe("up-9");
  });

  it("refuses an unknown shot", async () => {
    const res = await POST(new NextRequest("http://localhost/api/video-factory/projects/p1/media", { method: "POST", body: JSON.stringify({ action: "regenerate", expectedVersion: 3, shotIds: ["zz"] }) }), params);
    expect(res.status).toBe(404);
    expect(m.edit).not.toHaveBeenCalled();
  });
});
