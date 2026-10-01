"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { BadgeCheck, Copy, Loader2, LockKeyhole, Save, Share2, Upload } from "lucide-react";
import { tri, type Lang } from "@/lib/i18n";

type Profile = { name: string | null; email: string | null; avatar: string | null; studentPublicSlug: string | null; studentProfilePublic: boolean };

export default function StudentProfileCard({ lang }: { lang: Lang }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [slug, setSlug] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const publicUrl = useMemo(() => profile?.studentPublicSlug && typeof window !== "undefined" ? `${window.location.origin}/student/${profile.studentPublicSlug}` : "", [profile?.studentPublicSlug]);

  useEffect(() => {
    fetch("/api/student/profile", { credentials: "include" }).then(async (response) => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not load profile");
      setProfile(data.profile); setSlug(data.profile?.studentPublicSlug || ""); setIsPublic(!!data.profile?.studentProfilePublic);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load profile")).finally(() => setLoading(false));
  }, []);

  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/student/profile", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, isPublic }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not save profile");
      setProfile(data.profile); setSlug(data.profile.studentPublicSlug || ""); setMessage(tri(lang, "پروفایل ذخیره شد", "Profile saved", "Profil gespeichert", "Profil kaydedildi"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save profile"); }
    finally { setBusy(false); }
  }

  async function upload(file?: File) {
    if (!file) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const form = new FormData(); form.set("file", file);
      const response = await fetch("/api/student/profile/avatar", { method: "POST", credentials: "include", body: form });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not upload photo");
      setProfile((current) => current ? { ...current, avatar: data.avatar } : current);
      setMessage(tri(lang, "عکس پروفایل ذخیره شد", "Profile photo saved", "Profilfoto gespeichert", "Profil fotoğrafı kaydedildi"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not upload photo"); }
    finally { setBusy(false); }
  }

  async function shareCard() {
    if (!publicUrl || !isPublic) { setError(tri(lang, "ابتدا کارت را عمومی و ذخیره کن.", "Make your card public and save it first.", "Veröffentliche und speichere zuerst deine Karte.", "Önce kartını herkese açıp kaydet.")); return; }
    const title = tri(lang, "پروفایل دانشجویی AIFekr", "AIFekr student profile", "AIFekr-Studierendenprofil", "AIFekr öğrenci profili");
    const text = tri(lang, `من دانشجوی AIFekr هستم: ${profile?.name || ""}`, `I'm an AIFekr student: ${profile?.name || ""}`, `Ich studiere mit AIFekr: ${profile?.name || ""}`, `AIFekr öğrencisiyim: ${profile?.name || ""}`);
    try {
      if (navigator.share) await navigator.share({ title, text, url: publicUrl });
      else { await navigator.clipboard.writeText(`${text} ${publicUrl}`); setMessage(tri(lang, "متن و لینک کارت کپی شد؛ آن را در اینستاگرام یا شبکهٔ اجتماعی بچسبان.", "Card link copied. Paste it into Instagram or another social app.", "Link kopiert. Füge ihn in Instagram oder ein soziales Netzwerk ein.", "Bağlantı kopyalandı; Instagram veya başka bir sosyal uygulamaya yapıştır.")); }
    } catch (reason) {
      if (reason instanceof Error && reason.name === "AbortError") return;
      setError(tri(lang, "اشتراک‌گذاری انجام نشد؛ لینک را کپی کن.", "Sharing failed. Copy the link instead.", "Teilen fehlgeschlagen. Kopiere den Link.", "Paylaşım başarısız; bağlantıyı kopyala."));
    }
  }

  const cardStyle: React.CSSProperties = { background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 18 };
  if (loading) return <section className="mb-6 rounded-2xl p-6 text-center" style={cardStyle}><Loader2 className="inline animate-spin" /></section>;

  return <section className="mb-6 rounded-2xl p-5 md:p-6" style={cardStyle}>
    <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
      <div><h2 className="text-lg font-semibold flex items-center gap-2"><BadgeCheck size={19} color="#f97316" />{tri(lang, "پروفایل دانشجویی", "Student profile", "Studierendenprofil", "Öğrenci profili")}</h2><p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>{tri(lang, "کارت AIFekr را بساز و فقط در صورت تمایل عمومی‌اش کن.", "Create your AIFekr card; publish it only if you choose.", "Erstelle deine AIFekr-Karte und veröffentliche sie nur auf Wunsch.", "AIFekr kartını oluştur; yalnızca istersen herkese aç.")}</p></div>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "var(--border)" }}><Upload size={15} />{tri(lang, "بارگذاری عکس", "Upload photo", "Foto hochladen", "Fotoğraf yükle")}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => void upload(event.target.files?.[0])} /></label>
    </div>
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,.85fr)] gap-5 items-start">
      <div className="space-y-3">
        <label className="block text-sm">{tri(lang, "شناسه لینک عمومی", "Public profile URL", "Öffentliche Profil-URL", "Herkese açık profil bağlantısı")}<div className="flex mt-1"><span className="rounded-s-lg border border-e-0 px-3 py-2 text-xs opacity-70" style={{ borderColor: "var(--border)" }}>/student/</span><input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} maxLength={30} placeholder="sobhan" className="min-w-0 flex-1 rounded-e-lg border px-3 py-2 text-sm" style={{ background: "var(--surface-0)", borderColor: "var(--border)" }} /></div></label>
        <label className="flex items-start gap-2 rounded-xl p-3 text-sm" style={{ background: "var(--surface-0)" }}><input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} className="mt-1 accent-orange-500" /><span><span className="font-medium">{tri(lang, "نمایش عمومی کارت", "Make my card public", "Meine Karte veröffentlichen", "Kartımı herkese aç")}</span><span className="block mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>{tri(lang, "نام، عکس و ایمیل روی لینک قابل‌مشاهده می‌شوند.", "Your name, photo and email will be visible to anyone with the link.", "Name, Foto und E-Mail sind für alle mit dem Link sichtbar.", "Adın, fotoğrafın ve e-postan bağlantıya sahip olan herkese görünür.")}</span></span></label>
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}{message && <p role="status" className="text-sm text-green-600">{message}</p>}
        <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-white disabled:opacity-50" style={{ background: "#f97316" }}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}{tri(lang, "ذخیره پروفایل", "Save profile", "Profil speichern", "Profili kaydet")}</button>{isPublic && publicUrl && <><button type="button" onClick={() => void navigator.clipboard.writeText(publicUrl).then(() => setMessage(tri(lang, "لینک کپی شد", "Link copied", "Link kopiert", "Bağlantı kopyalandı"))).catch(() => setError(publicUrl))} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}><Copy size={15} />{tri(lang, "کپی لینک", "Copy link", "Link kopieren", "Bağlantıyı kopyala")}</button><button type="button" onClick={() => void shareCard()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}><Share2 size={15}/>{tri(lang, "اشتراک در شبکه‌های اجتماعی", "Share to social media", "In sozialen Medien teilen", "Sosyal medyada paylaş")}</button></>}</div>
      </div>
      <div className="overflow-hidden rounded-2xl border p-5" style={{ borderColor: "rgba(249,115,22,.3)", background: "linear-gradient(145deg,rgba(249,115,22,.12),var(--surface-0))" }}>
        <div className="flex items-center gap-2 mb-5"><Image src="/logo.svg" alt="AIFekr" width={28} height={28} /><span className="font-semibold">AIFekr</span><span className="ms-auto text-xs" style={{ color: isPublic ? "#16a34a" : "var(--text-secondary)" }}>{isPublic ? tri(lang, "عمومی", "Public", "Öffentlich", "Herkese açık") : tri(lang, "خصوصی", "Private", "Privat", "Özel")}</span></div>
        <div className="flex items-center gap-4">{profile?.avatar && /^https:\/\//.test(profile.avatar) ? <img src={profile.avatar} alt="" className="h-16 w-16 rounded-full object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-full text-xl font-bold text-white" style={{ background: "#f97316" }}>{profile?.name?.slice(0, 1) || "S"}</div>}<div className="min-w-0"><div className="truncate text-lg font-semibold">{profile?.name || tri(lang, "دانشجو", "Student", "Student/in", "Öğrenci")}</div><div className="truncate text-sm" style={{ color: "var(--text-secondary)" }}>{profile?.email || ""}</div></div></div>
        <div className="mt-5 border-t pt-3 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>{publicUrl || tri(lang, "پس از ذخیره شناسه، لینک کارت اینجا نمایش داده می‌شود", "Save a URL slug to preview your card link", "Speichere einen URL-Namen für den Kartenlink", "Kart bağlantısını görmek için bir URL adı kaydet")}</div>
        {!isPublic && <p className="mt-2 flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}><LockKeyhole size={12} />{tri(lang, "فقط خودت این پیش‌نمایش را می‌بینی", "Only you can see this preview", "Nur du siehst diese Vorschau", "Bu önizlemeyi yalnızca sen görürsün")}</p>}
      </div>
    </div>
  </section>;
}
