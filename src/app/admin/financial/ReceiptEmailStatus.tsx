"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {useTranslation,tri} from "@/lib/i18n";
export default function ReceiptEmailStatus({id,accepted}:{id:string;accepted:boolean}){
 const {lang}=useTranslation(),router=useRouter();const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function retry(){setBusy(true);setMessage("");try{const response=await fetch(`/api/admin/payments/${id}/notify`,{method:"POST"});const data=await response.json();if(!response.ok)throw new Error(data.error||"Email unavailable");setMessage(tri(lang,"سرویس ایمیل ارسال را پذیرفت؛ پوشه اسپم را هم بررسی کنید.","Email accepted by provider; also check spam.","Versand angenommen; auch Spam prüfen.","E-posta kabul edildi; spam klasörünü kontrol edin."));router.refresh();}catch(error){setMessage(error instanceof Error?error.message:"Error");}finally{setBusy(false);}}
 return <div className="text-xs space-y-2"><p>{accepted?tri(lang,"اعلان رسید توسط سرویس ایمیل پذیرفته شده است.","Receipt notification accepted by email provider.","Belegbenachrichtigung vom E-Mail-Dienst angenommen.","Dekont bildirimi e-posta sağlayıcısı tarafından kabul edildi."):tri(lang,"ارسال ایمیل ناموفق یا در انتظار تلاش مجدد است.","Email failed or is waiting for retry.","E-Mail fehlgeschlagen oder wartet auf Wiederholung.","E-posta başarısız veya yeniden denemeyi bekliyor.")}</p><button disabled={busy} onClick={()=>void retry()} className="rounded-lg border px-3 py-2 disabled:opacity-50">{tri(lang,"ارسال مجدد اعلان رسید","Resend receipt notification","Belegbenachrichtigung erneut senden","Dekont bildirimini tekrar gönder")}</button>{message&&<p role="status">{message}</p>}</div>;
}
