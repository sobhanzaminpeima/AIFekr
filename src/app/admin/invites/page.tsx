"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Sparkles, Search, Copy, Check, RefreshCw, ArrowRight, Download } from "lucide-react";
import toast from "react-hot-toast";
import { toPng } from "html-to-image";
import InviteCardCanvas, { CARD_WIDTH, CARD_HEIGHT, type CardLang } from "@/components/admin/InviteCardCanvas";
import { generateQrDataUrl } from "@/lib/utils/qrCode";

/**
 * Admin "Invite to AIfekr" tool — phase 4: adds the branded card preview +
 * PNG export (phase 3 built the user/credentials/referral-link/text data
 * side). Card visuals are placeholder brand for now (see
 * InviteCardCanvas.tsx) — phase 5 swaps in the final logo/palette/fonts.
 *
 * The referral link is never generated here — it only ever displays
 * User.referralCode as returned by GET /api/admin/users/[id], the exact
 * same field the user's own /referral dashboard reads. See
 * src/lib/utils/referralWallet.ts and src/app/(dashboard)/referral/page.tsx
 * for the other reader of that single source of truth.
 */

type Lang = "fa" | "en" | "de";

interface UserDetail {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  referralCode: string | null;
  trialStartsAt: string | null;
  trialEndsAt: string | null;
  realEstatePackage: boolean;
}

interface SearchResult {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

const TEMPLATES: Record<Lang, string> = {
  fa: `سلام {نام کاربر} عزیز 👋

به AIfekr خوش اومدی! یک هفته دسترسی کامل Pro + پکیج املاک برات فعال کردیم تا خودت امتحان کنی.

🔑 یوزرنیم: {یوزرنیم}
🔑 پسورد موقت: {پسورد}
(اولین بار که وارد شدی، ازت می‌خوایم پسوردت رو عوض کنی)

لینک اختصاصی تو: {لینک رفرال}

هر سوالی داشتی در خدمتتم.
تیم AIfekr`,
  en: `Hi {UserName} 👋

Welcome to AIfekr! We've activated 7 days of full Pro access + the complete Real Estate package for you to try.

🔑 Username: {Username}
🔑 Temporary password: {Password}
(You'll be asked to set a new password on first login.)

Your personal link: {ReferralLink}

Reach out anytime with questions.
The AIfekr Team`,
  de: `Hallo {Benutzername} 👋

Willkommen bei AIfekr! Wir haben 7 Tage vollen Pro-Zugang + das komplette Immobilien-Paket für dich freigeschaltet.

🔑 Benutzername: {Benutzername}
🔑 Vorläufiges Passwort: {Passwort}
(Beim ersten Login wirst du gebeten, ein neues Passwort festzulegen.)

Dein persönlicher Link: {Empfehlungslink}

Bei Fragen sind wir für dich da.
Das AIfekr-Team`,
};

const LANG_LABEL: Record<Lang, string> = { fa: "فارسی 🇮🇷", en: "English 🇬🇧", de: "Deutsch 🇩🇪" };

function fillTemplate(lang: Lang, vars: { name: string; username: string; password: string; referralLink: string; trialDays: number }): string {
  const t = TEMPLATES[lang];
  if (lang === "fa") {
    return t
      .replaceAll("{نام کاربر}", vars.name)
      .replaceAll("{یوزرنیم}", vars.username)
      .replaceAll("{پسورد}", vars.password)
      .replaceAll("{لینک رفرال}", vars.referralLink)
      .replaceAll("{تعداد روز تریال}", String(vars.trialDays));
  }
  if (lang === "de") {
    return t
      .replaceAll("{Benutzername}", vars.username)
      .replaceAll("{Passwort}", vars.password)
      .replaceAll("{Empfehlungslink}", vars.referralLink);
  }
  return t
    .replaceAll("{UserName}", vars.name)
    .replaceAll("{Username}", vars.username)
    .replaceAll("{Password}", vars.password)
    .replaceAll("{ReferralLink}", vars.referralLink);
}

function InvitePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [password, setPassword] = useState<string | null>(null);
  const [generatingPassword, setGeneratingPassword] = useState(false);
  const [lang, setLang] = useState<Lang>("fa");
  const [inviteText, setInviteText] = useState("");
  const [editedByUser, setEditedByUser] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [generatingCard, setGeneratingCard] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const previewScale = 0.32; // 1080x1350 native -> a manageable on-screen preview size
  const [savedCards, setSavedCards] = useState<{ id: string; language: CardLang; imageUrl: string; createdAt: string }[]>([]);

  const loadSavedCards = useCallback(async (userId: string) => {
    const res = await fetch(`/api/admin/invites/log-card?userId=${userId}`);
    const data = await res.json();
    setSavedCards(data.cards || []);
  }, []);

  const loadUser = useCallback(async (userId: string) => {
    setLoadingUser(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUser(data.user);
      setPassword(null);
      loadSavedCards(userId);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "خطا در بارگذاری کاربر");
    } finally {
      setLoadingUser(false);
    }
  }, [loadSavedCards]);

  useEffect(() => {
    const userId = searchParams.get("userId");
    if (userId) loadUser(userId);
  }, [searchParams, loadUser]);

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.users || []);
    } finally {
      setSearching(false);
    }
  }

  function selectUser(u: SearchResult) {
    router.push(`/admin/invites?userId=${u.id}`);
    setResults([]);
    setQuery("");
  }

  async function generatePassword() {
    if (!user) return;
    setGeneratingPassword(true);
    try {
      const res = await fetch("/api/admin/invites/reset-password", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPassword(data.tempPassword);
      setEditedByUser(false); // force text regeneration with the new password
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "خطا در تولید پسورد");
    } finally {
      setGeneratingPassword(false);
    }
  }

  const username = user?.email || user?.phone || "";
  const referralLink = user?.referralCode && typeof window !== "undefined"
    ? `${window.location.origin}/register?ref=${user.referralCode}`
    : "";
  const trialDays = user?.trialStartsAt && user?.trialEndsAt
    ? Math.round((new Date(user.trialEndsAt).getTime() - new Date(user.trialStartsAt).getTime()) / (24 * 60 * 60 * 1000))
    : 7;

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!referralLink) { setQrCodeDataUrl(undefined); return; }
    generateQrDataUrl(referralLink).then(setQrCodeDataUrl).catch(() => setQrCodeDataUrl(undefined));
  }, [referralLink]);

  // Re-render the template whenever its inputs change, UNLESS the admin has
  // manually edited the textarea — never clobber their edits out from under them.
  useEffect(() => {
    if (editedByUser || !user) return;
    setInviteText(fillTemplate(lang, { name: user.name || username, username, password: password || "••••••••", referralLink, trialDays }));
  }, [lang, user, username, password, referralLink, trialDays, editedByUser]);

  async function downloadCard() {
    if (!cardRef.current || !user) return;
    setGeneratingCard(true);
    try {
      // Fonts must be fully loaded before capture, or the exported PNG can
      // render with the browser's fallback font instead of the real one.
      await document.fonts.ready;
      // Guard against capturing before the QR effect has resolved (e.g. the
      // admin clicks Download immediately after the page loads).
      if (!qrCodeDataUrl && referralLink) {
        await generateQrDataUrl(referralLink).then(setQrCodeDataUrl).catch(() => {});
        await new Promise((r) => setTimeout(r, 50)); // let the <img> paint
      }
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, width: CARD_WIDTH, height: CARD_HEIGHT });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `AIfekr-Invite-${username || user.id}-${lang}.png`;
      a.click();

      await fetch("/api/admin/invites/log-card", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, language: lang, inviteText, imageDataUrl: dataUrl }),
      }).catch(() => {});
      loadSavedCards(user.id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "خطا در ساخت کارت");
    } finally {
      setGeneratingCard(false);
    }
  }

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1500);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6" dir="ltr">
      <button onClick={() => router.push("/admin/users")} className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
        <ArrowRight className="w-4 h-4" /> بازگشت به کاربران
      </button>

      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(245,130,31,0.12)" }}>
          <Sparkles className="w-5 h-5" style={{ color: "#F5821F" }} />
        </div>
        <div dir="rtl">
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>دعوت به AiFekr</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>ساخت کارت دعوت برای کاربر — یوزرنیم، پسورد موقت، لینک رفرال و متن دعوت</p>
        </div>
      </div>

      {!user && (
        <div className="rounded-2xl p-4 space-y-3" dir="rtl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <Search className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="جستجوی کاربر با نام، ایمیل یا موبایل..." className="flex-1 text-sm bg-transparent outline-none" style={{ color: "var(--text-primary)" }} />
            <button onClick={search} disabled={searching} className="text-xs font-medium disabled:opacity-50" style={{ color: "#F5821F" }}>
              {searching ? "..." : "جستجو"}
            </button>
          </div>
          {results.length > 0 && (
            <div className="space-y-1.5">
              {results.map((r) => (
                <button key={r.id} onClick={() => selectUser(r)}
                  className="w-full flex flex-col items-start p-3 rounded-xl text-right" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{r.name || "بدون نام"}</span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{r.email || r.phone}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {loadingUser && <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" /></div>}

      {user && (
        <div className="space-y-4" dir="rtl">
          <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>کاربر: <strong style={{ color: "var(--text-primary)" }}>{user.name || username}</strong></p>
          </div>

          {/* Credentials */}
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>اطلاعات ورود</h3>
            <FieldRow label="یوزرنیم" value={username} copiedField={copiedField} onCopy={copy} />
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <div className="min-w-0">
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>پسورد موقت</div>
                <div className="text-sm truncate" dir="ltr" style={{ color: "var(--text-primary)" }}>{password || "— هنوز تولید نشده —"}</div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {password && (
                  <button onClick={() => copy("پسورد موقت", password)} className="p-1.5 rounded-lg" style={{ background: "var(--surface-1)" }}>
                    {copiedField === "پسورد موقت" ? <Check className="w-3.5 h-3.5" style={{ color: "#22c55e" }} /> : <Copy className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />}
                  </button>
                )}
                <button onClick={generatePassword} disabled={generatingPassword} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50" style={{ background: "#F5821F22", color: "#F5821F" }}>
                  <RefreshCw className={`w-3.5 h-3.5 ${generatingPassword ? "animate-spin" : ""}`} /> {password ? "تولید مجدد" : "تولید پسورد"}
                </button>
              </div>
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>تولید پسورد جدید بلافاصله پسورد فعلی کاربر را در سیستم عوض می‌کند و اجباری برای تغییرش در اولین ورود ثبت می‌شود.</p>
          </div>

          {/* Referral link */}
          <div className="rounded-2xl p-4 space-y-2" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>لینک رفرال اختصاصی</h3>
            {referralLink ? (
              <FieldRow label="لینک رفرال" value={referralLink} copiedField={copiedField} onCopy={copy} />
            ) : (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>این کاربر هنوز کد رفرال ندارد — از «فعال‌سازی دعوت Pro» استفاده کنید تا یکی برایش ساخته شود.</p>
            )}
          </div>

          {/* Language + invite text */}
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>متن دعوت</h3>
              <div className="flex gap-1.5">
                {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
                  <button key={l} onClick={() => { setLang(l); setEditedByUser(false); }}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium"
                    style={{ background: lang === l ? "#F5821F" : "var(--surface-2)", color: lang === l ? "#fff" : "var(--text-secondary)" }}>
                    {LANG_LABEL[l]}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={inviteText}
              onChange={(e) => { setInviteText(e.target.value); setEditedByUser(true); }}
              dir={lang === "fa" ? "rtl" : "ltr"}
              rows={10}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none leading-6"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)", fontFamily: lang === "fa" ? "Vazirmatn, sans-serif" : "inherit" }}
            />
            <button onClick={() => copy("متن دعوت", inviteText)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium" style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              {copiedField === "متن دعوت" ? <Check className="w-3.5 h-3.5" style={{ color: "#22c55e" }} /> : <Copy className="w-3.5 h-3.5" />} کپی متن دعوت
            </button>
          </div>

          {/* Card preview + PNG export. The card itself always renders at
              its real 1080x1350 size (InviteCardCanvas) — this wrapper just
              visually shrinks it for on-screen preview via a CSS transform,
              so html-to-image still captures full resolution. */}
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>پیش‌نمایش کارت دعوت</h3>
            <div style={{ width: CARD_WIDTH * previewScale, height: CARD_HEIGHT * previewScale, overflow: "hidden", borderRadius: 16, margin: "0 auto" }}>
              <div style={{ width: CARD_WIDTH, height: CARD_HEIGHT, transform: `scale(${previewScale})`, transformOrigin: "top left" }}>
                <InviteCardCanvas
                  ref={cardRef}
                  lang={lang as CardLang}
                  name={user.name || username}
                  username={username}
                  password={password || "••••••••"}
                  referralLink={referralLink}
                  trialDays={trialDays}
                  qrCodeDataUrl={qrCodeDataUrl}
                />
              </div>
            </div>
            <button onClick={downloadCard} disabled={generatingCard} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg, #F5821F, #F2701A)" }}>
              {generatingCard ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} دانلود کارت (PNG)
            </button>
            {!password && <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>پسورد هنوز تولید نشده — روی کارت به‌صورت نقطه‌چین نمایش داده می‌شود.</p>}
          </div>

          {/* Previously saved cards for this user — the PNG is uploaded to
              R2 on every download, so an admin can come back later without
              regenerating it. */}
          {savedCards.length > 0 && (
            <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>کارت‌های ذخیره‌شدهٔ قبلی</h3>
              <div className="grid grid-cols-3 gap-2">
                {savedCards.map((c) => (
                  <a key={c.id} href={c.imageUrl} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                    <img src={c.imageUrl} alt={c.language} className="w-full aspect-[4/5] object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminInvitesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center" style={{ color: "var(--text-muted)" }}>در حال بارگذاری...</div>}>
      <InvitePageInner />
    </Suspense>
  );
}

function FieldRow({ label, value, copiedField, onCopy }: { label: string; value: string; copiedField: string | null; onCopy: (label: string, value: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
      <div className="min-w-0">
        <div className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</div>
        <div className="text-sm truncate" dir="ltr" style={{ color: "var(--text-primary)" }}>{value}</div>
      </div>
      <button onClick={() => onCopy(label, value)} className="flex-shrink-0 p-1.5 rounded-lg" style={{ background: "var(--surface-1)" }}>
        {copiedField === label ? <Check className="w-3.5 h-3.5" style={{ color: "#22c55e" }} /> : <Copy className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />}
      </button>
    </div>
  );
}
