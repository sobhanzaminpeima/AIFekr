import HomeLanding from "@/components/landing/home/HomeLanding";
import { getServerLang } from "@/lib/i18n/server";
import { landingMetadata } from "@/lib/landing/metadata";
export const dynamic = "force-dynamic";
export async function generateMetadata(){return landingMetadata(await getServerLang());}
export default async function HomePage(){return <HomeLanding locale={await getServerLang()}/>;}
