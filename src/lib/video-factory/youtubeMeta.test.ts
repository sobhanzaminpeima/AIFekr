import { describe, expect, it } from "vitest";
import { youtubeMetadata } from "./youtubeMeta";

describe("YouTube upload text", () => {
  it("builds title, description with chapters, hashtags and tags", () => {
    const text = youtubeMetadata({ title: "The first railway", brief: "How the first railway was built. It changed travel forever. More details follow here.", language: "en", chapters: ["0:00 Start", "1:10 Building", "2:40 Opening"], keywords: "history, railway, trains", genre: "documentary", channelName: "Rail Stories" });
    expect(text).toContain("TITLE:\nThe first railway");
    expect(text).toContain("Chapters:\n0:00 Start\n1:10 Building\n2:40 Opening");
    expect(text).toContain("#history #railway #trains");
    expect(text).toContain("TAGS:\nhistory, railway, trains, documentary");
    expect(text).toContain("Rail Stories");
  });
  it("leaves out chapters YouTube would ignore and uses Persian labels", () => {
    const text = youtubeMetadata({ title: "x".repeat(150), brief: "یک ویدیو دربارهٔ تاریخ.", language: "fa", chapters: ["0:00 شروع"] });
    expect(text).not.toContain("فصل‌ها");
    expect(text).toContain("عنوان:\n" + "x".repeat(100) + "\n");
  });
});
