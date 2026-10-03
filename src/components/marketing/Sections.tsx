import Link from "next/link";
import { ArrowUpRight, Sparkles, Users, Magnet, Share2, FileText, Image, Video, Mic, Landmark, Building2, GraduationCap, MessageSquare, Rocket, Globe, Calendar } from "lucide-react";
import type { Lang } from "@/lib/i18n/server";
import { features, solutionCatalog, text, copy, type Feature, type Copy } from "@/lib/marketing/catalog";
import { getCreditCosts, getPublicIndustries } from "@/lib/marketing/data";
import Reveal from "./MotionReveal";

const icons = { startup: Rocket, websites: Globe, meetings: Calendar, assistant: MessageSquare, agents: Sparkles, crm: Users, leads: Magnet, social: Share2, content: FileText, images: Image, video: Video, voice: Mic, accounting: Landmark, property: Building2, education: GraduationCap };
export function FeatureCards({ lang, selected = features }: { lang: Lang; selected?: Feature[] }) {
  return <div className="m-bento">{selected.map(f => { const Icon = icons[f.slug as keyof typeof icons]; return <article className="m-card" key={f.slug}><div className="m-card-icon"><Icon size={23}/></div><h3>{text(lang, f.title)}</h3><p>{text(lang, f.desc)}</p><div className="m-mini-tags">{f.items.map(item => <span key={item[1]}>{text(lang, item)}</span>)}</div><Link className="m-text-link" href={`/features/${f.slug}`}>{text(lang, copy.learn)}<ArrowUpRight size={16}/><span className="sr-only"> — {text(lang, f.title)}</span></Link></article>; })}</div>;
}
export function SolutionCards({ lang }: { lang: Lang }) {
  return <div className="m-solutions">{solutionCatalog.map((s, i) => <article className="m-solution-card" key={s.slug}><span>0{i + 1} / AIFekr</span><h3>{text(lang, s.title)}</h3><p>{s.modules.map(slug => text(lang, features.find(f => f.slug === slug)!.title)).join(" · ")}</p><Link className="m-text-link" href={`/solutions/${s.slug}`}>{text(lang, copy.explore)}<ArrowUpRight size={15}/><span className="sr-only"> — {text(lang, s.title)}</span></Link></article>)}</div>;
}
export async function IndustryLinks({ lang }: { lang: Lang }) {
  const packs = await getPublicIndustries();
  return <><div className="m-industry-grid">{packs.map(p => <Link className="m-industry-link" href={`/industry/${p.slug}`} key={p.slug}><span aria-hidden="true">{p.emoji}</span>{lang === "fa" ? p.name : lang === "de" ? p.nameDe || p.nameEn || p.name : p.nameEn || p.name}<ArrowUpRight size={16}/></Link>)}</div><Link className="m-text-link" href="/industry">{text(lang, copy.industries)}<ArrowUpRight size={16}/></Link></>;
}
export async function CreditExplanation({ lang }: { lang: Lang }) {
  const costs = await getCreditCosts();
  const entries: { label: Copy; value: number }[] = [
    { label: ["یک تصویر استاندارد", "One standard image", "Ein Standardbild", "Bir standart görsel"], value: costs.image_standard },
    { label: ["یک تصویر HD", "One HD image", "Ein HD-Bild", "Bir HD görsel"], value: costs.image_hd },
    { label: ["ویدئو تا ۵ ثانیه", "Video up to 5 seconds", "Video bis 5 Sekunden", "5 saniyeye kadar video"], value: costs.video_5s },
    { label: ["ویدئو تا ۱۰ ثانیه", "Video up to 10 seconds", "Video bis 10 Sekunden", "10 saniyeye kadar video"], value: costs.video_10s },
  ];
  return <><h2 className="m-section-title">{text(lang, copy.credits)}</h2><p className="m-section-desc">{text(lang, copy.creditsDesc)}</p><div className="m-credit-grid">{entries.map(e => <div className="m-credit-item" key={e.label[1]}><span>{text(lang, e.label)}</span><strong>{e.value.toLocaleString(lang === "fa" ? "fa-IR" : lang)}</strong><span>{text(lang, copy.credits)}</span></div>)}</div><p className="m-caption">{text(lang, ["هزینهٔ گفتگو و ایجنت‌ها به مدل، ابزار و تعداد مراحل بستگی دارد. برآورد ابزار را پیش از عملیات بررسی کنید.", "Chat and agent costs vary by model, tool and steps. Check the tool's estimate before acting.", "Chat- und Agentenkosten variieren nach Modell, Tool und Schritten. Vor Aktionen die Schätzung prüfen.", "Sohbet ve ajan maliyetleri modele, araca ve adımlara bağlıdır. İşlemden önce aracın tahminini kontrol edin."])}</p></>;
}
export const faqItems: { q: Copy; a: Copy }[] = [
  { q: ["AIFekr چیست؟", "What is AIFekr?", "Was ist AIFekr?", "AIFekr nedir?"], a: copy.intro },
  { q: ["همهٔ ماژول‌ها در هر پلن هستند؟", "Does every plan include every module?", "Enthält jeder Tarif alle Module?", "Her plan tüm modülleri içerir mi?"], a: ["خیر. پلن عمومی، اشتراک CRM، ماژول دانشجویی و دسترسی‌های کسب‌وکار قواعد مستقل دارند. بسته و صفحهٔ پرداخت را بررسی کنید.", "No. General plans, CRM subscriptions, student access and business permissions have separate rules. Check the package and checkout.", "Nein. Allgemeine Tarife, CRM-Abos, Studierendenzugriff und Business-Berechtigungen haben eigene Regeln. Paket und Checkout prüfen.", "Hayır. Genel planlar, CRM abonelikleri, öğrenci erişimi ve işletme izinleri farklı kurallara sahiptir. Paketi ve ödeme adımını kontrol edin."] },
  { q: ["برای اتو دایرکت چه لازم است؟", "What does Instagram automation need?", "Was braucht Instagram-Automation?", "Instagram otomasyonu için ne gerekir?"], a: features.find(f => f.slug === "social")!.requirement },
  { q: ["دمو اعتبار مصرف می‌کند؟", "Does the demo use credits?", "Verbraucht die Demo Credits?", "Demo kredi kullanır mı?"], a: ["خیر؛ مثال‌ها نمایشی‌اند، به AI یا حساب خارجی درخواست نمی‌فرستند و دادهٔ مشتری واقعی ندارند.", "No. These examples are illustrative, do not call AI or connected accounts, and contain no real customer data.", "Nein. Beispiele sind illustrativ, rufen weder KI noch verbundene Konten auf und enthalten keine echten Kundendaten.", "Hayır. Örnekler temsili olup yapay zekâ veya bağlı hesaplara istek göndermez ve gerçek müşteri verisi içermez."] },
  { q: ["آیا AI جایگزین بررسی من است؟", "Can AI replace my review?", "Kann KI meine Prüfung ersetzen?", "Yapay zekâ incelememin yerini alır mı?"], a: ["خیر. خروجی می‌تواند اشتباه باشد. محتوا، امور مالی، پیام‌ها و کار دانشگاهی را پیش از استفاده بررسی کنید.", "No. Outputs can be incorrect. Review content, financial work, messages and academic work before use.", "Nein. Ergebnisse können falsch sein. Inhalte, Finanzdaten, Nachrichten und Hochschularbeiten vor Nutzung prüfen.", "Hayır. Çıktılar hatalı olabilir. İçerikleri, mali işleri, mesajları ve akademik çalışmaları kullanmadan önce inceleyin."] },
];
export function FAQ({ lang }: { lang: Lang }) { return <div className="m-faq">{faqItems.map(f => <details key={f.q[1]}><summary>{text(lang, f.q)}</summary><p>{text(lang, f.a)}</p></details>)}</div>; }
export function FinalCTA({ lang }: { lang: Lang }) { return <Reveal><div className="m-final"><span className="m-eyebrow">AIFekr</span><h2 className="m-section-title">{text(lang, copy.final)}</h2><p>{text(lang, copy.noPromise)}</p><div className="m-actions"><Link className="m-button" href="/register">{text(lang, copy.start)}<ArrowUpRight size={18}/></Link><Link className="m-button m-secondary" href="/pricing">{text(lang, copy.pricing)}</Link></div></div></Reveal>; }
export function Workflow({ lang }: { lang: Lang }) {
  const steps: { title: Copy; desc: Copy; slug: string }[] = [
    { title: ["با یک سؤال شروع کنید.", "Start with a question.", "Mit einer Frage starten.", "Bir soruyla başlayın."], desc: ["هدف و اطلاعات را به دستیار بدهید و پیش‌نویس یا پیشنهاد بگیرید.", "Give your assistant context and a goal. Get a draft or suggestion.", "Kontext und Ziel eingeben. Einen Entwurf oder Vorschlag erhalten.", "Asistanınıza bilgilerinizi ve hedefinizi verin. Taslak veya öneri alın."], slug: "assistant" },
    { title: ["در فضای مناسب ادامه دهید.", "Continue in the right workspace.", "Im passenden Bereich fortfahren.", "Doğru çalışma alanında ilerleyin."], desc: copy.modulesDesc, slug: "crm" },
    { title: ["بررسی کنید، سپس اقدام کنید.", "Review. Then take action.", "Prüfen. Dann handeln.", "İnceleyin. Sonra harekete geçin."], desc: copy.workflowDesc, slug: "social" },
  ];
  return <div className="m-story"><div className="m-story-intro"><span className="m-eyebrow">{text(lang, copy.steps)}</span><h2 className="m-section-title">{text(lang, copy.workflow)}</h2><p className="m-section-desc">{text(lang, copy.workflowDesc)}</p></div><div>{steps.map((s, i) => <Reveal key={s.slug}><article className="m-story-step"><span className="m-story-number">0{i + 1}</span><h3>{text(lang, s.title)}</h3><p>{text(lang, s.desc)}</p><Link className="m-text-link" href={`/features/${s.slug}`}>{text(lang, copy.learn)}<ArrowUpRight size={15}/></Link></article></Reveal>)}</div></div>;
}
