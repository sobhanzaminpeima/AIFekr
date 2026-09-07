import { notFound } from "next/navigation";
import HomeLanding from "@/components/landing/home/HomeLanding";
import { isLandingLocale } from "@/lib/i18n/landing";
import { landingMetadata } from "@/lib/landing/metadata";
export const dynamic = "force-dynamic";
export function generateMetadata({params}:{params:{locale:string}}){if(!isLandingLocale(params.locale))notFound();return landingMetadata(params.locale);}
export default function LocalizedHome({params}:{params:{locale:string}}){if(!isLandingLocale(params.locale))notFound();return <HomeLanding locale={params.locale}/>;}
