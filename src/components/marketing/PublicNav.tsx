"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState, useEffect } from "react";
import { ArrowUpRight, ChevronDown, Menu, X } from "lucide-react";
import type { Lang } from "@/lib/i18n/server";
import { copy, features, solutionCatalog, text, type Copy } from "@/lib/marketing/catalog";

export default function PublicNav({ lang }: { lang: Lang }) {
  const [mobile, setMobile] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const close = (e: PointerEvent) => { if (!nav.current?.contains(e.target as Node)) { setOpen(null); setMobile(false); } };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const groups: { id: string; label: Copy; links: { href: string; title: Copy; desc?: Copy }[] }[] = [
    { id: "product", label: copy.product, links: features.filter(f => f.category === "work").map(f => ({ href: `/features/${f.slug}`, title: f.title, desc: f.desc })) },
    { id: "solutions", label: copy.solutions, links: solutionCatalog.map(s => ({ href: `/solutions/${s.slug}`, title: s.title })) },
    { id: "tools", label: copy.tools, links: features.filter(f => f.category !== "work").map(f => ({ href: `/features/${f.slug}`, title: f.title, desc: f.desc })) },
    { id: "resources", label: copy.resources, links: [{ href: "/ai-team", title: features.find(f => f.slug === "agents")!.title }, { href: "/about", title: copy.about }, { href: "/contact", title: copy.contact }, { href: "/security", title: copy.security }] },
  ];
  return <header className="m-nav-wrap"><nav className="m-nav" ref={nav} aria-label={text(lang, copy.menu)} onKeyDown={e => { if (e.key === "Escape") { if (mobile || open) nav.current?.querySelector<HTMLButtonElement>(mobile ? ".m-menu-toggle" : `[aria-controls="nav-${open}"]`)?.focus(); setOpen(null); setMobile(false); } }}>
    <Link className="m-brand" href="/" aria-label="AIFekr"><Image src="/logo.svg" alt="" width={36} height={36} priority /><span>AI<span>Fekr</span></span></Link>
    <div className={`m-nav-links ${mobile ? "is-open" : ""}`}>
      {groups.map(group => <div className="m-nav-group" key={group.id}>
        <button aria-expanded={open === group.id} aria-controls={`nav-${group.id}`} onClick={() => setOpen(open === group.id ? null : group.id)}>{text(lang, group.label)}<ChevronDown size={13} /></button>
        {open === group.id && <div id={`nav-${group.id}`} className="m-mega">
          <span className="m-eyebrow">{text(lang, group.label)}</span>
          <div className="m-mega-grid">{group.links.map(link => <Link href={link.href} key={link.href} onClick={() => { setOpen(null); setMobile(false); }}><span>{text(lang, link.title)} <ArrowUpRight size={15}/></span>{link.desc && <small>{text(lang, link.desc)}</small>}</Link>)}</div>
        </div>}
      </div>)}
      <Link href="/industry">{text(lang, copy.industries)}</Link><Link href="/pricing">{text(lang, copy.pricing)}</Link>
      <Link className="m-mobile-login" href="/login">{text(lang, copy.login)}</Link>
    </div>
    <div className="m-nav-actions">
      <select aria-label={lang === "fa" ? "زبان" : lang === "de" ? "Sprache" : lang === "tr" ? "Dil" : "Language"} value={lang} onChange={e => { const next = e.target.value; document.cookie = `lang=${next}; path=/; max-age=31536000; SameSite=Lax`; try { localStorage.setItem("lang", next); } catch {} window.location.reload(); }}>
        <option value="fa">فارسی</option><option value="en">EN</option><option value="de">DE</option><option value="tr">TR</option>
      </select>
      <Link className="m-desktop-login" href="/login">{text(lang, copy.login)}</Link>
      <Link className="m-button m-small" href="/register">{text(lang, copy.start)}</Link>
      <button className="m-menu-toggle" aria-label={text(lang, copy.menu)} aria-expanded={mobile} onClick={() => { setMobile(!mobile); setOpen(null); }}>{mobile ? <X size={21}/> : <Menu size={21}/>}</button>
    </div>
  </nav></header>;
}
