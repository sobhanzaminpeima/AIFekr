"use client";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import { tri, useTranslation } from "@/lib/i18n";
import { destinations, destinationLabel } from "@/lib/navigation/destinations";
import { WORKSPACES, workspaceById } from "@/lib/navigation/workspaces";
import { chooseWorkspace, useWorkspace } from "./WorkspaceNav";
import "./workspace-nav.css";

/**
 * Top of /home: answers "what can I do here, where do I start, what next"
 * for the chosen workspace. Without a workspace it offers the choice once
 * (no modal, no forced onboarding for existing users).
 */
export default function WorkspaceHome({ credits }: { credits?: number }) {
  const { lang } = useTranslation(), fa = lang === "fa";
  const t = (a: string, b: string) => tri(lang, a, b, b, b);
  const state = useWorkspace();
  if (!state?.enabled) return null;
  const ws = workspaceById(state.active);
  const Next = fa ? ArrowLeft : ArrowRight;
  const label = (href: string) => { const d = destinations.find(x => x[0] === href); return d ? destinationLabel(d, lang) : href; };
  if (!ws) return <section className="wh-pick" aria-label={t("انتخاب فضای کار", "Choose a workspace")}>
    <h2>{t("برای چه کاری از AIFekr استفاده می‌کنید؟", "What do you use AIFekr for?")}</h2>
    <p>{t("یکی را انتخاب کنید تا منو و این صفحه فقط ابزارهای مرتبط را اول نشان دهند. هر زمان قابل تغییر است و روی پلن و کردیت اثری ندارد.", "Pick one so the menu and this page show the relevant tools first. You can change it any time; it does not affect your plan or credits.")}</p>
    <div className="wh-cards">{WORKSPACES.map(w => <button key={w.id} className={state.suggested === w.id ? "is-suggested" : ""} onClick={() => void chooseWorkspace(state, w.id)}><strong>{w.name[fa ? 0 : 1]}</strong><span>{w.tagline[fa ? 0 : 1]}</span></button>)}</div>
  </section>;
  const quick = ws.groups.flatMap(g => g.hrefs.slice(0, 2)).slice(0, 6);
  return <section className="wh" aria-label={ws.name[fa ? 0 : 1]}>
    <div className="wh-head"><div><span className="wh-eyebrow">{t("فضای کار", "Workspace")} · {ws.name[fa ? 0 : 1]}</span><h2>{ws.tagline[fa ? 0 : 1]}</h2></div>
      {credits != null && <Link href="/credits" className="wh-credits">{credits.toLocaleString(lang)} {t("کردیت", "credits")}</Link>}</div>
    <Link href={ws.start.href} className="wh-start"><span><small>{t("پیشنهاد برای شروع", "Suggested next step")}</small><strong>{ws.start.label[fa ? 0 : 1]}</strong></span><Next className="w-5 h-5"/></Link>
    <div className="wh-quick">{quick.map(href => <Link key={href} href={href}>{label(href)}</Link>)}</div>
    <button className="wh-search" onClick={() => dispatchEvent(new Event("aifekr:open-command-palette"))}><Search className="w-4 h-4"/>{t("دنبال کار دیگری هستید؟ بنویسید چه می‌خواهید…", "Looking for something else? Type what you want to do…")}</button>
  </section>;
}
