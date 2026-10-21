import {getServerLang} from "@/lib/i18n/server";
import EntryPlans from "@/components/ai-chat/EntryPlans";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:{group?:string}}){return <EntryPlans lang={await getServerLang()} initialGroup={searchParams.group}/>;}
