import { describe, expect, it } from "vitest";
import { includedIn } from "./planAccess";

const limits = { STUDENT_QUARTERLY: { monthlyVideos: 0, monthlyMusics: 0 }, PRO: { monthlyVideos: 5, monthlyMusics: 10 }, TEAM: { monthlyVideos: -1, monthlyMusics: 0 } };
const pkg = (planCode: string) => ({ planCode, name: planCode + " fa", nameEn: planCode + " en" });

describe("packages that unlock a media tool", () => {
  it("names the published packages whose plan includes the tool", () => {
    const r = includedIn(limits, [pkg("STUDENT_QUARTERLY"), pkg("PRO"), pkg("TEAM")]);
    expect(r.music.map((p) => p.nameEn)).toEqual(["PRO en"]);
    expect(r.video.map((p) => p.nameEn)).toEqual(["PRO en", "TEAM en"]);
  });
  it("skips packages whose plan has no known limits", () => {
    expect(includedIn(limits, [pkg("UNKNOWN")])).toEqual({ video: [], music: [] });
  });
});
