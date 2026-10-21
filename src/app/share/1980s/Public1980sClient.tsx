"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Upload, X, Loader2, Download, Sparkles, Camera } from "lucide-react";
import { tri } from "@/lib/i18n/tri";
import type { Lang } from "@/lib/i18n/server";
import { downscaleImage } from "@/lib/image/downscaleImage";

interface PromptItem {
  id: string;
  title: string;
  titleEn: string | null;
  titleDe?: string | null;
  guideFa: string | null;
  guideEn: string | null;
  guideDe?: string | null;
  thumbnailUrl: string | null;
}

export default function Public1980sClient({ lang }: { lang: Lang }) {
  const isFa = lang === "fa";
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/prompts?toolType=image")
      .then((r) => r.json())
      .then((d) => setPrompts((d.prompts || []).filter((p: { category?: string }) => p.category === "1980s")))
      .catch(() => {});
  }, []);

  const selected = prompts.find((p) => p.id === selectedId) || null;
  // Never fall back to the Persian guide for a non-Persian visitor -- a
  // prompt with only guideFa set used to silently show Persian text on the
  // English/German version of this page. A generic line in the visitor's
  // own language is better than a guide in the wrong language.
  const guide = selected
    ? isFa
      ? selected.guideFa
      : (lang === "de" && selected.guideDe) || selected.guideEn || tri(lang, "", "Upload a clear photo to get started.", "Laden Sie ein klares Foto hoch, um zu beginnen.")
    : null;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (images.length >= 2) return;
    setUploading(true);
    setError(null);
    try {
      const compressed = await downscaleImage(file);
      const form = new FormData();
      form.append("file", compressed);
      const res = await fetch("/api/public/upload-1980s", { method: "POST", body: form });
      const data = await res.json();
      if (res.status === 402 && data.limitReached) { setLimitReached(true); return; }
      if (!res.ok) throw new Error(data.error);
      setImages((prev) => [...prev, data.url]);
    } catch (err) {
      setError(err instanceof Error ? err.message : tri(lang, "خطا در آپلود", "Upload failed", "Upload fehlgeschlagen"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function generate() {
    if (!selected || images.length === 0) return;
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/public/generate-1980s", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptId: selected.id, sourceImageUrls: images }),
      });
      const data = await res.json();
      if (res.status === 402 && data.limitReached) { setLimitReached(true); return; }
      if (!res.ok) throw new Error(data.error);
      setResult(data.images?.[0] || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : tri(lang, "خطا در تولید تصویر", "Image generation failed", "Bilderzeugung fehlgeschlagen"));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div dir={isFa ? "rtl" : "ltr"} className="min-h-screen px-4 py-10" style={{ background: "#0a0a0f", color: "#f5f5f5" }}>
      <div className="max-w-xl mx-auto space-y-6">
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium" style={{ background: "rgba(234,88,12,0.15)", color: "#fb923c" }}>
            <Sparkles className="w-3.5 h-3.5" />
            AiFekr
          </div>
          <h1 className="text-2xl font-bold">{tri(lang, "عکس‌های دهه ۸۰", "1980s Photos", "1980er-Fotos")}</h1>
          <p className="text-sm" style={{ color: "#a1a1aa" }}>
            {tri(lang, "عکس خودتان را آپلود کنید و آن را به سبک دهه ۸۰ تبدیل کنید — یک بار رایگان است.", "Upload your photo and turn it into a 1980s-style portrait — your first one is free.", "Laden Sie Ihr Foto hoch und verwandeln Sie es in ein Foto im 1980er-Stil — das erste ist kostenlos.")}
          </p>
        </div>

        {limitReached ? (
          <div className="rounded-2xl p-6 text-center space-y-3" style={{ background: "#141419", border: "1px solid rgba(234,88,12,0.3)" }}>
            <p className="text-sm font-medium">
              {tri(lang, "تعداد رایگان شما تمام شد", "You've used your free generations", "Sie haben Ihre kostenlosen Generierungen aufgebraucht")}
            </p>
            <p className="text-xs" style={{ color: "#a1a1aa" }}>
              {tri(lang, "برای ادامه، به AiFekr بپیوندید و از همه‌ی امکانات استفاده کنید.", "Join AiFekr to keep going and unlock everything else.", "Treten Sie AiFekr bei, um weiterzumachen und alles andere freizuschalten.")}
            </p>
            <Link href="/plans" className="inline-block px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: "#ea580c" }}>
              {tri(lang, "مشاهده‌ی پلن‌ها", "View plans", "Pläne ansehen")}
            </Link>
          </div>
        ) : (
          <>
            {/* Prompt picker */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {prompts.map((p) => {
                const title = (lang === "de" && p.titleDe) || (!isFa && p.titleEn) || p.title;
                return (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedId(p.id); setResult(null); }}
                    className="relative rounded-xl overflow-hidden aspect-square"
                    style={{ border: `2px solid ${selectedId === p.id ? "#ea580c" : "rgba(255,255,255,0.08)"}` }}
                  >
                    {p.thumbnailUrl ? (
                      <img src={p.thumbnailUrl} alt={title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ background: "#1a1a1f" }}>
                        <Camera className="w-6 h-6 opacity-40" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 px-1.5 py-1 text-[10px] font-medium text-white truncate" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.85))" }}>
                      {title}
                    </div>
                  </button>
                );
              })}
            </div>

            {selected && (
              <>
                {guide && (
                  <div className="rounded-xl px-3.5 py-3" style={{ background: "rgba(234,88,12,0.08)", border: "1px solid rgba(234,88,12,0.2)" }}>
                    <p className="text-[11px] font-semibold mb-1" style={{ color: "#fb923c" }}>{tri(lang, "راهنما", "Guide", "Anleitung")}</p>
                    <p className="text-xs leading-5" style={{ color: "#d4d4d8" }}>{guide}</p>
                  </div>
                )}

                {/* Upload */}
                <div className="rounded-2xl p-4" style={{ background: "#141419", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    {images.map((url, i) => (
                      <div key={i} className="relative">
                        <img src={url} alt="" className="w-14 h-14 object-cover rounded-lg" />
                        <button onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))} className="absolute -top-1.5 -left-1.5 p-0.5 rounded-full bg-black/70">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {images.length < 2 && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="w-14 h-14 rounded-lg flex items-center justify-center disabled:opacity-50"
                        style={{ background: "#1a1a1f", border: "1px dashed rgba(255,255,255,0.2)" }}
                      >
                        {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" style={{ color: "#a1a1aa" }} />}
                      </button>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUpload} className="hidden" />
                  <p className="text-[11px]" style={{ color: "#71717a" }}>
                    {tri(lang, "برای پرامپت‌های دونفره، ۲ عکس آپلود کنید", "For two-person prompts, upload 2 photos", "Für Zwei-Personen-Prompts 2 Fotos hochladen")}
                  </p>

                  <button
                    onClick={generate}
                    disabled={generating || images.length === 0}
                    className="w-full mt-3 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{ background: "#ea580c" }}
                  >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {generating ? tri(lang, "در حال ساخت...", "Generating...", "Wird erstellt...") : tri(lang, "ساخت عکس", "Generate photo", "Foto erstellen")}
                  </button>
                </div>
              </>
            )}

            {error && <p className="text-sm text-center" style={{ color: "#ef4444" }}>{error}</p>}

            {result && (
              <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                <img src={result} alt="result" className="w-full" />
                <a href={result} download target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 py-3 text-sm font-medium" style={{ background: "#141419", color: "#d4d4d8" }}>
                  <Download className="w-4 h-4" />
                  {tri(lang, "دانلود", "Download", "Herunterladen")}
                </a>
              </div>
            )}
          </>
        )}

        <p className="text-center text-xs pt-4" style={{ color: "#52525b" }}>
          <Link href="/" className="underline">AiFekr.com</Link>
        </p>
      </div>
    </div>
  );
}
