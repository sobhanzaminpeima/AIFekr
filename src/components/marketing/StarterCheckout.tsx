"use client";
import {useState} from "react";
import {text} from "@/lib/marketing/catalog";
import type {Lang} from "@/lib/i18n/server";
export default function StarterCheckout({lang,plan,available,returnTo="/start",buttonLabel}:{lang:Lang;plan:string;available:boolean;returnTo?:"/start"|"/choose-plan";buttonLabel?:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 async function buy(){setBusy(true);setError("");try{
  const currency=lang==="fa"?"IRT":lang==="tr"?"TRY":"USD";
  const r=await fetch("/api/billing/quote",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({plan,period:"monthly",currency})});
  if(r.status===401){window.location.assign(`/register?entry=chat&redirect=${encodeURIComponent(returnTo)}`);return;}
  const q=await r.json();if(!r.ok)throw Error(q.error||"QUOTE_FAILED");
  const p=await fetch("/api/payment/create",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({plan,period:"monthly",currency:currency==="IRT"?"IRR":currency,quoteId:q.quote.id})}),d=await p.json();
  if(!p.ok||!d.paymentUrl)throw Error(d.error||"PAYMENT_UNAVAILABLE");window.location.assign(d.paymentUrl);
 }catch{setError(text(lang,["اتصال به پرداخت انجام نشد؛ دوباره تلاش کنید.","Could not open payment. Please retry.","Zahlung konnte nicht geöffnet werden. Bitte erneut versuchen.","Ödeme açılamadı. Lütfen tekrar deneyin."]));}finally{setBusy(false);}}
 return <><button className="m-button" disabled={!available||busy} onClick={()=>void buy()}>{!busy&&buttonLabel?buttonLabel:text(lang,busy?["در حال اتصال…","Connecting…","Verbinden…","Bağlanıyor…"]:available?["خرید پکیج شروع","Buy Chat Starter","Chat Starter kaufen","Chat Starter satın al"]:["فعلاً در دسترس نیست","Currently unavailable","Derzeit nicht verfügbar","Şu anda kullanılamıyor"])}</button>{error&&<p role="alert">{error}</p>}</>;
}
