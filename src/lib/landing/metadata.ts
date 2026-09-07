import type { Metadata } from "next";
import type { UiLocale } from "@/lib/i18n/foundation";
import { landingCopy } from "@/lib/i18n/landing";
export function landingMetadata(locale:UiLocale):Metadata {
 const s=landingCopy[locale];
 return {metadataBase:new URL('https://aifekr.com'),title:s.metaTitle,description:s.metaDescription,alternates:{canonical:`/${locale}`,languages:{fa:'/fa',en:'/en',de:'/de','x-default':'/'}},openGraph:{title:s.metaTitle,description:s.metaDescription,type:'website',locale:locale==='fa'?'fa_IR':locale==='de'?'de_DE':'en_US',url:`/${locale}`,siteName:'AiFekr'}};
}
