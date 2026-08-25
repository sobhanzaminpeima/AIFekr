"use client";

import { useState, useRef } from "react";
import { Upload, X, Loader2, Sparkles, Download, User, Check } from "lucide-react";
import toast from "react-hot-toast";
import { tri, type Lang } from "@/lib/i18n";
import { SAMPLE_CHARACTERS, CHARACTER_SHEET_PROMPT } from "@/lib/ai/characterSheetPrompts";

/**
 * Character Creation — a submenu of Image Generation. Builds a multi-view
 * "character sheet" reference image from either an uploaded photo or one
 * of 8 sample AI-generated reference people, reusing the existing
 * /api/image/generate endpoint (image-to-image via sourceImageUrl) rather
 * than adding new image-gen plumbing. Two-step for the sample-character
 * path: generate a single portrait first (step 1), then feed that as the
 * reference for the character sheet itself (step 2) — the same two calls
 * a user would make manually.
 */

type Source = { kind: "upload"; url: string } | { kind: "sample"; id: string; url: string } | null;

export default function CharacterCreationPanel({ lang, imageProvider }: { lang: Lang; imageProvider: string }) {
  const [source, setSource] = useState<Source>(null);
  const [uploading, setUploading] = useState(false);
  const [generatingPortrait, setGeneratingPortrait] = useState<string | null>(null);
  const [generatingSheet, setGeneratingSheet] = useState(false);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setSheetUrl(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSource({ kind: "upload", url: data.url });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tri(lang, "خطا در آپلود عکس", "Photo upload failed", "Foto-Upload fehlgeschlagen"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function pickSample(sampleId: string) {
    setSheetUrl(null);
    setSource(null);
    setGeneratingPortrait(sampleId);
    try {
      const sample = SAMPLE_CHARACTERS.find((s) => s.id === sampleId)!;
      const res = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: sample.portraitPrompt, style: "realistic", ratio: "1:1", quality: "standard", count: 1, provider: imageProvider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const url = data.images?.[0]?.url;
      if (!url) throw new Error(tri(lang, "خطا در تولید تصویر مرجع", "Reference image generation failed", "Referenzbild-Generierung fehlgeschlagen"));
      setSource({ kind: "sample", id: sampleId, url });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tri(lang, "خطا در تولید تصویر مرجع", "Reference image generation failed", "Referenzbild-Generierung fehlgeschlagen"));
    } finally {
      setGeneratingPortrait(null);
    }
  }

  async function generateSheet() {
    if (!source) return;
    setGeneratingSheet(true);
    setSheetUrl(null);
    try {
      const res = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: CHARACTER_SHEET_PROMPT, style: "realistic", ratio: "16:9", quality: "hd", count: 1, sourceImageUrl: source.url, provider: imageProvider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const url = data.images?.[0]?.url;
      if (!url) throw new Error(tri(lang, "خطا در تولید کاراکترشیت", "Character sheet generation failed", "Charakterblatt-Generierung fehlgeschlagen"));
      setSheetUrl(url);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tri(lang, "خطا در تولید کاراکترشیت", "Character sheet generation failed", "Charakterblatt-Generierung fehlgeschlagen"));
    } finally {
      setGeneratingSheet(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-4 text-xs" style={{ background: "rgba(234,88,12,0.08)", border: "1px solid rgba(234,88,12,0.3)", color: "var(--text-secondary)" }}>
        {tri(
          lang,
          "یک عکس آپلود کنید یا یکی از کاراکترهای نمونه را انتخاب کنید — یک تصویر «کاراکترشیت» با چند زاویه صورت/بدن و لیبل‌های فارسی برایتان می‌سازیم که برای تولید ویدیو/تصویر با هوش مصنوعی، همان شخص را در همه‌جا حفظ می‌کند.",
          "Upload a photo or pick a sample character — we'll build a multi-angle \"character sheet\" reference image with Persian panel labels, so the same person stays consistent across every AI-generated video or image you make afterward.",
          "Laden Sie ein Foto hoch oder wählen Sie einen Beispielcharakter — wir erstellen ein mehransichtiges „Charakterblatt“ mit persischen Beschriftungen, damit dieselbe Person in jedem später erzeugten KI-Video oder -Bild konsistent bleibt."
        )}
      </div>

      {/* Step 1: choose a source */}
      <div className="p-5 rounded-2xl space-y-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {tri(lang, "۱. یک منبع انتخاب کنید", "1. Choose a source", "1. Quelle auswählen")}
        </p>

        <div>
          <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
            {tri(lang, "عکس خودتان را آپلود کنید", "Upload your own photo", "Eigenes Foto hochladen")}
          </p>
          {source?.kind === "upload" ? (
            <div className="relative w-32">
              <img src={source.url} alt="reference" className="w-32 h-32 object-cover rounded-xl" />
              <button onClick={() => { setSource(null); setSheetUrl(null); }} className="absolute top-1.5 left-1.5 p-1 rounded-lg bg-black/60 text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--surface-2)", border: "1px dashed var(--border)", color: "var(--text-secondary)" }}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {tri(lang, "انتخاب عکس", "Choose photo", "Foto auswählen")}
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        </div>

        <div>
          <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
            {tri(lang, "یا یکی از کاراکترهای نمونه را انتخاب کنید", "Or pick a sample character", "Oder einen Beispielcharakter wählen")}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {SAMPLE_CHARACTERS.map((sample) => {
              const isSelected = source?.kind === "sample" && source.id === sample.id;
              const isGenerating = generatingPortrait === sample.id;
              return (
                <button
                  key={sample.id}
                  onClick={() => pickSample(sample.id)}
                  disabled={generatingPortrait !== null}
                  className="relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl text-center transition-all disabled:opacity-50"
                  style={{ background: isSelected ? "rgba(234,88,12,0.1)" : "var(--surface-2)", border: `1px solid ${isSelected ? "var(--primary)" : "var(--border)"}` }}
                >
                  {isSelected && source?.kind === "sample" ? (
                    <img src={source.url} alt={sample.labelEn} className="w-full aspect-square object-cover rounded-lg" />
                  ) : (
                    <div className="w-full aspect-square rounded-lg flex items-center justify-center" style={{ background: "var(--surface-1)" }}>
                      {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--primary)" }} /> : <User className="w-6 h-6" style={{ color: "var(--text-muted)" }} />}
                    </div>
                  )}
                  <span className="text-[10px] leading-tight" style={{ color: "var(--text-secondary)" }}>
                    {tri(lang, sample.labelFa, sample.labelEn, sample.labelDe)}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 absolute top-1.5 right-1.5" style={{ color: "var(--primary)" }} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step 2: generate */}
      <div className="p-5 rounded-2xl space-y-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {tri(lang, "۲. کاراکترشیت را بسازید", "2. Build the character sheet", "2. Charakterblatt erstellen")}
        </p>
        <button
          onClick={generateSheet}
          disabled={!source || generatingSheet}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--primary)" }}
        >
          {generatingSheet ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {tri(lang, "ساخت کاراکترشیت", "Generate Character Sheet", "Charakterblatt erstellen")}
        </button>
      </div>

      {sheetUrl && (
        <div className="p-5 rounded-2xl space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <img src={sheetUrl} alt="character sheet" className="w-full rounded-xl" />
          <a
            href={sheetUrl}
            download
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          >
            <Download className="w-4 h-4" />
            {tri(lang, "دانلود کاراکترشیت", "Download Character Sheet", "Charakterblatt herunterladen")}
          </a>
        </div>
      )}
    </div>
  );
}
