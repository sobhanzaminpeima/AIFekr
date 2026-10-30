import {getServerLang} from "@/lib/i18n/server";
import EntryPlans from "@/components/ai-chat/EntryPlans";
export const dynamic="force-dynamic";
export const metadata={title:"Choose your AIFekr package",robots:{index:false,follow:true}};
export default async function Page(props:{searchParams: Promise<{group?:string;plan?:string}>}) {
  const searchParams = await props.searchParams;
  return <EntryPlans lang={await getServerLang()} initialGroup={searchParams.group} initialPlan={searchParams.plan}/>;
}
