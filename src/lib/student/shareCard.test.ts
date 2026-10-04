import { describe, expect, it, vi } from "vitest";
import { shareCardImage } from "./shareCard";
import { studentBrandCopy } from "./brandCard";

describe("student card image sharing", () => {
  const file = new File(["png-test"], "card.png", { type: "image/png" });
  it("shares the PNG file itself through browsers supporting files", async () => {
    const share = vi.fn().mockResolvedValue(undefined), canShare = vi.fn().mockReturnValue(true), download = vi.fn();
    expect(await shareCardImage(file, studentBrandCopy("fa").statement, { share, canShare }, download)).toBe("shared");
    expect(share).toHaveBeenCalledWith({ files: [file], title: "AIFekr AI University", text: "من دانشجوی دانشگاه هوش مصنوعی AIFekr هستم" });
    expect(download).not.toHaveBeenCalled();
  });
  it("downloads the image when file sharing is unavailable", async () => {
    const share=vi.fn(),download=vi.fn();
    expect(await shareCardImage(file,"caption",{share,canShare:()=>false},download)).toBe("downloaded");
    expect(download).toHaveBeenCalledOnce();expect(share).not.toHaveBeenCalled();
  });
  it("does not download or report success when the user cancels sharing", async () => {
    const download=vi.fn();const error=new DOMException("cancelled","AbortError");
    await expect(shareCardImage(file,"caption",{share:vi.fn().mockRejectedValue(error),canShare:()=>true},download)).rejects.toBe(error);
    expect(download).not.toHaveBeenCalled();
  });
  it("has distinct branding and captions for all four languages", () => {
    const copies=(["fa","en","de","tr"] as const).map(studentBrandCopy);
    expect(new Set(copies.map(c=>c.statement)).size).toBe(4);
    for(const copy of copies){expect(copy.statement).toContain("AIFekr");expect(copy.motto.length).toBeGreaterThan(10);}
  });
});
