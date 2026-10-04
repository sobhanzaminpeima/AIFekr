export async function shareCardImage(file: File, text: string, browser: Pick<Navigator, "share" | "canShare">, download: () => void): Promise<"shared" | "downloaded"> {
  if (browser.share && browser.canShare?.({ files: [file] })) {
    await browser.share({ files: [file], title: "AIFekr AI University", text });
    return "shared";
  }
  download();
  return "downloaded";
}
