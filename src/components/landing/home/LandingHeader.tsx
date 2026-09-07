"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpLeft, ArrowUpRight, Globe2, Menu, X } from "lucide-react";
import ThemeSwitcher from "@/components/ui/ThemeSwitcher";
import { landingCopy } from "@/lib/i18n/landing";
import type { UiLocale } from "@/lib/i18n/foundation";

export const sectionLinks = ["#capabilities", "#how-it-works", "#pricing", "#faq"];
export default function LandingHeader({locale}:{locale:UiLocale}) {
 const s=landingCopy[locale]; const [open,setOpen]=useState(false);const toggle=useRef<HTMLButtonElement>(null);const Arrow=locale==='fa'?ArrowUpLeft:ArrowUpRight;
 useEffect(()=>{if(!open)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);toggle.current?.focus();}};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close);},[open]);
 function changeLocale(value:string){
   // Public German pages hand over to the existing English app until its migration.
   document.cookie=`lang=${value==='fa'?'fa':'en'}; path=/; max-age=31536000; SameSite=Lax`;
   window.location.assign(`/${value}`);
 }
 return <header className="lp-header"><div className="lp-shell lp-header-inner">
  <Link href={`/${locale}`} className="lp-brand" aria-label="AiFekr"><Image src="/logo.svg" alt="" width={34} height={34}/><span>AiFekr<span className="lp-brand-dot">.</span></span></Link>
  <nav className="lp-desktop-nav" aria-label={s.footerProduct}>{sectionLinks.map((href,i)=><a key={href} href={href}>{s.nav[i]}</a>)}</nav>
  <div className="lp-header-controls">
   <label className="lp-locale"><Globe2 size={16} aria-hidden="true"/><span className="sr-only">{s.language}</span><select value={locale} onChange={e=>changeLocale(e.target.value)}><option value="fa">فارسی</option><option value="en">EN</option><option value="de">DE</option></select></label>
   <ThemeSwitcher locale={locale} iconOnly className="lp-theme"/>
   <Link className="lp-login" href="/login">{s.login}</Link>
   <Link className="ui-button lp-header-start" href="/register">{s.start}<Arrow size={16} aria-hidden="true"/></Link>
   <button type="button" className="ui-button ui-button--secondary ui-button--icon lp-menu-toggle" ref={toggle} onClick={()=>setOpen(!open)} aria-label={open?s.closeMenu:s.menu} aria-expanded={open} aria-controls="landing-mobile-nav">{open?<X aria-hidden="true"/>:<Menu aria-hidden="true"/>}</button>
  </div>
 </div><nav id="landing-mobile-nav" className="lp-mobile-nav lp-shell" hidden={!open} aria-label={s.menu}>{sectionLinks.map((href,i)=><a key={href} href={href} onClick={()=>setOpen(false)}>{s.nav[i]}</a>)}<Link href="/login">{s.login}</Link><Link className="ui-button" href="/register">{s.start}</Link></nav></header>;
}
