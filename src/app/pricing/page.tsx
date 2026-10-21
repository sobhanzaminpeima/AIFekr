import {getServerLang} from "@/lib/i18n/server";
import {copy} from "@/lib/marketing/catalog";
import {pageMetadata} from "@/lib/seo/site";
import PublicShell from "@/components/marketing/PublicShell";
import EntryPlans from "@/components/ai-chat/EntryPlans";
export const dynamic="force-dynamic";
export async function generateMetadata(){const lang=await getServerLang();return pageMetadata(lang,"/pricing",{fa:copy.pricing[0],en:copy.pricing[1],de:copy.pricing[2],tr:copy.pricing[3]},{fa:copy.plansDesc[0],en:copy.plansDesc[1],de:copy.plansDesc[2],tr:copy.plansDesc[3]});}
export default async function Page(){const lang=await getServerLang();return <PublicShell lang={lang}><EntryPlans lang={lang} embedded/></PublicShell>;}
