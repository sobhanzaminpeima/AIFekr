"use client";
import {useTranslation,tri} from "@/lib/i18n";
export default function CompletionSettings({value,onChange}:{value:string;onChange:(s:string)=>void}){
 const {lang}=useTranslation(),t=(fa:string,en:string,de:string,tr:string)=>tri(lang,fa,en,de,tr);
 let config;try{config=JSON.parse(value);}catch{return null;}
 const rules=config.requirements||{lessonPercent:100,quizScore:60,finalRequired:false,finalScore:75,attemptLimit:0};
 const field="min-h-12 w-full rounded-xl border border-slate-500/30 bg-transparent p-3";
 const update=(key:string,v:unknown)=>onChange(JSON.stringify({...config,requirements:{...rules,[key]:v}},null,2));
 return <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
 {([["lessonPercent",t("درصد درس‌های لازم","Required lesson percentage","Erforderliche Lektionen (%)","Gerekli ders yüzdesi")],["quizScore",t("نمره قبولی آزمون درس","Lesson passing score (%)","Bestehensgrenze pro Lektion (%)","Ders geçme puanı (%)")],["finalScore",t("نمره قبولی آزمون نهایی","Final passing score (%)","Abschluss-Bestehensgrenze (%)","Final geçme puanı (%)")],["attemptLimit",t("تعداد تلاش مجاز؛ صفر یعنی نامحدود","Attempt limit (0 = unlimited)","Versuchslimit (0 = unbegrenzt)","Deneme sınırı (0 = sınırsız)")]] as const).map(([key,label])=><label key={key}>{label}<input type="number" min={key==="attemptLimit"?0:1} max={100} className={field} value={rules[key]??(key==="attemptLimit"?0:75)} onChange={e=>update(key,Number(e.target.value))}/></label>)}
 <label className="flex min-h-12 items-center gap-3"><input type="checkbox" checked={rules.finalRequired??true} onChange={e=>update("finalRequired",e.target.checked)}/>{t("آزمون نهایی الزامی است","Final assessment required","Abschlussprüfung erforderlich","Final değerlendirme zorunlu")}</label>
 {([["audience",t("مخاطب دوره","Target audience","Zielgruppe","Hedef kitle")],["teachingStyle",t("سبک تدریس","Teaching style","Unterrichtsstil","Öğretim tarzı")],["depth",t("عمق محتوا","Content depth","Inhaltstiefe","İçerik derinliği")],["instructions",t("دستورهای تکمیلی","Additional instructions","Weitere Anweisungen","Ek talimatlar")]] as const).map(([key,label])=><label key={key}>{label}<textarea className={field} maxLength={key==="instructions"?6000:1000} value={config[key]||""} onChange={e=>onChange(JSON.stringify({...config,[key]:e.target.value},null,2))}/></label>)}
 <label>{t("اهداف یادگیری؛ هر خط یک مورد","Learning objectives (one per line)","Lernziele (eines pro Zeile)","Öğrenme hedefleri (satır başına bir)")}<textarea className={field} value={(config.learningObjectives||[]).join("\n")} onChange={e=>onChange(JSON.stringify({...config,learningObjectives:e.target.value.split("\n")},null,2))}/></label>
 <label>{t("تعداد فصل‌ها","Number of chapters","Anzahl der Kapitel","Bölüm sayısı")}<input className={field} type="number" min={3} max={12} value={config.chapterCount||6} onChange={e=>onChange(JSON.stringify({...config,chapterCount:Number(e.target.value)},null,2))}/></label>
 </div>;
}
