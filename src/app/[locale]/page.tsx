import { notFound } from "next/navigation";
import HomeLanding from "@/components/landing/home/HomeLanding";
import { isLandingLocale } from "@/lib/i18n/landing";
import { landingMetadata } from "@/lib/landing/metadata";
export const dynamic = "force-dynamic";
export async function generateMetadata(props:{params: Promise<{locale:string}>}) {
  const params = await props.params;
  if(!isLandingLocale(params.locale))notFound();return landingMetadata(params.locale);
}
export default async function LocalizedHome(props:{params: Promise<{locale:string}>}) {
  const params = await props.params;
  if(!isLandingLocale(params.locale))notFound();return <HomeLanding locale={params.locale}/>;
}
