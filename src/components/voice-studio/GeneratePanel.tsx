"use client";
import {AudioLines,Loader2,ChevronDown,Info} from "lucide-react";
import {tri,useTranslation} from "@/lib/i18n";
export default function GeneratePanel({blockedReason,voice,model,segments,segment,onSegment,estimate,estimatedCredits,reserved,interval,rate,disabled,busy,pending,onGenerate}:{blockedReason?:string;voice?:string;model?:string;segments:string[];segment:number;onSegment:(n:number)=>void;estimate:number;estimatedCredits:number;reserved:number;interval:number;rate:number;disabled:boolean;busy:boolean;pending:boolean;onGenerate:()=>void}){
 const {lang}=useTranslation(),t=(fa:string,en:string,de:string,tr:string)=>tri(lang,fa,en,de,tr);
 return <section className="vs-card vs-generate">
  <div className="vs-card-head"><span className="vs-step">3</span><div><h2>{t("ساخت فایل صوتی","Create audio","Audio erstellen","Ses oluştur")}</h2><p>{t("یک بار بررسی کنید و بسازید","Review once, then generate","Kurz prüfen, dann erstellen","Kontrol edin ve oluşturun")}</p></div></div>
  <dl className="vs-summary">
   <div><dt>{t("صدا","Voice","Stimme","Ses")}</dt><dd>{voice||"—"}</dd></div>
   <div><dt>{t("مدل","Model","Modell","Model")}</dt><dd>{model||"—"}</dd></div>
   <div><dt>{t("مدت تقریبی","Approx. length","Ungefähre Länge","Yaklaşık süre")}</dt><dd>≈ {Math.ceil(estimate).toLocaleString(lang)} {t("ثانیه","s","s","sn")}</dd></div>
   <div><dt>{t("هزینهٔ تقریبی","Approx. cost","Ungefähre Kosten","Yaklaşık maliyet")}</dt><dd><strong>{estimatedCredits.toLocaleString(lang)} {t("کردیت","credits","Credits","kredi")}</strong></dd></div>
  </dl>
  {segments.length>1&&<label>{t("کدام بخش ساخته شود؟","Which part to generate?","Welcher Teil?","Hangi bölüm?")}<select value={segment} onChange={e=>onSegment(Number(e.target.value))}>{segments.map((s,i)=><option key={i} value={i}>{(i+1).toLocaleString(lang)} / {segments.length.toLocaleString(lang)} · {s.slice(0,40)}…</option>)}</select></label>}
  <button className="vs-primary" disabled={disabled||pending} onClick={onGenerate}>{busy||pending?<Loader2 size={18} className="vs-spin"/>:<AudioLines size={18}/>} {busy?t("ثبت درخواست…","Submitting…","Wird gesendet…","Gönderiliyor…"):pending?t("در حال ساخت…","Generating…","Wird erstellt…","Oluşturuluyor…"):t("ساخت صدا","Generate audio","Audio generieren","Ses üret")}</button>
  {disabled&&!busy&&!pending&&blockedReason?<p className="vs-blocked" role="status"><Info size={15}/>{blockedReason}</p>:null}
  <details className="vs-cost-details"><summary>{t("هزینه چطور حساب می‌شود؟","How is it priced?","Wie wird abgerechnet?","Nasıl ücretlendirilir?")}<ChevronDown size={14}/></summary><p>{rate} {t("کردیت به ازای هر","credits per","Credits je","kredi / her")} {interval} {t("ثانیهٔ شروع‌شده","started seconds","angefangene Sekunden","başlayan saniye")}. {t("رزرو حداکثری","Maximum reservation","Maximale Reservierung","Azami rezervasyon")}: {reserved}.</p><p>{t("هزینه با مدت واقعی تسویه می‌شود و باقی‌ماندهٔ رزرو برمی‌گردد. متن طولانی به بخش‌های مستقل تقسیم می‌شود.","Charged by actual duration; unused reservation is returned. Long text is split into separate segments.","Abrechnung nach tatsächlicher Dauer; Rest wird erstattet. Lange Texte werden aufgeteilt.","Gerçek süreye göre ücret alınır; kalan rezervasyon iade edilir. Uzun metin bölümlere ayrılır.")}</p></details>
 </section>;
}
