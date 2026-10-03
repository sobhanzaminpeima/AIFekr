"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, MailPlus, MessageSquareText, Plus, RefreshCw, Send, Users } from "lucide-react";
import { tri, type Lang } from "@/lib/i18n";

type Group = { id: string; name: string; inviteCode: string; ownerId: string; course: { id: string; name: string } | null; _count?: { members: number } };
type Message = { id: string; content: string; createdAt: string; user: { id: string; name: string | null } };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

export default function StudentStudyGroups({ lang, courses }: { lang: Lang; courses: { id: string; name: string }[] }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [active, setActive] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [name, setName] = useState("");
  const [groupCourseId, setGroupCourseId] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const locale = lang === "fa" ? "fa-IR" : lang === "de" ? "de-DE" : lang === "tr" ? "tr-TR" : "en-US";
  const t = {
    title: tri(lang, "گروه‌های مطالعه", "Study groups", "Lerngruppen", "Çalışma grupları"),
    intro: tri(lang, "برای مطالعهٔ مشترک یک گروه بساز و هم‌دانشگاهی‌هایت را با ایمیل دعوت کن. اعضا می‌توانند پیام بگذارند و برنامهٔ مطالعه را هماهنگ کنند.", "Create a group for collaborative study. Invite classmates by email so members can coordinate and discuss.", "Erstelle eine Lerngruppe und lade Kommilitonen per E-Mail ein.", "Ortak çalışma için bir grup oluştur; arkadaşlarını e-postayla davet et."),
    create: tri(lang, "ساخت گروه", "Create group", "Gruppe erstellen", "Grup oluştur"),
    join: tri(lang, "پیوستن به گروه", "Join a group", "Gruppe beitreten", "Gruba katıl"),
    empty: tri(lang, "هنوز عضو گروهی نیستی. یک گروه بساز یا با کدی که هم‌دانشجویی برایت فرستاده عضو شو.", "You are not in a group yet. Create one or join using a code from a classmate.", "Du bist noch in keiner Gruppe.", "Henüz bir grupta değilsin."),
    send: tri(lang, "ارسال پیام", "Send message", "Nachricht senden", "Mesaj gönder"),
    code: tri(lang, "کد دعوت گروه", "Group invite code", "Gruppencode", "Grup davet kodu"),
  };

  const loadGroups = useCallback(async () => {
    setError("");
    try {
      const result = await request<{ groups: Group[] }>("/api/student/groups");
      setGroups(result.groups);
      setActive((current) => current && result.groups.some((group) => group.id === current) ? current : result.groups[0]?.id || "");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load groups"); }
  }, []);
  useEffect(() => { void loadGroups(); }, [loadGroups]);
  const loadMessages = useCallback(async (groupId: string) => {
    if (!groupId) { setMessages([]); return; }
    try { const result = await request<{ messages: Message[] }>(`/api/student/groups/${groupId}/messages`); setMessages(result.messages); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load messages"); }
  }, []);
  useEffect(() => {
    if (!active) { setMessages([]); return; }
    let cancelled = false;
    const refresh = async () => { try { const result = await request<{ messages: Message[] }>(`/api/student/groups/${active}/messages`); if (!cancelled) setMessages(result.messages); } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load messages"); } };
    void refresh(); const timer = window.setInterval(() => void refresh(), 10000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [active]);

  async function createGroup(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try { const { group } = await request<{ group: Group }>("/api/student/groups", { method: "POST", body: JSON.stringify({ name, courseId: groupCourseId || null }) }); setName(""); setGroupCourseId(""); await loadGroups(); setActive(group.id); setNotice(tri(lang, "گروه ساخته شد؛ حالا دانشجوها را با ایمیل اضافه کن.", "Group created. Invite students by email.", "Gruppe erstellt.", "Grup oluşturuldu.")); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not create group"); } finally { setBusy(false); }
  }
  async function joinGroup(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try { const { groupId } = await request<{ groupId: string }>("/api/student/groups/join", { method: "POST", body: JSON.stringify({ inviteCode }) }); setInviteCode(""); await loadGroups(); setActive(groupId); setNotice(tri(lang, "به گروه پیوستی.", "You joined the group.", "Du bist der Gruppe beigetreten.", "Gruba katıldın.")); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not join group"); } finally { setBusy(false); }
  }
  async function inviteByEmail(event: React.FormEvent) {
    event.preventDefault(); if (!active) return; setBusy(true); setError(""); setNotice("");
    try { const result = await request<{ message: string }>(`/api/student/groups/${active}/invite`, { method: "POST", body: JSON.stringify({ email: inviteEmail }) }); setInviteEmail(""); await loadGroups(); setNotice(result.message); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not invite student"); } finally { setBusy(false); }
  }
  async function sendMessage(event: React.FormEvent) {
    event.preventDefault(); if (!active || !draft.trim()) return; setBusy(true); setError("");
    try { const { message } = await request<{ message: Message }>(`/api/student/groups/${active}/messages`, { method: "POST", body: JSON.stringify({ content: draft }) }); setDraft(""); setMessages((current) => [...current.filter((item) => item.id !== message.id), message].slice(-100)); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not send message"); } finally { setBusy(false); }
  }
  async function copyCode(group: Group) {
    try { await navigator.clipboard.writeText(group.inviteCode); setNotice(tri(lang, "کد دعوت کپی شد؛ می‌توانی آن را برای دانشجو بفرستی.", "Invite code copied. Send it to a student.", "Einladungscode kopiert.", "Davet kodu kopyalandı.")); }
    catch { setError(group.inviteCode); }
  }

  const selected = groups.find((group) => group.id === active);
  return <section className="mt-6 rounded-2xl p-5 md:p-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-semibold"><Users size={19} color="#f97316"/>{t.title}</h2><p className="mt-1 max-w-3xl text-xs leading-6" style={{ color: "var(--text-secondary)" }}>{t.intro} {tri(lang, "هر دانشجو با حساب AIFekr خودش وارد می‌شود؛ اینجا منظور از دانشجو، عضو گروه درسی شماست.", "Each student joins with their own AIFekr account.", "Jeder Student nutzt sein eigenes AIFekr-Konto.", "Her öğrenci kendi AIFekr hesabını kullanır.")}</p></div><button type="button" onClick={() => { void loadGroups(); if (active) void loadMessages(active); }} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "var(--border)" }}><RefreshCw size={14}/>{tri(lang, "تازه‌سازی", "Refresh", "Aktualisieren", "Yenile")}</button></div>
    <div className="grid gap-4 lg:grid-cols-[minmax(240px,.9fr)_minmax(0,1.5fr)]">
      <div className="space-y-3">
        <form onSubmit={createGroup} className="space-y-2 rounded-xl p-3" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}><label className="block text-xs font-medium">{tri(lang, "ساخت گروه مطالعه", "Create a study group", "Lerngruppe erstellen", "Çalışma grubu oluştur")}</label><input aria-label={tri(lang, "ساخت گروه مطالعه", "Create a study group", "Lerngruppe erstellen", "Çalışma grubu oluştur")} required value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={tri(lang, "نام گروه درسی", "Study group name", "Name der Lerngruppe", "Çalışma grubu adı")} className="w-full min-w-0 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}/><label className="block text-xs" style={{ color: "var(--text-secondary)" }}>{tri(lang, "درس گروه · اختیاری", "Group course · optional", "Kurs der Gruppe · optional", "Grup dersi · isteğe bağlı")}<select value={groupCourseId} onChange={(event) => setGroupCourseId(event.target.value)} className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}><option value="">{tri(lang, "بدون درس مشخص", "No specific course", "Kein bestimmter Kurs", "Belirli bir ders yok")}</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label><button disabled={busy || !name.trim()} aria-label={t.create} className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50" style={{ background: "#f97316" }}><Plus size={16}/>{t.create}</button></form>
        <form onSubmit={joinGroup} className="rounded-xl p-3" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}><label className="mb-2 block text-xs font-medium">{t.join}<span className="mt-1 block font-normal" style={{ color: "var(--text-secondary)" }}>{tri(lang, "کدی را وارد کن که سازندهٔ گروه برایت فرستاده است.", "Enter the code shared by the group creator.", "Gib den Code des Gruppenerstellers ein.", "Grubu kuranın gönderdiği kodu gir.")}</span></label><div className="flex gap-2"><input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} maxLength={64} autoComplete="off" placeholder={t.code} className="min-w-0 flex-1 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}/><button disabled={busy || !inviteCode.trim()} className="rounded-lg px-3 text-sm text-white disabled:opacity-50" style={{ background: "#f97316" }}>{tri(lang, "عضویت", "Join", "Beitreten", "Katıl")}</button></div></form>
        {!groups.length ? <p className="rounded-xl p-4 text-center text-sm leading-6" style={{ background: "var(--surface-0)", color: "var(--text-secondary)" }}>{t.empty}</p> : <div className="space-y-2">{groups.map((group) => <button key={group.id} type="button" onClick={() => setActive(group.id)} className="flex w-full items-center justify-between gap-2 rounded-xl p-3 text-start" style={{ background: active === group.id ? "rgba(249,115,22,.12)" : "var(--surface-0)", border: `1px solid ${active === group.id ? "rgba(249,115,22,.45)" : "var(--border)"}` }}><span className="min-w-0 truncate text-sm font-medium">{group.name}<small className="block font-normal" style={{ color: "var(--text-secondary)" }}>{group.course?.name ? `${group.course.name} · ` : ""}{group._count?.members ?? 1} {tri(lang, "دانشجو / عضو", "students / members", "Studierende / Mitglieder", "öğrenci / üye")}</small></span><span onClick={(event) => { event.stopPropagation(); void copyCode(group); }} role="button" tabIndex={0} title={tri(lang, "کپی کد دعوت", "Copy invite code", "Code kopieren", "Kodu kopyala")} className="rounded-lg p-2 hover:bg-black/5"><Copy size={15}/></span></button>)}</div>}
      </div>
      <div className="min-w-0 rounded-xl p-3" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}>
        {!selected ? <div className="grid min-h-56 place-items-center text-center text-sm" style={{ color: "var(--text-secondary)" }}>{tri(lang, "برای دیدن جزئیات و گفتگو، یک گروه را انتخاب کن.", "Select a group to see its details and messages.", "Wähle eine Gruppe für Details und Nachrichten.", "Detay ve mesajlar için bir grup seç.")}</div> : <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 text-sm font-semibold"><MessageSquareText size={16}/><span>{selected.name}{selected.course?.name && <small className="mt-0.5 block font-normal" style={{ color: "var(--text-secondary)" }}>{tri(lang, "مطالعهٔ درس", "Studying", "Lerngruppe für", "Ders")} · {selected.course.name}</small>}</span></div><span className="text-xs" style={{ color: "var(--text-secondary)" }}>{selected._count?.members || 1} {tri(lang, "عضو", "members", "Mitglieder", "üye")}</span></div>
          <div className="mb-3 rounded-xl p-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-xs font-semibold">{t.code}</div><p className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>{tri(lang, "این کد را کجا پیدا کنم؟ همین‌جاست؛ با دکمهٔ کپی برای هم‌دانشجویی بفرست یا از فرم دعوت ایمیلی استفاده کن.", "This is the group's code. Copy it to share, or invite a classmate by email below.", "Hier findest du den Code. Kopieren oder per E-Mail einladen.", "Grup kodu burada. Kopyala veya aşağıdan e-postayla davet et.")}</p></div><code dir="ltr" className="rounded-lg px-3 py-2 text-sm font-bold tracking-wider" style={{ background: "var(--surface-0)" }}>{selected.inviteCode}</code><button type="button" onClick={() => void copyCode(selected)} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "var(--border)" }}><Copy size={14}/>{tri(lang, "کپی کد", "Copy code", "Code kopieren", "Kodu kopyala")}</button></div>
            <form onSubmit={inviteByEmail} className="mt-3 flex flex-wrap gap-2"><input required type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} maxLength={254} placeholder={tri(lang, "ایمیل دانشجو مثل name@university.edu", "Student email, e.g. name@university.edu", "E-Mail der studierenden Person", "Öğrenci e-postası")} className="min-w-48 flex-1 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}/><button disabled={busy || !inviteEmail.trim()} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50" style={{ background: "#f97316" }}><MailPlus size={15}/>{tri(lang, "دعوت دانشجو با ایمیل", "Invite student by email", "Per E-Mail einladen", "E-postayla davet et")}</button></form>
          </div>
          <div className="max-h-64 min-h-36 space-y-2 overflow-y-auto" aria-live="polite">{messages.length ? messages.map((message) => <article key={message.id} className="rounded-lg p-2.5 text-sm" style={{ background: "var(--surface-1)" }}><div className="mb-1 flex justify-between gap-2 text-xs" style={{ color: "var(--text-secondary)" }}><span>{message.user.name || tri(lang, "دانشجوی گروه", "Group student", "Gruppenmitglied", "Grup üyesi")}</span><time>{new Intl.DateTimeFormat(locale, { dateStyle: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(message.createdAt))}</time></div><p className="whitespace-pre-wrap break-words">{message.content}</p></article>) : <div className="grid h-36 place-items-center text-sm" style={{ color: "var(--text-secondary)" }}>{tri(lang, "هنوز پیامی نیست؛ برنامهٔ مطالعه یا سوالت را با گروه هماهنگ کن.", "No messages yet. Start by sharing a study plan or question.", "Noch keine Nachrichten.", "Henüz mesaj yok.")}</div>}</div>
          <form onSubmit={sendMessage} className="mt-3 flex gap-2"><input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} placeholder={tri(lang, "پیام برای همهٔ اعضای گروه…", "Message all group members…", "Nachricht an die Gruppe…", "Grubun tüm üyelerine mesaj…")} className="min-w-0 flex-1 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}/><button disabled={busy || !draft.trim()} aria-label={t.send} title={t.send} className="rounded-lg px-3 text-white disabled:opacity-50" style={{ background: "#f97316" }}><Send size={16}/></button></form>
        </>}
      </div>
    </div>
    {error && <p role="alert" className="mt-3 rounded-lg p-2 text-xs" style={{ color: "#dc2626", background: "rgba(239,68,68,.08)" }}>{error}</p>}{notice && <p role="status" className="mt-3 rounded-lg p-2 text-xs" style={{ color: "#15803d", background: "rgba(34,197,94,.1)" }}>{notice}</p>}
  </section>;
}
