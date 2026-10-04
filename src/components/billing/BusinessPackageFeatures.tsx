import { Check, Headphones } from "lucide-react";
import type { Lang } from "@/lib/i18n/server";
import { text, type Copy } from "@/lib/marketing/catalog";

const modules: Copy[] = [
  ["مشاور مدیرعامل، دکتر کسب‌وکار و اتاق جلسه", "CEO advisor, business doctor and meeting room", "CEO-Beratung, Business-Doktor und Besprechungsraum", "CEO danışmanı, işletme doktoru ve toplantı odası"],
  ["CRM، ایجنت فروش و تولید لید", "CRM, sales agent and lead generation", "CRM, Vertriebsagent und Leadgenerierung", "CRM, satış ajanı ve potansiyel müşteri üretimi"],
  ["شبکه‌های اجتماعی و فضای کار سئو", "Social media and SEO workspace", "Social Media und SEO-Arbeitsbereich", "Sosyal medya ve SEO çalışma alanı"],
  ["حسابداری و مدیریت مالی", "Accounting and finance", "Buchhaltung und Finanzen", "Muhasebe ve finans"],
  ["طراح وبسایت و سازنده استارتاپ", "Website designer and startup builder", "Website-Designer und Startup-Builder", "Web sitesi tasarımcısı ve girişim oluşturucu"],
  ["چت AI، ایجنت‌ها و تولید تصویر و ویدئو", "AI chat, agents, image and video generation", "KI-Chat, Agenten, Bild- und Videoerstellung", "Yapay zekâ sohbeti, ajanlar, görsel ve video üretimi"],
  ["بسته‌های صنعتی و گالری محتوا", "Industry packs and content gallery", "Branchenpakete und Inhaltsgalerie", "Sektör paketleri ve içerik galerisi"],
];

export default function BusinessPackageFeatures({ lang, planCode }: { lang: Lang; planCode: string }) {
  const highlighted = ["TEAM_BUSINESS_GROW", "TEAM_BUSINESS_SCALE"].includes(planCode);
  return <div className="package-modules">
    <p className="package-modules-title">{text(lang, ["ماژول‌ها و ایجنت‌های این پکیج", "Included modules and agents", "Enthaltene Module und Agenten", "Dahil olan modüller ve ajanlar"])}</p>
    <ul className="package-module-list">
      <li className={highlighted ? "package-call-center" : undefined}>
        <Headphones size={18} aria-hidden/>
        {highlighted ? <strong>{text(lang, ["مرکز تماس هوش مصنوعی", "AI Call Center", "KI-Callcenter", "Yapay Zekâ Çağrı Merkezi"])}</strong> : <span>{text(lang, ["مرکز تماس هوش مصنوعی", "AI Call Center", "KI-Callcenter", "Yapay Zekâ Çağrı Merkezi"])}</span>}
      </li>
      {modules.map((module, i) => <li key={i}><Check size={15} aria-hidden/><span>{text(lang, module)}</span></li>)}
    </ul>
  </div>;
}
