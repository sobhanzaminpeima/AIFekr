"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import StudentActivationLink from "@/components/student/StudentActivationLink";
import { useState, useEffect } from "react";
import { Save, User, Lock, Trash2, CreditCard, BarChart3, Palette, Loader2, Users, UserPlus, Crown, X } from "lucide-react";
import toast from "react-hot-toast";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import ThemeSwitcher from "@/components/ui/ThemeSwitcher";
import { useTranslation, tri } from "@/lib/i18n";
import { formatNumber, toJalali } from "@/lib/utils/jalali";
import WorkspaceLoading from "@/components/layout/WorkspaceLoading";
import WorkspaceError from "@/components/layout/WorkspaceError";

const AVATAR_EMOJIS = ["🙂", "😎", "🚀", "🧠", "🦊", "🐼", "🌟", "🔥", "🎯", "💼", "🧑‍💻", "👩‍💻"];

interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  avatar: string | null;
  plan: string;
  credits: number;
  planExpiry: string | null;
  createdAt: string;
  authProvider: string;
  accountType?: string;
  studentWorkspaceEnabled?: boolean;
  industryPack?: {name:string;nameEn:string|null;nameDe:string|null;slug:string}|null;
}

interface UsageStats {
  byType: { type: string; count: number; totalCredits: number }[];
  totalCredits: number;
  days: number;
}

interface PaymentRow {
  transferCurrency: string; transferMinor: number; receiptAt: string | null; reviewNote: string | null;
  id: string;
  amount: number;
  plan: string;
  status: string;
  gateway: string;
  refId: string | null;
  createdAt: string;
}

interface TeamMemberRow { id: string; name: string | null; email: string | null; avatar: string | null; role: string; joinedAt: string; }
interface TeamInviteRow { id: string; email: string; createdAt: string; expiresAt: string; }
interface TeamData {
  id: string; name: string; credits: number; maxSeats: number; planExpiry: string | null; isOwner: boolean;
  members: TeamMemberRow[]; invites: TeamInviteRow[];
}

interface TeamUsageRow {
  userId: string; name: string | null; email: string | null; role: string;
  totalCreditsSpent: number;
  byType: { type: string; count: number; creditsSpent: number }[];
}

export default function SettingsPage() {
  const { t, lang } = useTranslation();
  const isFa = lang === "fa";
  const dateLocale = lang === "fa" ? "fa-IR" : lang === "de" ? "de-DE" : "en-US";
  const STATUS_LABEL: Record<string, string> = { PENDING: t.settingsPage.statusPending, SUCCESS: t.settingsPage.statusPaid, REJECTED: tri(lang,"رد شده","Rejected","Abgelehnt","Reddedildi"), PAID: t.settingsPage.statusPaid, FAILED: t.settingsPage.statusFailed };
  const TYPE_LABEL: Record<string, string> = { chat: t.settingsPage.typeChat, image: t.settingsPage.typeImage, video: t.settingsPage.typeVideo, music: t.settingsPage.typeMusic, tool: t.settingsPage.typeTool };

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [currency, setCurrency] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [team, setTeam] = useState<TeamData | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [teamUsage, setTeamUsage] = useState<TeamUsageRow[] | null>(null);

  function loadTeam() {
    fetch("/api/team", { credentials: "include" }).then((r) => r.json()).then((d) => setTeam(d.team || null)).catch(() => setTeam(null));
    fetch("/api/team/usage?days=30", { credentials: "include" }).then((r) => r.json()).then((d) => setTeamUsage(d.breakdown || null)).catch(() => setTeamUsage(null));
  }

  useEffect(() => {
    setLoading(true); setLoadFailed(false);
    fetch("/api/user/profile", { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => {
        if (d.user) {
          setProfile(d.user);
          setName(d.user.name || "");
          setAvatar(d.user.avatar || "");
          setCurrency(d.user.currency || "");
        }
      }).catch(() => setLoadFailed(true)).finally(() => setLoading(false));
    fetch("/api/user/usage", { credentials: "include" }).then((r) => r.json()).then(setUsage).catch(() => setUsage(null));
    fetch("/api/user/payments", { credentials: "include" }).then((r) => r.json()).then((d) => setPayments(d.payments || [])).catch(() => setPayments([]));
    loadTeam();
  }, [attempt]);

  async function sendInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(t.settingsPage.inviteSent);
      setInviteEmail("");
      loadTeam();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.settingsPage.errInviteSend);
    } finally {
      setInviting(false);
    }
  }

  async function revokeInvite(id: string) {
    await fetch(`/api/team/invite/${id}`, { method: "DELETE", credentials: "include" });
    loadTeam();
  }

  async function removeMember(userId: string) {
    await fetch(`/api/team/members/${userId}`, { method: "DELETE", credentials: "include" });
    loadTeam();
  }

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, avatar, currency: currency || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(t.settingsPage.profileSaved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.settingsPage.errSaveProfile);
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword() {
    setSavingPassword(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(t.settingsPage.passwordChanged);
      setCurrentPassword("");
      setNewPassword("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.settingsPage.errChangePassword);
    } finally {
      setSavingPassword(false);
    }
  }

  async function deleteAccount() {
    if (!deleteConfirm) return setDeleteConfirm(true);
    setDeleting(true);
    try {
      const res = await fetch("/api/user/delete", { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error(t.settingsPage.errDeleteAccount);
      window.location.href = "/";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.settingsPage.errDeleteAccount);
      setDeleting(false);
    }
  }

  if (loading) return <WorkspaceLoading/>;
  if (loadFailed) return <WorkspaceError reset={() => setAttempt(value => value + 1)}/>;
  return (
    <div dir={isFa ? "rtl" : "ltr"} className="workspace-page max-w-3xl space-y-5">
      <header className="workspace-heading"><h1 style={{ color: "var(--text-primary)" }}>{t.settingsPage.title}</h1></header>

      <Link href="/payments" className="flex min-h-12 items-center gap-3 rounded-2xl border px-4 py-4 text-sm font-semibold" style={{ borderColor: "var(--border)", background: "rgba(249,115,22,.08)" }}><CreditCard size={20} className="shrink-0 text-orange-500"/>{tri(lang,"پرداخت‌ها، رسیدها و پیگیری فعال‌سازی","Payments, receipts & activation tracking","Zahlungen, Belege und Aktivierung verfolgen","Ödeme, dekont ve etkinleştirmeyi takip et")}</Link>

      {/* Profile */}
      <section className="p-4 sm:p-5 rounded-2xl space-y-4 min-w-0 overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <User className="w-5 h-5" style={{ color: "var(--primary)" }} />
          <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>{t.settingsPage.personalInfo}</h2>
        </div>

        <div>
          <label className="block text-sm mb-2" style={{ color: "var(--text-secondary)" }}>{t.settingsPage.avatar}</label>
          <div className="flex flex-wrap gap-2">
            {AVATAR_EMOJIS.map((e) => (
              <button
                key={e}
                aria-label={`${t.settingsPage.avatar}: ${e}`}
                aria-pressed={avatar === e}
                onClick={() => setAvatar(e)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all"
                style={{ background: avatar === e ? "var(--primary)" : "var(--surface-2)", border: "1px solid var(--border)" }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <section className="mb-5 rounded-2xl border p-4" style={{borderColor:"var(--border)"}}>
          <h2 className="font-semibold">{tri(lang,"بسته‌ها و ایجنت‌های حساب من","My packages and agents","Meine Pakete und Agenten","Paketlerim ve ajanlarım")}</h2>
          <p className="my-3 text-sm opacity-75">{profile?.industryPack ? (lang==="fa"?profile.industryPack.name:lang==="de"?(profile.industryPack.nameDe||profile.industryPack.nameEn||profile.industryPack.name):(profile.industryPack.nameEn||profile.industryPack.name)) : tri(lang,"هنوز بستهٔ صنعتی انتخاب نکرده‌اید","No industry pack selected yet","Noch kein Branchenpaket gewählt","Henüz sektör paketi seçilmedi")}</p>
          <div className="flex flex-wrap gap-2"><Link href="/industry" className="rounded-xl border px-4 py-2 text-sm" style={{borderColor:"var(--border)"}}>{tri(lang,"مشاهدهٔ بسته‌های صنعتی","Browse industry packs","Branchenpakete ansehen","Sektör paketlerini gör")}</Link><StudentActivationLink className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white">{profile?.studentWorkspaceEnabled?tri(lang,"ایجنت دانشجویی فعال — ورود","Student Agent active — open","Lernagent aktiv — öffnen","Öğrenci ajanı etkin — aç"):tri(lang,"فعال‌سازی بستهٔ دانشجویی","Activate student package","Studierendenpaket aktivieren","Öğrenci paketini etkinleştir")}</StudentActivationLink></div>
        </section>

        <div>
          <label htmlFor="settings-display-name" className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>{t.settingsPage.displayName}</label>
          <input id="settings-display-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.settingsPage.namePlaceholder}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        </div>

        {profile && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm min-w-0">
            <div className="min-w-0">
              <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{t.settingsPage.emailOrPhone}</div>
              <div className="min-w-0 break-all [overflow-wrap:anywhere]" style={{ color: "var(--text-primary)" }} dir="ltr">{profile.email || profile.phone || "—"}</div>
            </div>
            <div className="min-w-0">
              <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{t.settingsPage.currentPlan}</div>
              <div style={{ color: "var(--primary)" }}>{profile.plan}</div>
            </div>
          </div>
        )}

        <button onClick={saveProfile} disabled={savingProfile}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
          style={{ background: "var(--primary)" }}>
          {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {savingProfile ? t.settingsPage.saving : t.settingsPage.saveProfile}
        </button>
      </section>

      {/* Appearance & Language */}
      <section className="p-5 rounded-2xl space-y-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5" style={{ color: "var(--primary)" }} />
          <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>{t.settingsPage.appearanceLanguage}</h2>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <div className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>{t.settingsPage.theme}</div>
            <ThemeSwitcher />
          </div>
          <div className="flex-1">
            <div className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>{t.settingsPage.language}</div>
            <LanguageSwitcher />
          </div>
        </div>
        <div>
          <div className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>{t.settingsPage.currency}</div>
          <select
            value={currency}
            onChange={async (e) => {
              const next = e.target.value;
              setCurrency(next);
              // Instant apply, same as the theme/language switchers right next
              // to it -- a separate "save" button here would be inconsistent
              // with those two and easy to forget.
              try {
                const res = await fetch("/api/user/profile", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ currency: next || null }),
                });
                if (!res.ok) throw new Error();
                toast.success(t.settingsPage.profileSaved);
              } catch {
                toast.error(t.settingsPage.errSaveProfile);
              }
            }}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          >
            <option value="">{t.settingsPage.currencyDefault}</option>
            <option value="IRT">{t.settingsPage.currencyToman}</option>
            <option value="USD">{t.settingsPage.currencyUsd}</option>
            <option value="EUR">{t.settingsPage.currencyEur}</option>
          </select>
        </div>
      </section>

      {/* Password */}
      {profile?.authProvider !== "google" && (
        <section className="p-5 rounded-2xl space-y-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5" style={{ color: "var(--primary)" }} />
            <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>{t.settingsPage.changePassword}</h2>
          </div>
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder={t.settingsPage.currentPasswordPlaceholder}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" dir="ltr"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t.settingsPage.newPasswordPlaceholder}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" dir="ltr"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <button onClick={changePassword} disabled={savingPassword || !newPassword}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
            style={{ background: "var(--primary)" }}>
            {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {savingPassword ? t.settingsPage.saving : t.settingsPage.changePasswordBtn}
          </button>
        </section>
      )}

      {/* Usage stats */}
      <section className="p-5 rounded-2xl space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" style={{ color: "var(--primary)" }} />
          <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>{t.settingsPage.usageTitle}</h2>
        </div>
        {!usage || usage.byType.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>{t.settingsPage.noUsage}</p>
        ) : (
          <div className="space-y-2">
            {usage.byType.map((u) => (
              <div key={u.type} className="flex items-center justify-between text-sm">
                <span style={{ color: "var(--text-secondary)" }}>{TYPE_LABEL[u.type] || u.type}</span>
                <span style={{ color: "var(--text-primary)" }}>{formatNumber(u.totalCredits, lang)} {t.settingsPage.creditsUnit} ({formatNumber(u.count, lang)} {t.settingsPage.timesUnit})</span>
              </div>
            ))}
            <div className="pt-2 mt-2 flex items-center justify-between text-sm font-semibold" style={{ borderTop: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-primary)" }}>{t.settingsPage.total}</span>
              <span style={{ color: "var(--primary)" }}>{formatNumber(usage.totalCredits, lang)} {t.settingsPage.creditsUnit}</span>
            </div>
          </div>
        )}
      </section>

      {/* Payment history */}
      <section className="p-5 rounded-2xl space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" style={{ color: "var(--primary)" }} />
          <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>{t.settingsPage.paymentHistory}</h2>
        </div>
        {payments.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>{t.settingsPage.noPayments}</p>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm p-2 rounded-xl" style={{ background: "var(--surface-2)" }}>
                <div>
                  <div style={{ color: "var(--text-primary)" }}>{p.plan}</div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>{lang === "fa" ? toJalali(p.createdAt) : new Date(p.createdAt).toLocaleDateString(dateLocale)}</div>
                </div>
                <div className="text-left">
                  <div style={{ color: "var(--text-primary)" }}>{p.gateway === "bank_transfer" ? `${(p.transferMinor / 100).toLocaleString(dateLocale)} ${p.transferCurrency}` : `${p.amount.toLocaleString(dateLocale)} Toman`}</div>
                  <div className="text-xs" style={{ color: p.status === "SUCCESS" ? "var(--success)" : p.status === "FAILED" ? "var(--danger)" : "var(--text-muted)" }}>
                    {STATUS_LABEL[p.status] || p.status}
                    {p.gateway === "bank_transfer" && <a className="block text-orange-500" href={`/checkout/${p.id}`}>{tri(lang,"جزئیات و رسید","Details and receipt","Details und Beleg","Ayrıntılar ve dekont")}</a>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Team management */}
      {team && (
        <section className="p-5 rounded-2xl space-y-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" style={{ color: "var(--primary)" }} />
              <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>{team.name}</h2>
            </div>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {formatNumber(team.members.length, lang)}/{formatNumber(team.maxSeats, lang)} {t.settingsPage.peopleUnit} · {formatNumber(team.credits, lang)} {t.settingsPage.sharedCredits}
            </span>
          </div>

          <div className="space-y-1.5">
            {team.members.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm p-2 rounded-xl" style={{ background: "var(--surface-2)" }}>
                <div className="flex items-center gap-2">
                  <span>{m.avatar || "👤"}</span>
                  <span style={{ color: "var(--text-primary)" }}>{m.name || m.email || "—"}</span>
                  {m.role === "OWNER" && <Crown className="w-3.5 h-3.5" style={{ color: "#f59e0b" }} />}
                </div>
                {team.isOwner && m.role !== "OWNER" && (
                  <button onClick={() => removeMember(m.id)} title={t.settingsPage.removeFromTeam}>
                    <X className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {team.invites.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>{t.settingsPage.pendingInvites}</div>
              {team.invites.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between text-sm p-2 rounded-xl" style={{ background: "var(--surface-2)" }}>
                  <span dir="ltr" style={{ color: "var(--text-secondary)" }}>{inv.email}</span>
                  {team.isOwner && (
                    <button onClick={() => revokeInvite(inv.id)} title={t.settingsPage.cancelInvite}>
                      <X className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {team.isOwner && team.members.length + team.invites.length < team.maxSeats && (
            <div className="flex gap-2">
              <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder={t.settingsPage.newMemberEmailPlaceholder} dir="ltr"
                className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              <button onClick={sendInvite} disabled={inviting || !inviteEmail.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "var(--primary)" }}>
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {t.settingsPage.invite}
              </button>
            </div>
          )}

          {!team.isOwner && profile && (
            <button onClick={() => removeMember(profile.id)}
              className="w-full py-2 rounded-xl text-sm font-medium"
              style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
              {t.settingsPage.leaveTeam}
            </button>
          )}

          {/* AI Workforce Usage -- per-member breakdown of the shared credit pool, last 30 days */}
          {teamUsage && teamUsage.length > 0 && (
            <div className="pt-2 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
              <div className="text-xs font-medium pt-2" style={{ color: "var(--text-muted)" }}>
                {tri(lang, "مصرف تیم — ۳۰ روز اخیر", "Team usage — last 30 days", "Team-Nutzung — letzte 30 Tage")}
              </div>
              {teamUsage.map((row) => (
                <div key={row.userId} className="p-2.5 rounded-xl" style={{ background: "var(--surface-2)" }}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span style={{ color: "var(--text-primary)" }}>{row.name || row.email || row.userId}</span>
                    <span className="font-medium" style={{ color: "var(--primary)" }}>{formatNumber(row.totalCreditsSpent, lang)} {tri(lang, "کردیت", "credits", "Guthaben")}</span>
                  </div>
                  {row.byType.length > 0 && (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      {row.byType.map((bt) => (
                        <span key={bt.type} className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {TYPE_LABEL[bt.type] ?? bt.type}: {formatNumber(bt.creditsSpent, lang)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Danger zone */}
      <section className="p-5 rounded-2xl space-y-3" style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.25)" }}>
        <div className="flex items-center gap-2">
          <Trash2 className="w-5 h-5" style={{ color: "#ef4444" }} />
          <h2 className="font-semibold" style={{ color: "#ef4444" }}>{t.settingsPage.dangerZone}</h2>
        </div>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {t.settingsPage.dangerDescription}
        </p>
        <button onClick={deleteAccount} disabled={deleting}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
          style={{ background: "#ef4444" }}>
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          {deleting ? t.settingsPage.deleting : deleteConfirm ? t.settingsPage.confirmDelete : t.settingsPage.deleteAccountBtn}
        </button>
      </section>
    </div>
  );
}
