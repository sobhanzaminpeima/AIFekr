"use client";

import { useEffect, useMemo, useState } from "react";
import StudentBrandCard from "./StudentBrandCard";
import AcademicProfile from "@/components/courses/AcademicProfile";
import { BadgeCheck, Copy, Loader2, Save, Upload } from "lucide-react";
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
      const data = await response.json(); if (!response.ok) throw new Error(data.error || tri(lang, "دریافت پروفایل انجام نشد", "Could not load profile", "Profil konnte nicht geladen werden", "Profil yüklenemedi"));
      setProfile(data.profile); setSlug(data.profile?.studentPublicSlug || ""); setIsPublic(!!data.profile?.studentProfilePublic);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : tri(lang, "دریافت پروفایل انجام نشد", "Could not load profile", "Profil konnte nicht geladen werden", "Profil yüklenemedi"))).finally(() => setLoading(false));
  }, [lang]);

  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/student/profile", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, isPublic }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || tri(lang, "ذخیره پروفایل انجام نشد", "Could not save profile", "Profil konnte nicht gespeichert werden", "Profil kaydedilemedi"));
      setProfile(data.profile); setSlug(data.profile.studentPublicSlug || ""); setMessage(tri(lang, "پروفایل ذخیره شد", "Profile saved", "Profil gespeichert", "Profil kaydedildi"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : tri(lang, "ذخیره پروفایل انجام نشد", "Could not save profile", "Profil konnte nicht gespeichert werden", "Profil kaydedilemedi")); }
    finally { setBusy(false); }
  }

  async function upload(file?: File) {
    if (!file) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const form = new FormData(); form.set("file", file);
      const response = await fetch("/api/student/profile/avatar", { method: "POST", credentials: "include", body: form });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || tri(lang, "بارگذاری عکس انجام نشد", "Could not upload photo", "Foto konnte nicht hochgeladen werden", "Fotoğraf yüklenemedi"));
      setProfile((current) => current ? { ...current, avatar: data.avatar } : current);
      setMessage(tri(lang, "عکس پروفایل ذخیره شد", "Profile photo saved", "Profilfoto gespeichert", "Profil fotoğrafı kaydedildi"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : tri(lang, "بارگذاری عکس انجام نشد", "Could not upload photo", "Foto konnte nicht hochgeladen werden", "Fotoğraf yüklenemedi")); }
    finally { setBusy(false); }
  }

  const cardStyle: React.CSSProperties = { background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 18 };
  if (loading) return <section className="mb-6 rounded-2xl p-6 text-center" style={cardStyle}><Loader2 className="inline animate-spin" /></section>;

  return <><AcademicProfile/><section className="mb-6 mt-6 rounded-2xl p-5 md:p-6" style={cardStyle}>
    <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
      <div><h2 className="text-lg font-semibold flex items-center gap-2"><BadgeCheck size={19} color="#f97316" />{tri(lang, "کارت دانشجویی", "Student card", "Studierendenausweis", "Öğrenci kartı")}</h2><p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>{tri(lang, "کارت عضویتت در جامعهٔ یادگیری AIFekr را بساز و با افتخار به اشتراک بگذار.", "Create your AIFekr learning community card and share it with pride.", "Erstelle deine Karte der AIFekr-Lerngemeinschaft und teile sie mit Stolz.", "AIFekr öğrenme topluluğu kartını oluştur ve gururla paylaş.")}</p></div>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "var(--border)" }}><Upload size={15} />{tri(lang, "بارگذاری عکس", "Upload photo", "Foto hochladen", "Fotoğraf yükle")}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => void upload(event.target.files?.[0])} /></label>
    </div>
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,.85fr)] gap-5 items-start">
      <div className="space-y-3">
        <label className="block text-sm">{tri(lang, "شناسه لینک عمومی", "Public profile URL", "Öffentliche Profil-URL", "Herkese açık profil bağlantısı")}<div className="flex mt-1"><span className="rounded-s-lg border border-e-0 px-3 py-2 text-xs opacity-70" style={{ borderColor: "var(--border)" }}>/student/</span><input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} maxLength={30} placeholder="sobhan" className="min-w-0 flex-1 rounded-e-lg border px-3 py-2 text-sm" style={{ background: "var(--surface-0)", borderColor: "var(--border)" }} /></div></label>
        <label className="flex items-start gap-2 rounded-xl p-3 text-sm" style={{ background: "var(--surface-0)" }}><input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} className="mt-1 accent-orange-500" /><span><span className="font-medium">{tri(lang, "نمایش عمومی کارت", "Make my card public", "Meine Karte veröffentlichen", "Kartımı herkese aç")}</span><span className="block mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>{tri(lang, "نام و عکس روی لینک عمومی قابل‌مشاهده می‌شوند؛ اشتراک عکس کارت نیازی به عمومی‌کردن ندارد.", "Your name and photo will be visible on the public link. Sharing the image does not require a public profile.", "Name und Foto sind über den öffentlichen Link sichtbar. Für das Teilen des Bildes ist kein öffentliches Profil nötig.", "Adın ve fotoğrafın herkese açık bağlantıda görünür. Görseli paylaşmak için profilini herkese açman gerekmez.")}</span></span></label>
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}{message && <p role="status" className="text-sm text-green-600">{message}</p>}
        <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-white disabled:opacity-50" style={{ background: "#f97316" }}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}{tri(lang, "ذخیره پروفایل", "Save profile", "Profil speichern", "Profili kaydet")}</button>{isPublic && profile?.studentProfilePublic && publicUrl && <><button type="button" onClick={() => void navigator.clipboard.writeText(publicUrl).then(() => setMessage(tri(lang, "لینک کپی شد", "Link copied", "Link kopiert", "Bağlantı kopyalandı"))).catch(() => setError(publicUrl))} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}><Copy size={15} />{tri(lang, "کپی لینک", "Copy link", "Link kopieren", "Bağlantıyı kopyala")}</button></>}</div>
      </div>
      <StudentBrandCard lang={lang} name={profile?.name} avatar={profile?.avatar} publicSlug={isPublic && profile?.studentProfilePublic ? profile.studentPublicSlug : null} />
    </div>
  </section></>;
}
