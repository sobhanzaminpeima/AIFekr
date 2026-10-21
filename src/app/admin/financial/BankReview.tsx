"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation,tri } from "@/lib/i18n";
export default function BankReview({id}:{id:string}){
 const {lang}=useTranslation(),router=useRouter();const [note,setNote]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const t=(a:string,b:string,c:string,d:string)=>tri(lang,a,b,c,d);
 async function review(action:string){if(action==="approve"&&!confirm(t("انتقال بانکی را بررسی کردید؟ با تأیید، اشتراک و کمیسیون ثبت می‌شود.","Have you verified the bank transfer? Approval activates the subscription and commission.","Bankeingang geprüft? Die Freigabe aktiviert Abo und Provision.","Banka transferini doğruladınız mı? Onay aboneliği ve komisyonu etkinleştirir.")))return;setBusy(true);try{const r=await fetch(`/api/admin/payments/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,note})});const d=await r.json();if(!r.ok)throw Error(d.error);router.refresh();}catch(e){setError(e instanceof Error?e.message:"Error");}finally{setBusy(false);}}
 return <div className="space-y-2"><a href={`/api/payment/${id}/receipt`} className="text-orange-500">{t("دریافت رسید","Download receipt","Beleg herunterladen","Dekont indir")}</a><input value={note} onChange={e=>setNote(e.target.value)} maxLength={1000} placeholder={t("توضیح بررسی (برای رد الزامی)","Review note (required for rejection)","Prüfnotiz (bei Ablehnung erforderlich)","İnceleme notu (ret için gerekli)")} className="bg-transparent border rounded p-2 w-full"/><div className="flex gap-3"><button disabled={busy} onClick={()=>review("approve")} className="text-green-500">{t("تأیید","Approve","Freigeben","Onayla")}</button><button disabled={busy||!note.trim()} onClick={()=>review("reject")} className="text-red-500">{t("رد","Reject","Ablehnen","Reddet")}</button></div>{error&&<p role="alert">{error}</p>}</div>;
}
