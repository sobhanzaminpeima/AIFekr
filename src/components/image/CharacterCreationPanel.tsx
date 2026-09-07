"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Upload, X, Loader2, Sparkles, Download, User, Check, Images, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { tri, type Lang } from "@/lib/i18n";
import { SAMPLE_CHARACTERS } from "@/lib/ai/characterSheetPrompts";

/**
 * Character Creation — a submenu of Image Generation. Step 1 (choose a
 * source: upload or one of 8 sample reference people) is unchanged. Step 2
 * used to fire a single fixed prompt with no user input beyond the photo;
 * it's now a real character brief (name/title/personality/wardrobe/colors/
 * quote, per the Character Creator spec) sent to /api/image/character-board,
 * which does the actual face-lock generation (three focused reference-image
 * calls composited into one board — see characterBoard.ts for why three
 * calls beat one mega-prompt for a multi-panel board) rather than the old
 * single generic sheet.
 */

type Source = { kind: "upload"; url: string } | { kind: "sample"; id: string; url: string } | null;
interface SavedSheet { id: string; url: string; createdAt: string; }

type Genre = "cinematic_drama" | "luxury_editorial" | "sci_fi" | "fantasy" | "business_corporate" | "streetwear_urban" | "minimal_tech";
const GENRES: { value: Genre; fa: string; en: string; de: string }[] = [
  { value: "cinematic_drama", fa: "درام سینمایی", en: "Cinematic Drama", de: "Kinodrama" },
  { value: "luxury_editorial", fa: "ادیتوریال لوکس", en: "Luxury Editorial", de: "Luxus-Editorial" },
  { value: "sci_fi", fa: "علمی‌تخیلی", en: "Sci-Fi", de: "Science-Fiction" },
  { value: "fantasy", fa: "فانتزی", en: "Fantasy", de: "Fantasy" },
  { value: "business_corporate", fa: "کسب‌وکار / شرکتی", en: "Business / Corporate", de: "Business / Unternehmen" },
  { value: "streetwear_urban", fa: "خیابانی / شهری", en: "Streetwear / Urban", de: "Streetwear / Urban" },
  { value: "minimal_tech", fa: "تک مینیمال", en: "Minimal Tech", de: "Minimal Tech" },
];

export default function CharacterCreationPanel({ lang, imageProvider }: { lang: Lang; imageProvider: string }) {
  const [source, setSource] = useState<Source>(null);
  const [uploading, setUploading] = useState(false);
  const [generatingPortrait, setGeneratingPortrait] = useState<string | null>(null);
  const [generatingSheet, setGeneratingSheet] = useState(false);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [savedSheets, setSavedSheets] = useState<SavedSheet[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);

  // Character brief — everything the user fills in for THEIR OWN character.
  // Only name is required; every other field is optional and simply omitted
  // from the generation prompt when blank (see characterBoard.ts's `clause`
  // helper) rather than sent as an empty/placeholder value.
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("");
  const [genre, setGenre] = useState<Genre>("cinematic_drama");
  const [personality, setPersonality] = useState("");
  const [wardrobe, setWardrobe] = useState("");
  const [age, setAge] = useState("");
  const [quote, setQuote] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [secondaryColor, setSecondaryColor] = useState("");
  const [accentColor, setAccentColor] = useState("");
  const [useCustomColors, setUseCustomColors] = useState(false);

  const loadSavedSheets = useCallback(() => {
    fetch("/api/image/gallery?kind=character_sheet", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setSavedSheets(d.images || []))
      .catch(() => {})
      .finally(() => setLoadingSaved(false));
  }, []);

  useEffect(() => { loadSavedSheets(); }, [loadSavedSheets]);

  async function deleteSheet(id: string) {
    setSavedSheets((prev) => prev.filter((s) => s.id !== id));
    await fetch("/api/image/gallery", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => {});
  }

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
    if (!name.trim()) {
      toast.error(tri(lang, "نام کاراکتر را وارد کنید", "Enter the character's name", "Geben Sie den Namen der Figur ein"));
      return;
    }
    setGeneratingSheet(true);
    setSheetUrl(null);
    try {
      const res = await fetch("/api/image/character-board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceImageUrl: source.url,
          name: name.trim(),
          title: title.trim() || undefined,
          role: role.trim() || undefined,
          genre,
          personality: personality.trim() || undefined,
          wardrobe: wardrobe.trim() || undefined,
          age: age.trim() || undefined,
          quote: quote.trim() || undefined,
          primaryColor: useCustomColors ? primaryColor : undefined,
          secondaryColor: useCustomColors ? secondaryColor : undefined,
          accentColor: useCustomColors ? accentColor : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const url = data.image?.url;
      if (!url) throw new Error(tri(lang, "خطا در تولید کاراکترشیت", "Character sheet generation failed", "Charakterblatt-Generierung fehlgeschlagen"));
      setSheetUrl(url);
      loadSavedSheets();
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
          "یک عکس آپلود کنید یا یکی از کاراکترهای نمونه را انتخاب کنید، مشخصات کاراکترتان را بنویسید و یک «بورد طراحی کاراکتر» سینمایی با چند پنل (چرخش کامل، پرتره، حالت‌های چهره، لباس و لوازم) با همان چهره برایتان می‌سازیم.",
          "Upload a photo or pick a sample character, fill in your character's brief, and we'll build a cinematic multi-panel \"Character Design Board\" (turnaround, portraits, expressions, wardrobe/materials) — with that same face throughout.",
          "Laden Sie ein Foto hoch oder wählen Sie einen Beispielcharakter, füllen Sie das Kurzprofil Ihrer Figur aus, und wir erstellen ein filmisches mehrteiliges „Charakter-Design-Board“ (Rundumansicht, Porträts, Mimik, Kleidung/Materialien) — durchgehend mit demselben Gesicht."
        )}
      </div>

      {/* Content-policy notice — required near the upload step, not optional polish. */}
      <div className="rounded-xl p-3 text-xs flex items-start gap-2" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          {tri(lang,
            "فقط عکس خودتان یا عکسی را آپلود کنید که اجازهٔ استفاده از آن را دارید.",
            "Only upload your own photo, or a photo you have permission to use.",
            "Laden Sie nur Ihr eigenes Foto hoch oder ein Foto, für das Sie die Nutzungsberechtigung haben.")}
        </span>
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

      {/* Step 2: the character brief — only name is required; every other
          field is simply omitted from the prompt when left blank. */}
      <div className="p-5 rounded-2xl space-y-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {tri(lang, "۲. مشخصات کاراکتر", "2. Character brief", "2. Kurzprofil der Figur")}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>{tri(lang, "نام (الزامی)", "Name (required)", "Name (erforderlich)")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tri(lang, "مثلاً آوا", "e.g. Ava", "z. B. Ava")}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>{tri(lang, "عنوان/تگ‌لاین (اختیاری)", "Title/tagline (optional)", "Titel/Tagline (optional)")}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tri(lang, "مثلاً «قهرمان داستان»", "e.g. \"The Protagonist\"", "z. B. „Die Hauptfigur“")}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>{tri(lang, "نقش (اختیاری)", "Role (optional)", "Rolle (optional)")}</label>
            <input value={role} onChange={(e) => setRole(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>{tri(lang, "سبک تولید", "Production style", "Produktionsstil")}</label>
            <select value={genre} onChange={(e) => setGenre(e.target.value as Genre)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
              {GENRES.map((g) => <option key={g.value} value={g.value}>{tri(lang, g.fa, g.en, g.de)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>{tri(lang, "شخصیت (اختیاری، ۳-۶ کلمه)", "Personality (optional, 3-6 words)", "Persönlichkeit (optional, 3-6 Wörter)")}</label>
            <input value={personality} onChange={(e) => setPersonality(e.target.value)} placeholder={tri(lang, "مثلاً آرام، باهوش، مصمم", "e.g. calm, sharp, determined", "z. B. ruhig, scharfsinnig, entschlossen")}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>{tri(lang, "الهام لباس/استایل (اختیاری)", "Wardrobe/style inspiration (optional)", "Kleidung/Stil-Inspiration (optional)")}</label>
            <input value={wardrobe} onChange={(e) => setWardrobe(e.target.value)} placeholder={tri(lang, "مثلاً لباس شب ابریشمی", "e.g. silk evening wear", "z. B. seidene Abendgarderobe")}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>{tri(lang, "سن ظاهری (اختیاری)", "Age appearance (optional)", "Erscheinungsalter (optional)")}</label>
            <input value={age} onChange={(e) => setAge(e.target.value)} placeholder={tri(lang, "مثلاً اواسط دهه‌ی ۳۰", "e.g. mid-30s", "z. B. Mitte 30")}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>{tri(lang, "نقل‌قول شاخص (اختیاری)", "Signature quote (optional)", "Signatur-Zitat (optional)")}</label>
            <input value={quote} onChange={(e) => setQuote(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-xs mb-2" style={{ color: "var(--text-muted)" }}>
            <input type="checkbox" checked={useCustomColors} onChange={(e) => setUseCustomColors(e.target.checked)} />
            {tri(lang, "رنگ‌های سفارشی (وگرنه پالت مناسب سبک به‌صورت خودکار انتخاب می‌شود)", "Custom colors (otherwise a palette matching the style is chosen automatically)", "Eigene Farben (sonst wird automatisch eine zum Stil passende Palette gewählt)")}
          </label>
          {useCustomColors && (
            <div className="flex items-center gap-3">
              {[{ v: primaryColor, set: setPrimaryColor, l: tri(lang, "اصلی", "Primary", "Primär") },
                { v: secondaryColor, set: setSecondaryColor, l: tri(lang, "ثانویه", "Secondary", "Sekundär") },
                { v: accentColor, set: setAccentColor, l: tri(lang, "تأکیدی", "Accent", "Akzent") }].map((c, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <input type="color" value={c.v || "#888888"} onChange={(e) => c.set(e.target.value)} className="w-9 h-9 rounded-lg cursor-pointer" />
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{c.l}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={generateSheet}
          disabled={!source || !name.trim() || generatingSheet}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--primary)" }}
        >
          {generatingSheet ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generatingSheet
            ? tri(lang, "در حال ساخت بورد کاراکتر (کمی طول می‌کشد)...", "Building the character board (this takes a bit)...", "Charakter-Board wird erstellt (dauert etwas)...")
            : tri(lang, "ساخت بورد کاراکتر", "Generate Character Board", "Charakter-Board erstellen")}
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

      {/* Saved character sheets — reuses the same GeneratedImage table as the
          main Image Generator (every /api/image/generate call already saves
          to the user's account), just filtered to kind="character_sheet"
          so it doesn't mix in with unrelated generated images. */}
      <div className="p-5 rounded-2xl space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <Images className="w-4 h-4" style={{ color: "var(--primary)" }} />
          {tri(lang, "کاراکترشیت‌های ذخیره‌شدهٔ من", "My Saved Character Sheets", "Meine gespeicherten Charakterblätter")}
        </p>
        {loadingSaved ? (
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--primary)" }} />
        ) : savedSheets.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {tri(lang, "هنوز کاراکترشیتی ذخیره نشده", "No character sheets saved yet", "Noch keine Charakterblätter gespeichert")}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {savedSheets.map((sheet) => (
              <div key={sheet.id} className="relative group rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <img src={sheet.url} alt="character sheet" className="w-full aspect-video object-cover" />
                <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(0,0,0,0.55)" }}>
                  <a href={sheet.url} download className="p-2 rounded-lg" style={{ background: "var(--surface-1)" }}>
                    <Download className="w-4 h-4" style={{ color: "var(--text-primary)" }} />
                  </a>
                  <button onClick={() => deleteSheet(sheet.id)} className="p-2 rounded-lg" style={{ background: "var(--surface-1)" }}>
                    <X className="w-4 h-4" style={{ color: "#ef4444" }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
