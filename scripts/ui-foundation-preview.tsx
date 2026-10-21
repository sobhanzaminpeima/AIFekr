import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, InputField, Panel, StatusBadge, EmptyState, LoadingState, Skeleton } from "../src/components/ui/foundation";
import { Inbox, Check, ArrowUpRight } from "lucide-react";
import type { UiLocale } from "../src/lib/i18n/foundation";
import ThemeSwitcher from "../src/components/ui/ThemeSwitcher";

const copy = {
  fa: {title:'پایهٔ طراحی AiFekr',subtitle:'زغالی و نارنجی · گزینهٔ ۱',components:'اجزای مشترک',name:'نام کسب‌وکار',hint:'نامی که در فضای کاری نمایش داده می‌شود.',placeholder:'نام کسب‌وکار شما',email:'ایمیل',error:'یک آدرس ایمیل معتبر وارد کنید.',save:'ذخیرهٔ تغییرات',cancel:'انصراف',loading:'در حال بارگذاری',done:'انجام‌شده',pending:'منتظر تأیید',urgent:'نیاز به توجه',info:'در حال بررسی',empty:'هنوز پیش‌نویسی ندارید',description:'پیش‌نویس‌های محتوا پس از ایجاد، برای بررسی شما در این بخش قرار می‌گیرند.',emptyLabel:'حالت خالی',actions:'دکمه‌ها و وضعیت‌ها',saved:'حالت موفقیت دکمه؛ هیچ داده‌ای ذخیره نشد.',form:'فرم و خطا',fonts:'تایپوگرافی و جهت متن',sample:'فضایی روشن برای تصمیم‌های بهتر.',theme:'ظاهر',language:'زبان نمونه',light:'روشن',dark:'تیره',text:'پیش‌نمایش اجزای واقعی؛ بدون اتصال به دادهٔ کسب‌وکار.'},
  en: {title:'AiFekr design foundation',subtitle:'Charcoal & orange · Option 01',components:'Shared components',name:'Business name',hint:'The name displayed in your workspace.',placeholder:'Your business name',email:'Email',error:'Enter a valid email address.',save:'Save changes',cancel:'Cancel',loading:'Loading',done:'Completed',pending:'Awaiting approval',urgent:'Needs attention',info:'Under review',empty:'No drafts yet',description:'New content drafts will appear here for your review.',emptyLabel:'Empty state',actions:'Actions & statuses',saved:'Success state only; no data was saved.',form:'Fields & validation',fonts:'Typography & direction',sample:'A clearer space for better decisions.',theme:'Appearance',language:'Preview language',light:'Light',dark:'Dark',text:'Preview of real components; no business data connected.'},
  de: {title:'AiFekr Designgrundlage',subtitle:'Anthrazit & Orange · Option 01',components:'Gemeinsame Komponenten',name:'Unternehmensname',hint:'Der Name, der in Ihrem Arbeitsbereich angezeigt wird.',placeholder:'Name Ihres Unternehmens',email:'E-Mail-Adresse',error:'Geben Sie eine gültige E-Mail-Adresse ein.',save:'Änderungen speichern',cancel:'Abbrechen',loading:'Wird geladen',done:'Abgeschlossen',pending:'Freigabe ausstehend',urgent:'Handlungsbedarf',info:'Wird geprüft',empty:'Noch keine Entwürfe',description:'Neue Inhaltsentwürfe werden hier zur Prüfung angezeigt.',emptyLabel:'Leerer Zustand',actions:'Aktionen & Statusanzeigen',saved:'Nur Erfolgsanzeige; es wurden keine Daten gespeichert.',form:'Eingabefelder & Validierung',fonts:'Typografie & Schreibrichtung',sample:'Mehr Klarheit für bessere Entscheidungen.',theme:'Darstellung',language:'Vorschausprache',light:'Hell',dark:'Dunkel',text:'Vorschau echter Komponenten; keine Geschäftsdaten verbunden.'}
};
function Preview(){
 const [locale,setLocale]=useState<UiLocale>('fa'),[saved,setSaved]=useState(false);
 const s=copy[locale];
 function changeLocale(value:UiLocale){setLocale(value);setSaved(false);document.documentElement.lang=value;document.documentElement.dir=value==='fa'?'rtl':'ltr';}
 return <main className="preview" data-ui-locale={locale}>
  <header className="preview-heading"><div><p className="preview-kicker">AIFEKR / 01</p><h1>{s.title}</h1><p>{s.subtitle}</p></div><div className="preview-controls"><label>{s.language}<select className="ui-input" value={locale} onChange={e=>changeLocale(e.target.value as UiLocale)}><option value="fa">فارسی</option><option value="en">English</option><option value="de">Deutsch</option></select></label><ThemeSwitcher locale={locale} /></div></header>
  <p className="preview-note">{s.text}</p>
  <div className="preview-grid">
    <Panel><h2>{s.form}</h2><div className="preview-stack"><InputField label={s.name} placeholder={s.placeholder} hint={s.hint}/><InputField label={s.email} type="email" defaultValue="example" error={s.error}/></div></Panel>
    <Panel><h2>{s.actions}</h2><div className="preview-actions"><Button locale={locale} onClick={()=>setSaved(true)}>{saved?<Check aria-hidden="true"/>:<ArrowUpRight aria-hidden="true"/>}{s.save}</Button><Button locale={locale} variant="secondary" onClick={()=>setSaved(false)}>{s.cancel}</Button><Button locale={locale} loading>{s.loading}</Button></div><div className="preview-actions preview-statuses"><StatusBadge tone="success">✓ {s.done}</StatusBadge><StatusBadge tone="warning">◷ {s.pending}</StatusBadge><StatusBadge tone="danger">! {s.urgent}</StatusBadge><StatusBadge tone="info">· {s.info}</StatusBadge></div><p role="status" className="preview-feedback">{saved?s.saved:'\u00a0'}</p></Panel>
    <Panel><h2>{s.emptyLabel}</h2><EmptyState title={s.empty} description={s.description} icon={<Inbox size={28}/>}/></Panel>
    <Panel><h2>{s.loading}</h2><LoadingState locale={locale}><div className="preview-stack"><Skeleton style={{width:'65%',height:24}}/><Skeleton style={{height:16}}/><Skeleton style={{width:'85%',height:16}}/><Skeleton style={{height:74}}/></div></LoadingState></Panel>
  </div>
  <Panel className="preview-type"><h2>{s.fonts}</h2><p className="preview-sample">{s.sample}</p><p className="preview-numbers">۱۲۳۴۵۶۷۸۹۰ · 1234567890 · Ä Ö Ü ß</p><div className="preview-swatches">{['surface-0','surface-1','surface-2','accent','success','warning','danger'].map(token=><span key={token} aria-label={token} style={{background:`var(--${token})`}}/>)}</div></Panel>
 </main>;
}
createRoot(document.getElementById('preview-root')!).render(<Preview/>);
