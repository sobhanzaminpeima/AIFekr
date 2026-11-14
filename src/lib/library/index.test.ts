import { describe, expect, it } from "vitest";
import { libraryIndex } from "./index";

const d = (day: number) => new Date(`2026-11-${String(day).padStart(2, "0")}T10:00:00Z`);

describe("creation library index", () => {
  const list = libraryIndex({
    images: [{ id: "i1", prompt: "  a cup\n of coffee ", createdAt: d(3) }],
    videos: [],
    music: [{ id: "m1", prompt: "calm", createdAt: d(1) }],
    voice: [{ id: "v1", text: "سلام", createdAt: d(5) }],
    seo: [{ id: "s1", tool: "content", keyword: null, url: "https://x.com", createdAt: d(4) }],
    websites: [{ id: "w1", businessName: "Cafe", createdAt: d(2) }],
  });
  it("lists every module's creations newest first, each with where it opens", () => {
    expect(list.map((i) => i.id)).toEqual(["v1", "s1", "i1", "w1", "m1"]);
    expect(list.find((i) => i.id === "s1")).toMatchObject({ kind: "seo", title: "https://x.com", openAt: "/seo?tab=posts" });
    expect(list.find((i) => i.id === "i1")!.title).toBe("a cup of coffee");
  });
  it("caps the list", () => {
    const many = Array.from({ length: 80 }, (_, k) => ({ id: "i" + k, prompt: "p", createdAt: d(1 + (k % 9)) }));
    expect(libraryIndex({ images: many, videos: [], music: [], voice: [], seo: [], websites: [] }, 60)).toHaveLength(60);
  });
});
