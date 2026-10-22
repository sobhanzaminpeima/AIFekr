import {getServerLang} from "@/lib/i18n/server";
import EntryPlans from "@/components/ai-chat/EntryPlans";
export const dynamic="force-dynamic";
export const metadata={title:"Choose your AIFekr package",robots:{index:false,follow:true}};
export default async function Page({searchParams}:{searchParams:{group?:string}}){return <EntryPlans lang={await getServerLang()} initialGroup={searchParams.group}/>;}
