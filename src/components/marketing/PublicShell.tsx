import Link from "@/components/marketing/PublicLink";
import Image from "next/image";
import type { ReactNode } from "react";
import type { Lang } from "@/lib/i18n/server";
import PublicNav from "./PublicNav";
import SocialFooterLinks from "@/components/layout/SocialFooterLinks";
import EnamadBadge from "@/components/layout/EnamadBadge";
import CurrencySelector from "@/components/ui/CurrencySelector";
import { copy, text, features, solutionCatalog } from "@/lib/marketing/catalog";
import "./public.css";

export default function PublicShell({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <div className="marketing" dir={lang === "fa" ? "rtl" : "ltr"}>
    <a className="m-skip" href="#public-content">{text(lang, copy.skip)}</a>
    <PublicNav lang={lang}/><main id="public-content">{children}</main>
    <footer className="m-footer"><div className="m-container m-footer-grid">
      <div><Link href="/" className="m-brand"><Image src="/logo.svg" alt="" width={38} height={38}/><span>AI<span>Fekr</span></span></Link><p>{text(lang, copy.intro)}</p><SocialFooterLinks/></div>
      <div><h2>{text(lang, copy.product)}</h2>{features.filter(f => ["assistant", "agents", "crm", "social", "content", "education"].includes(f.slug)).map(f => <Link href={`/features/${f.slug}`} key={f.slug}>{text(lang, f.title)}</Link>)}</div>
      <div><h2>{text(lang, copy.solutions)}</h2>{solutionCatalog.map(s => <Link href={`/solutions/${s.slug}`} key={s.slug}>{text(lang, s.title)}</Link>)}<Link href="/industry">{text(lang, copy.industries)}</Link><Link href="/pricing">{text(lang, copy.pricing)}</Link></div>
      <div><h2>{text(lang, copy.resources)}</h2>{(["about", "contact", "security", "privacy", "terms"] as const).map(key => <Link href={`/${key}`} key={key}>{text(lang, copy[key])}</Link>)}<Link href="/guides">{text(lang, ["راهنماهای کاربردی", "Practical guides", "Praxisleitfäden", "Pratik rehberler"])}</Link><div className="m-currency-preference"><span>{text(lang, ["واحد پول حساب", "Account currency", "Kontowährung", "Hesap para birimi"])}</span><CurrencySelector/><small>{text(lang, ["قیمت عمومی به واحد درج‌شده نمایش داده می‌شود.", "Public prices use their listed currency.", "Öffentliche Preise in der angegebenen Währung.", "Genel fiyatlar belirtilen para birimindedir."])}</small></div><EnamadBadge/></div>
    </div><div className="m-container m-footer-bottom"><span>© {new Date().getFullYear()} AIFekr</span><span>{text(lang, copy.noPromise)}</span></div></footer>
  </div>;
}
