"use client";
import {useEffect,useState} from "react";
import {Check,Loader2,Clock3,AudioLines} from "lucide-react";
import {tri,useTranslation} from "@/lib/i18n";
export type ProgressJob={id:string;status:string;createdAt:string;providerStartedAt?:string|null;durationMs:number|null};
export default function GenerationProgress({job,submitting=false}:{job?:ProgressJob;submitting?:boolean}){
 const {lang}=useTranslation(),t=(fa:string,en:string,de:string,tr:string)=>tri(lang,fa,en,de,tr);
 const [now,setNow]=useState(()=>Date.now());
 const pending=!!job&&["QUEUED","RUNNING"].includes(job.status);
 useEffect(()=>{if(!pending)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[pending]);
 if(!submitting&&!job)return null;
 if(job&&!pending&&job.status!=="READY")return null;
 const stage=submitting?0:job?.status==="QUEUED"?0:job?.status==="READY"?3:job?.durationMs?2:job?.providerStartedAt?1:0;
 const labels=[t("در صف تولید","Queued","In Warteschlange","Kuyrukta"),t("ساخت صدا","Generating audio","Audio wird erstellt","Ses üretiliyor"),t("ذخیره و آماده‌سازی","Saving audio","Audio wird gespeichert","Ses kaydediliyor"),t("آمادهٔ پخش","Ready to play","Bereit zur Wiedergabe","Oynatmaya hazır")];
 return <section id="voice-generation-progress" className={`vs-progress ${stage===3?"vs-progress-ready":""}`} aria-live="polite" aria-busy={stage!==3}>
  <div className="vs-row"><div className="vs-progress-title">{stage===3?<AudioLines size={22}/>:<Loader2 size={22} className="vs-spin"/>}<strong>{submitting?t("ثبت درخواست…","Submitting…","Wird gesendet…","Gönderiliyor…"):labels[stage]}</strong></div>{pending&&<span className="vs-muted"><Clock3 size={14}/> {Math.max(0,Math.floor((now-Date.parse(job.createdAt))/1000)).toLocaleString(lang)} {t("ثانیه گذشته","seconds elapsed","Sekunden vergangen","saniye geçti")}</span>}</div>
  <ol className="vs-steps">{labels.map((label,i)=><li key={i} className={i<=stage?"is-current":""}><span>{i<stage?<Check size={13}/>:i+1}</span>{label}</li>)}</ol>
  {stage<3&&<p className="vs-muted">{t("درخواست در حال انجام است؛ نیازی به زدن دوبارهٔ تولید نیست. می‌توانید صفحه را ببندید و بعداً از کتابخانه دریافت کنید.","Your request is being processed. No need to submit again. You can leave and return to your library.","Ihre Anfrage wird bearbeitet. Nicht erneut senden. Sie können später zur Bibliothek zurückkehren.","İsteğiniz işleniyor. Tekrar göndermeniz gerekmiyor. Daha sonra kitaplığa dönebilirsiniz.")}</p>}
 </section>;
}
