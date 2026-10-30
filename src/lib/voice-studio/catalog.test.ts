import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ row: null as { value: string } | null, upsert: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { siteSetting: { findUnique: async () => db.row, upsert: db.upsert } } }));
vi.mock("./config", () => ({ voiceCredentials: async () => ({ base: "https://api.elevenlabs.io/v1", key: "test-secret" }) }));

const stored = (ageHours: number) => ({ value: JSON.stringify({ models: [{ id: "old" }], voices: [{ id: "old" }], fetchedAt: new Date(Date.now() - ageHours * 3600000).toISOString() }) });
const provider = (ok: boolean) => vi.fn(async (url: string) => {
  if (!ok) return new Response("", { status: 503 });
  if (url.includes("/models")) return Response.json([{ model_id: "eleven_v3", name: "v3", can_do_text_to_speech: true, languages: [{ language_id: "fa", name: "Persian" }], maximum_text_length_per_request: 5000 }]);
  if (url.includes("/voices")) return Response.json({ voices: [{ voice_id: "v1", name: "Ava", category: "premade", labels: {} }] });
  return Response.json({ character_limit: 10, character_count: 0 });
});

describe("voice catalog", () => {
  beforeEach(() => { vi.resetModules(); vi.unstubAllGlobals(); db.upsert.mockReset(); });

  it("serves a fresh catalog without calling the provider", async () => {
    db.row = stored(2);
    const fetch = provider(true); vi.stubGlobal("fetch", fetch);
    const { speechCatalog } = await import("./provider");
    expect((await speechCatalog()).models[0].id).toBe("old");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("renews a day-old catalog with the stored key instead of blocking every account", async () => {
    db.row = stored(30);
    vi.stubGlobal("fetch", provider(true));
    const { speechCatalog } = await import("./provider");
    const catalog = await speechCatalog();
    expect(catalog.models.map((m) => m.id)).toEqual(["eleven_v3"]);
    expect(catalog.voices.map((v) => v.id)).toEqual(["v1"]);
    expect(db.upsert).toHaveBeenCalledTimes(1);
  });

  it("reports CATALOG_EXPIRED when renewal fails, and waits before retrying", async () => {
    db.row = stored(30);
    const fetch = provider(false); vi.stubGlobal("fetch", fetch);
    const { speechCatalog } = await import("./provider");
    await expect(speechCatalog()).rejects.toMatchObject({ code: "CATALOG_EXPIRED" });
    const calls = fetch.mock.calls.length;
    await expect(speechCatalog()).rejects.toMatchObject({ code: "CATALOG_EXPIRED" });
    expect(fetch.mock.calls.length).toBe(calls);
  });

  it("the worker renews ahead of expiry and never throws", async () => {
    db.row = stored(21);
    vi.stubGlobal("fetch", provider(false));
    const { keepCatalogFresh } = await import("./provider");
    await expect(keepCatalogFresh()).resolves.toBeUndefined();
    vi.stubGlobal("fetch", provider(true));
    vi.resetModules();
    const fresh = await import("./provider");
    await fresh.keepCatalogFresh();
    expect(db.upsert).toHaveBeenCalledTimes(1);
  });
});
