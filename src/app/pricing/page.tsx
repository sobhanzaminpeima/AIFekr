import {getServerLang} from "@/lib/i18n/server";
import JsonLd from "@/components/seo/JsonLd";
import { pageJsonLd as pageJsonLd } from "@/lib/seo/site";
import { tri as tri } from "@/lib/i18n/tri";
import {copy,text} from "@/lib/marketing/catalog";
import {pageMetadata} from "@/lib/seo/site";
import PublicShell from "@/components/marketing/PublicShell";
import EntryPlans from "@/components/ai-chat/EntryPlans";
export const dynamic="force-dynamic";
export async function generateMetadata(){const lang=await getServerLang();return pageMetadata(lang,"/pricing",{fa:copy.pricing[0],en:copy.pricing[1],de:copy.pricing[2],tr:copy.pricing[3]},{fa:copy.plansDesc[0],en:copy.plansDesc[1],de:copy.plansDesc[2],tr:copy.plansDesc[3]});}
export default async function Page(){const lang=await getServerLang();return <PublicShell lang={lang}><JsonLd data={pageJsonLd(lang, "/pricing", "WebPage", tri(lang, "قیمت پکیج‌های AIFekr", "AIFekr pricing", "AIFekr Preise", "AIFekr fiyatları"))}/><section className="m-container" style={{paddingTop:40}}><h1 className="m-section-title">{text(lang,["قیمت پکیج‌های AIFekr","AIFekr plans and pricing","AIFekr-Pakete und Preise","AIFekr paketler ve fiyatlar"])}</h1></section><EntryPlans lang={lang} embedded/></PublicShell>;}
