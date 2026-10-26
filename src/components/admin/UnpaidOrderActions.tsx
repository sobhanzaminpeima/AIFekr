"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {tri,useTranslation} from "@/lib/i18n";
export default function UnpaidOrderActions({id,receipt=false}:{id:string;receipt?:boolean}){
 const {lang}=useTranslation(),t=(fa:string,en:string,de:string,tr:string)=>tri(lang,fa,en,de,tr),router=useRouter();
 const [busy,setBusy]=useState(false),[note,setNote]=useState(""),[message,setMessage]=useState(""),[url,setUrl]=useState("");
 async function act(action:"cancel"|"continue"){
  setBusy(true);setMessage("");try{const response=await fetch(`/api/admin/payments/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,note:action==="cancel"?note:"Continue pending payment"})});const data=await response.json();if(!response.ok)throw Error(data.error||"REQUEST_FAILED");
   if(data.url)setUrl(new URL(data.url,location.origin).toString());
   else if(data.status==="SUCCESS"){setMessage(t("پرداخت قبلاً انجام شده بود؛ تأیید و فعال شد.","Payment was already completed and has been verified.","Die bereits erfolgte Zahlung wurde bestätigt.","Ödeme zaten tamamlanmış ve doğrulanmıştır."));router.refresh();} else {setMessage(t("سفارش لغو شد؛ سوابق محفوظ است.","Order cancelled; history retained.","Bestellung storniert; Verlauf bleibt erhalten.","Sipariş iptal edildi; kayıtlar korundu."));router.refresh();}
  }catch(error){setMessage(error instanceof Error?error.message:"REQUEST_FAILED");}finally{setBusy(false);}
 }
 return <section className="mt-3 space-y-2 rounded-xl border border-[var(--border)] p-3 text-sm"><button disabled={busy} onClick={()=>void act("continue")} className="min-h-11 rounded-lg border border-[var(--border)] px-3">{t("لینک ادامهٔ پرداخت","Get payment continuation link","Link zur Fortsetzung","Ödemeye devam bağlantısı")}</button>{url&&<div><input aria-label={t("لینک پرداخت","Payment link","Zahlungslink","Ödeme bağlantısı")} readOnly value={url} dir="ltr" className="w-full rounded-lg p-2"/><button onClick={()=>void navigator.clipboard.writeText(url)}>{t("کپی لینک برای کاربر","Copy link for customer","Link für Kunden kopieren","Müşteri için bağlantıyı kopyala")}</button></div>}
 {!receipt&&<><label className="block">{t("دلیل لغو سفارش پرداخت‌نشده","Reason for cancelling unpaid order","Grund für die Stornierung","Ödenmemiş siparişin iptal nedeni")}<input className="mt-1 w-full rounded-lg border border-[var(--border)] p-2" value={note} maxLength={1000} onChange={e=>setNote(e.target.value)}/></label><button disabled={busy||note.trim().length<3} onClick={()=>{if(confirm(t("فقط سفارش پرداخت‌نشده لغو می‌شود؛ این کار برگشت وجه درگاه نیست. ادامه می‌دهید؟","Cancel the unpaid order? This does not refund a gateway payment.","Unbezahlte Bestellung stornieren? Dies ist keine Rückerstattung.","Ödenmemiş sipariş iptal edilsin mi? Bu işlem para iadesi değildir.")))void act("cancel");}} className="min-h-11 rounded-lg border border-red-500/40 px-3 text-red-500 disabled:opacity-40">{t("لغو کامل سفارش","Cancel order","Bestellung stornieren","Siparişi iptal et")}</button></>}
 {receipt&&<p>{t("رسید ارسال شده است؛ از تأیید یا رد رسید استفاده کنید.","A receipt exists. Use approve/reject receipt.","Beleg vorhanden. Bitte genehmigen oder ablehnen.","Dekont var. Onayla/reddet işlemini kullanın.")}</p>}{message&&<p role="status">{message}</p>}</section>;
}
