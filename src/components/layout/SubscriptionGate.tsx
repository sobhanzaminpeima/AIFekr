"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useEffect,useState} from "react";
import {tri,type Lang} from "@/lib/i18n";
export default function SubscriptionGate({expired,expiresAt,lang,children,overlay}:{expired:boolean;expiresAt?:string|null;lang:Lang;children:React.ReactNode;overlay?:React.ReactNode}){
 const [isExpired,setExpired]=useState(expired);
 useEffect(()=>{
  setExpired(expired);
  let timer:ReturnType<typeof setTimeout>;
  const tick=()=>{if(!expiresAt)return;const left=new Date(expiresAt).getTime()-Date.now();if(left<=0)setExpired(true);else timer=setTimeout(tick,Math.min(left,86400000));};
  const onExpire=()=>setExpired(true);window.addEventListener("aifekr:subscription-expired",onExpire);tick();
  return()=>{clearTimeout(timer);window.removeEventListener("aifekr:subscription-expired",onExpire);};
 },[expired,expiresAt]);
 const path=usePathname();
 const recovery=["/profile","/settings","/plans","/pricing","/checkout","/wallet","/support","/credits"].some(p=>path===p||path.startsWith(p+"/"));
 if(!isExpired)return <>{children}{overlay}</>;
 const banner=<div role="alert" className="m-4 rounded-2xl border p-5 space-y-3" style={{background:"var(--surface-1)",borderColor:"var(--border)",color:"var(--text-primary)"}}><h2 className="font-bold">{tri(lang,"اشتراک شما منقضی شده است","Your subscription has expired","Ihr Abonnement ist abgelaufen","Aboneliğiniz sona erdi")}</h2><p className="text-sm">{tri(lang,"چت و سایر امکانات تا تمدید پکیج غیرفعال هستند. اطلاعات و کریدت باقی‌ماندهٔ شما محفوظ است.","Chat and other features are paused until renewal. Your data and remaining credits are retained.","Chat und Funktionen sind bis zur Verlängerung pausiert. Daten und Credits bleiben erhalten.","Sohbet ve özellikler yenilemeye kadar duraklatıldı. Verileriniz ve krediniz korunur.")}</p><Link href="/pricing" className="inline-block rounded-xl px-4 py-2 font-semibold text-white" style={{background:"var(--primary)"}}>{tri(lang,"تمدید پکیج","Renew package","Paket verlängern","Paketi yenile")}</Link></div>;
 return <>{banner}{recovery&&children}</>;
}
