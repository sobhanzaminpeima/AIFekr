"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Loader2, Save, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { tri, type Lang } from "@/lib/i18n";

interface Profile {
  pageType: string | null;
  specialty: string | null;
  audience: string | null;
  tone: string | null;
  contentPillars: string[];
  avoidTopics: string | null;
  positioning: string | null;
  isDraft: boolean;
  businessName: string | null;
  businessIndustry: string | null;
}

/**
 * "Describe your page once" — the thing that was missing. Pre-filled from
 * Business Doctor on first open (isDraft), then every caption, calendar and
 * report is generated against it instead of against an empty form.
 */
export default function BrandProfileCard({ lang, onSaved }: { lang: Lang; onSaved?: (p: Profile) => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pillarsText, setPillarsText] = useState("");

  const load = useCallback(() => {
    fetch("/api/social/brand-profile", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        const p: Profile = d.profile;
        setProfile(p);
        setPillarsText((p.contentPillars || []).join("، "));
        // Nothing saved yet → open it so the owner actually fills it in.
        if (p.isDraft) setOpen(true);
      })
      .catch(() => {});
  }, []);

  useEffect(load, [load]);

  if (!profile) return null;

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setProfile({ ...profile, [k]: v });

  async function save() {
    if (!profile) return;
    setSaving(true);
    try {
      const pillars = pillarsText.split(/[,،\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 5);
      const res = await fetch("/api/social/brand-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...profile, contentPillars: pillars }),
      });
      if (!res.ok) throw new Error();
      toast.success(tri(lang, "ذخیره شد", "Saved", "Gespeichert"));
      const next = { ...profile, contentPillars: pillars, isDraft: false };
      setProfile(next);
      setOpen(false);
      onSaved?.(next);
    } catch {
      toast.error(tri(lang, "ذخیره نشد", "Save failed", "Speichern fehlgeschlagen"));
    } finally {
      setSaving(false);
    }
  }

  const field = (
    label: string,
    key: keyof Profile,
    placeholder: string,
    textarea = false
  ) => (
    <div>
      <label className="text-xs font-semibold block mb-1" style={{ color: "var(--text-secondary)" }}>{label}</label>
      {textarea ? (
        <textarea
          rows={2}
          value={(profile[key] as string) || ""}
          placeholder={placeholder}
          onChange={(e) => set(key, e.target.value as Profile[typeof key])}
          className="w-full rounded-lg px-3 py-2 text-sm"
          style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        />
      ) : (
        <input
          value={(profile[key] as string) || ""}
          placeholder={placeholder}
          onChange={(e) => set(key, e.target.value as Profile[typeof key])}
          className="w-full rounded-lg px-3 py-2 text-sm"
          style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        />
      )}
    </div>
  );

  return (
    <div className="rounded-xl mb-5 overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        <Sparkles className="w-4 h-4" style={{ color: "#ea580c" }} />
        {tri(lang, "برند و موضع پیج", "Brand & page positioning", "Marke & Seitenpositionierung")}
        {profile.isDraft && (
          <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(234,179,8,0.15)", color: "#ca8a04" }}>
            {tri(lang, "تکمیل نشده", "Not set up", "Nicht eingerichtet")}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 ms-auto transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs leading-6" style={{ color: "var(--text-muted)" }}>
            {profile.isDraft
              ? tri(lang,
                  "این فرم از اطلاعات «دکتر کسب‌وکار» شما پیش‌پر شده. یک بار تکمیلش کنید تا همه‌ی کپشن‌ها، تقویم محتوا و گزارش‌ها بر اساس همین بساخته شوند.",
                  "This form is pre-filled from your Business Doctor answers. Complete it once and every caption, calendar and report is generated from it.",
                  "Dieses Formular ist aus Ihren Business-Doctor-Angaben vorausgefüllt. Einmal ausfüllen — danach werden alle Texte, Kalender und Berichte daraus erzeugt.")
              : tri(lang, "این اطلاعات مبنای تولید همه‌ی محتواهای این پیج است.", "Everything generated for this page is based on this.", "Alles für diese Seite Erstellte basiert hierauf.")}
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            {field(tri(lang, "نوع پیج", "Page type", "Seitentyp"), "pageType", tri(lang, "مثلاً کلینیک دندان‌پزشکی", "e.g. dental clinic", "z. B. Zahnklinik"))}
            {field(tri(lang, "تخصص / چه چیزی ارائه می‌دهید", "Specialty / what you offer", "Spezialgebiet / Angebot"), "specialty", tri(lang, "مثلاً ارتودنسی نامرئی", "e.g. invisible braces", "z. B. unsichtbare Zahnspangen"))}
            {field(tri(lang, "مخاطب هدف در اینستاگرام", "Target audience on Instagram", "Zielgruppe auf Instagram"), "audience", tri(lang, "مثلاً خانم‌های ۲۵ تا ۴۰ ساله تهران", "e.g. women 25–40 in the city", "z. B. Frauen 25–40 in der Stadt"))}
            {field(tri(lang, "لحن برند", "Brand tone", "Markentonalität"), "tone", tri(lang, "مثلاً حرفه‌ای و صمیمی", "e.g. professional and warm", "z. B. professionell und warm"))}
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: "var(--text-secondary)" }}>
              {tri(lang, "ستون‌های محتوا (۳ تا ۵ مورد، با ویرگول)", "Content pillars (3–5, comma separated)", "Content-Säulen (3–5, kommagetrennt)")}
            </label>
            <input
              value={pillarsText}
              onChange={(e) => setPillarsText(e.target.value)}
              placeholder={tri(lang, "آموزش، قبل و بعد، معرفی تیم", "education, before & after, meet the team", "Aufklärung, Vorher-Nachher, Team")}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>

          {field(tri(lang, "موضع رقابتی — چه چیزی شما را متفاوت می‌کند", "Competitive positioning — what makes you different", "Positionierung — was Sie unterscheidet"), "positioning", "", true)}
          {field(tri(lang, "هرگز درباره‌ی این‌ها پست نساز", "Never post about", "Niemals posten über"), "avoidTopics", tri(lang, "موضوعات ممنوع", "off-limits topics", "Tabuthemen"), true)}

          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#ea580c,#f97316)" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {tri(lang, "ذخیره", "Save", "Speichern")}
          </button>
        </div>
      )}
    </div>
  );
}
