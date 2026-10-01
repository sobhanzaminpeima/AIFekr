"use client";

import { useEffect, useState } from "react";
import { Copy, MessageSquareText, Plus, Send, Users } from "lucide-react";
import { tri, type Lang } from "@/lib/i18n";

type Group = { id: string; name: string; inviteCode: string; ownerId: string; _count?: { members: number } };
type Message = { id: string; content: string; createdAt: string; user: { id: string; name: string | null } };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

export default function StudentStudyGroups({ lang }: { lang: Lang }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [active, setActive] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const t = {
    title: tri(lang, "گروه‌های مطالعه", "Study groups", "Lerngruppen", "Çalışma grupları"),
    intro: tri(lang, "گروه بساز یا با کد دعوت به گروه هم‌کلاسی‌ها بپیوند. گفتگو فقط برای اعضای گروه قابل مشاهده است.", "Create a group or join classmates with an invite code. Conversations are visible only to group members.", "Erstelle eine Gruppe oder tritt per Einladungscode bei. Nachrichten sehen nur Mitglieder.", "Grup oluştur veya davet koduyla katıl. Mesajları yalnızca üyeler görür."),
    create: tri(lang, "ساخت گروه", "Create group", "Gruppe erstellen", "Grup oluştur"),
    join: tri(lang, "عضویت", "Join", "Beitreten", "Katıl"),
    empty: tri(lang, "هنوز گروهی نداری.", "No study groups yet.", "Noch keine Lerngruppe.", "Henüz grup yok."),
    send: tri(lang, "ارسال", "Send", "Senden", "Gönder"),
    code: tri(lang, "کد دعوت", "Invite code", "Einladungscode", "Davet kodu"),
    copied: tri(lang, "کد کپی شد", "Invite code copied", "Code kopiert", "Kod kopyalandı"),
  };

  async function loadGroups() {
    try {
      const result = await request<{ groups: Group[] }>("/api/student/groups");
      setGroups(result.groups);
      setActive((current) => current && result.groups.some((group) => group.id === current) ? current : result.groups[0]?.id || "");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load groups"); }
  }
  useEffect(() => { void loadGroups(); }, []);
  useEffect(() => {
    if (!active) { setMessages([]); return; }
    let cancelled = false;
    request<{ messages: Message[] }>(`/api/student/groups/${active}/messages`).then((result) => { if (!cancelled) setMessages(result.messages); }).catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load messages"); });
    return () => { cancelled = true; };
  }, [active]);

  async function createGroup(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const { group } = await request<{ group: Group }>("/api/student/groups", { method: "POST", body: JSON.stringify({ name }) }); setName(""); await loadGroups(); setActive(group.id); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not create group"); } finally { setBusy(false); }
  }
  async function joinGroup(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const { groupId } = await request<{ groupId: string }>("/api/student/groups/join", { method: "POST", body: JSON.stringify({ inviteCode }) }); setInviteCode(""); await loadGroups(); setActive(groupId); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not join group"); } finally { setBusy(false); }
  }
  async function sendMessage(event: React.FormEvent) {
    event.preventDefault(); if (!active || !draft.trim()) return; setBusy(true); setError("");
    try { const { message } = await request<{ message: Message }>(`/api/student/groups/${active}/messages`, { method: "POST", body: JSON.stringify({ content: draft }) }); setDraft(""); setMessages((current) => [...current, message].slice(-100)); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not send message"); } finally { setBusy(false); }
  }

  return <section className="mt-6 rounded-2xl p-5 md:p-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
    <h2 className="font-semibold text-lg flex items-center gap-2"><Users size={19} color="#f97316"/>{t.title}</h2>
    <p className="text-xs mt-1 mb-4" style={{ color: "var(--text-secondary)" }}>{t.intro}</p>
    <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]">
      <div className="space-y-3">
        <form onSubmit={createGroup} className="flex gap-2"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={tri(lang,"نام گروه","Group name","Gruppenname","Grup adı")} className="min-w-0 flex-1 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}/><button disabled={busy || !name.trim()} aria-label={t.create} className="rounded-lg px-3 text-white disabled:opacity-50" style={{ background: "#f97316" }}><Plus size={17}/></button></form>
        <form onSubmit={joinGroup} className="flex gap-2"><input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} maxLength={64} placeholder={t.code} className="min-w-0 flex-1 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}/><button disabled={busy || !inviteCode.trim()} className="rounded-lg px-3 text-sm border disabled:opacity-50" style={{ borderColor: "var(--border)" }}>{t.join}</button></form>
        {groups.length === 0 ? <p className="py-4 text-center text-sm" style={{ color: "var(--text-secondary)" }}>{t.empty}</p> : groups.map((group) => <button key={group.id} onClick={() => setActive(group.id)} className="flex w-full items-center justify-between gap-2 rounded-lg p-3 text-start" style={{ background: active === group.id ? "rgba(249,115,22,.12)" : "var(--surface-0)", border: `1px solid ${active === group.id ? "rgba(249,115,22,.45)" : "var(--border)"}` }}><span className="truncate text-sm font-medium">{group.name}<small className="block font-normal" style={{ color: "var(--text-secondary)" }}>{group._count?.members ?? 1} {tri(lang,"عضو","members","Mitglieder","üye")}</small></span><span title={t.copied} onClick={(event) => { event.stopPropagation(); void navigator.clipboard.writeText(group.inviteCode).then(() => setError(t.copied)); }} className="rounded p-1.5 hover:bg-black/5"><Copy size={15}/></span></button>)}
      </div>
      <div className="flex min-h-56 flex-col rounded-xl p-3" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}>
        <div className="mb-2 flex items-center gap-2 text-sm font-medium"><MessageSquareText size={16}/>{groups.find((group) => group.id === active)?.name || t.title}</div>
        <div className="max-h-64 flex-1 space-y-2 overflow-y-auto">{messages.map((message) => <article key={message.id} className="rounded-lg p-2 text-sm" style={{ background: "var(--surface-1)" }}><div className="mb-1 flex justify-between gap-2 text-xs" style={{ color: "var(--text-secondary)" }}><span>{message.user.name || tri(lang,"دانشجو","Student","Student","Öğrenci")}</span><time>{new Intl.DateTimeFormat(lang === "fa" ? "fa-IR" : lang === "de" ? "de-DE" : lang === "tr" ? "tr-TR" : "en-US", { hour: "2-digit", minute: "2-digit" }).format(new Date(message.createdAt))}</time></div><p className="whitespace-pre-wrap break-words">{message.content}</p></article>)}</div>
        {active && <form onSubmit={sendMessage} className="mt-3 flex gap-2"><input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} placeholder={tri(lang,"پیام گروه…","Message the group…","Nachricht…","Gruba mesaj…")} className="min-w-0 flex-1 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}/><button disabled={busy || !draft.trim()} aria-label={t.send} className="rounded-lg px-3 text-white disabled:opacity-50" style={{ background: "#f97316" }}><Send size={16}/></button></form>}
      </div>
    </div>
    {error && <p role="status" className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>{error}</p>}
  </section>;
}
