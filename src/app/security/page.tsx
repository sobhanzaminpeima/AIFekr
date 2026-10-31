import { getServerLang } from "@/lib/i18n/server";
import { copy, text } from "@/lib/marketing/catalog";
import { LEGAL_META, legalPage } from "@/lib/marketing/legal";
import { pageMetadata, pageJsonLd } from "@/lib/seo/site";
import PublicShell from "@/components/marketing/PublicShell";
import JsonLd from "@/components/seo/JsonLd";
import Link from "@/components/marketing/PublicLink";
export const dynamic = "force-dynamic";
export async function generateMetadata() { const lang = await getServerLang(); return pageMetadata(lang, "/security", ...LEGAL_META.security); }
export default async function SecurityPage() { const lang = await getServerLang(); return <PublicShell lang={lang}><JsonLd data={pageJsonLd(lang, "/security")}/><section className="m-detail-hero"><div className="m-container"><span className="m-eyebrow">AIFekr</span><h1>{text(lang, copy.security)}</h1></div></section><section className="m-container m-section m-prose">{legalPage(lang, "security").sections.map(s => <article key={s.title}><h2>{s.title}</h2><p>{s.body}</p></article>)}<div className="m-actions"><Link className="m-button m-secondary" href="/privacy">{text(lang, copy.privacy)}</Link><Link className="m-button m-secondary" href="/contact">{text(lang, copy.contact)}</Link></div></section></PublicShell>; }
