"use client";
import { useState } from "react";
import { useTranslation, tri } from "@/lib/i18n";
export default function ShareResult({
  game,
  score,
  name,
}: {
  game: string;
  score: number;
  name?: string;
}) {
  const { lang } = useTranslation(),
    [busy, setBusy] = useState(false);
  async function share() {
    setBusy(true);
    try {
      const c = document.createElement("canvas");
      c.width = 1080;
      c.height = 1080;
      const x = c.getContext("2d");
      if (!x) return;
      const bg = x.createLinearGradient(0, 0, 1080, 1080);
      bg.addColorStop(0, "#0b0d10");
      bg.addColorStop(1, "#48230e");
      x.fillStyle = bg;
      x.fillRect(0, 0, 1080, 1080);
      x.fillStyle = "#ff6b00";
      x.fillRect(70, 70, 940, 8);
      x.textAlign = "center";
      x.font = "bold 58px sans-serif";
      x.fillText("AIFekr PLAY", 540, 200);
      x.fillStyle = "#fff";
      x.font = "40px sans-serif";
      x.fillText(game, 540, 330);
      x.font = "bold 170px sans-serif";
      x.fillText(score.toLocaleString(lang), 540, 560);
      x.font = "32px sans-serif";
      x.fillText(
        tri(
          lang,
          "امتیاز تأییدشده",
          "Verified score",
          "Geprüfter Punktestand",
          "Doğrulanmış puan",
        ),
        540,
        650,
      );
      if (name) {
        x.font = "36px sans-serif";
        x.fillText(name.slice(0, 35), 540, 760);
      }
      x.fillStyle = "#ff9b54";
      x.font = "32px sans-serif";
      x.fillText("aifekr.com/play", 540, 930);
      const blob = await new Promise<Blob | null>((resolve) =>
        c.toBlob(resolve, "image/png"),
      );
      if (!blob) return;
      const file = new File([blob], "aifekr-play.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "AIFekr PLAY" });
      } else {
        const url = URL.createObjectURL(blob),
          a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch {
      /* A cancelled system share sheet is not a game failure. */
    } finally {
      setBusy(false);
    }
  }
  return (
    <button disabled={busy} onClick={() => void share()}>
      {tri(
        lang,
        "اشتراک کارت نتیجه",
        "Share result card",
        "Ergebniskarte teilen",
        "Sonuç kartını paylaş",
      )}
    </button>
  );
}
