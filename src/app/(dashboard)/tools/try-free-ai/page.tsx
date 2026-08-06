"use client";

import { useState } from "react";
import Script from "next/script";
import { Loader2, Sparkles, ImageIcon, AlertTriangle } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

// Minimal shape of the global `puter` object injected by https://js.puter.com/v2/.
// Not an official type — Puter doesn't ship one — kept narrow to what's used here.
declare global {
  interface Window {
    puter?: {
      ai: {
        chat: (prompt: string, opts?: { model?: string }) => Promise<string>;
        txt2img: (prompt: string, opts?: { model?: string }) => Promise<HTMLImageElement>;
      };
    };
  }
}

/**
 * Experimental, deliberately isolated from the platform's own paid
 * image/video pipeline (fal.ts / replicate.ts / qwen.ts) and credit system —
 * this loads Puter.js client-side and runs entirely against the *visitor's
 * own* puter.com account under Puter's "User-Pays" model. No AiFekr credits
 * are deducted, no AiFekr backend route is involved, and Puter will prompt
 * the user to sign into puter.com the first time it's used.
 */
export default function TryFreeAiPage() {
  const { lang } = useTranslation();
  const isFa = lang !== "en";

  const [scriptReady, setScriptReady] = useState(false);

  const [textPrompt, setTextPrompt] = useState("");
  const [textResult, setTextResult] = useState("");
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState("");

  const [imagePrompt, setImagePrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState("");

  async function runText() {
    if (!textPrompt.trim() || !window.puter) return;
    setTextLoading(true);
    setTextError("");
    setTextResult("");
    try {
      const response = await window.puter.ai.chat(textPrompt.trim(), { model: "gpt-5.4-nano" });
      setTextResult(response);
    } catch (err) {
      setTextError(err instanceof Error ? err.message : (isFa ? "خطا در ارتباط با Puter" : "Puter request failed"));
    } finally {
      setTextLoading(false);
    }
  }

  async function runImage() {
    if (!imagePrompt.trim() || !window.puter) return;
    setImageLoading(true);
    setImageError("");
    setImageUrl("");
    try {
      const imgEl = await window.puter.ai.txt2img(imagePrompt.trim(), { model: "gpt-image-1-mini" });
      setImageUrl(imgEl.src);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : (isFa ? "خطا در ارتباط با Puter" : "Puter request failed"));
    } finally {
      setImageLoading(false);
    }
  }

  return (
    <div dir={isFa ? "rtl" : "ltr"} className="p-6 max-w-3xl mx-auto space-y-6">
      <Script src="https://js.puter.com/v2/" strategy="afterInteractive" onReady={() => setScriptReady(true)} />

      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: "rgba(234,88,12,0.15)" }}>
          <Sparkles className="w-5 h-5" style={{ color: "var(--primary)" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{isFa ? "امتحان AI رایگان (آزمایشی)" : "Try Free AI (Experimental)"}</h1>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{isFa ? "با حساب Puter.com شخصی خودتان، جدا از اعتبار AiFekr" : "Uses your own puter.com account — separate from AiFekr credits"}</p>
        </div>
      </div>

      <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: "rgba(234,88,12,0.08)", border: "1px solid rgba(234,88,12,0.3)" }}>
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "var(--primary)" }} />
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {isFa
            ? "این ابزار کاملاً آزمایشی است و از سرویس شخص ثالث Puter.js استفاده می‌کند — نه از سیستم اصلی تولید تصویر/ویدیوی AiFekr. اولین بار که دکمه رو بزنید، Puter از شما می‌خواد وارد حساب puter.com خودتون بشید؛ مصرف روی حساب شماست، نه اعتبار AiFekr."
            : "This is a fully experimental tool that uses the third-party Puter.js service — not AiFekr's main image/video pipeline. The first time you use it, Puter will ask you to sign into your own puter.com account; usage is billed to that account, not your AiFekr credits."}
        </p>
      </div>

      {/* Text generation */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{isFa ? "تولید متن" : "Text Generation"}</h2>
        <textarea value={textPrompt} onChange={(e) => setTextPrompt(e.target.value)} rows={3}
          placeholder={isFa ? "سوال یا درخواست خود را بنویسید..." : "Ask anything..."}
          className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        <button onClick={runText} disabled={!scriptReady || textLoading || !textPrompt.trim()}
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
          {textLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {isFa ? "تولید متن" : "Generate Text"}
        </button>
        {textError && <p className="text-xs" style={{ color: "#ef4444" }}>{textError}</p>}
        {textResult && (
          <div className="rounded-xl p-4 whitespace-pre-wrap text-sm leading-7" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>
            {textResult}
          </div>
        )}
      </div>

      {/* Image generation */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{isFa ? "تولید تصویر" : "Image Generation"}</h2>
        <input value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)}
          placeholder={isFa ? "توضیح تصویر مورد نظر..." : "Describe the image..."}
          className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        <button onClick={runImage} disabled={!scriptReady || imageLoading || !imagePrompt.trim()}
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
          {imageLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          {isFa ? "تولید تصویر" : "Generate Image"}
        </button>
        {imageError && <p className="text-xs" style={{ color: "#ef4444" }}>{imageError}</p>}
        {imageUrl && (
          <img src={imageUrl} alt={imagePrompt} className="w-full rounded-xl" style={{ border: "1px solid var(--border)" }} />
        )}
      </div>

      <p className="text-[11px] text-center" style={{ color: "var(--text-muted)" }}>
        {isFa ? "ویدیو در این ابزار آزمایشی موجود نیست — مستندات Puter.js نمونه‌ی کارکردی برای آن ارائه نکرده بود." : "Video isn't included in this experiment — Puter.js's docs didn't provide a working example for it."}
      </p>
    </div>
  );
}
