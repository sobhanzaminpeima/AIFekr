export const dynamic = "force-dynamic";
import {pageMetadata} from "@/lib/seo/site";
import {searchTargets} from "@/lib/seo/searchTargets";
export async function generateMetadata(){return pageMetadata(await getServerLang(),"/fit",searchTargets["/fit"].title,searchTargets["/fit"].description);}

import Link from "next/link";
import { cookies } from "next/headers";
import { getServerLang } from "@/lib/i18n/server";
import { fitCopy } from "@/lib/fitness/copy";
import { verifyToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";
import DynamicPlans from "@/components/billing/DynamicPlans";

const publicCopy = {
  en: { login: "Sign in", create: "Create account", coaches: "AI coaches built around your goals", explore: "Explore coaches", proof: "Programs · workout tracking · progress reports" },
  fa: { login: "ورود", create: "ساخت حساب", coaches: "مربی‌های هوشمند متناسب با هدف تو", explore: "مشاهده مربی‌ها", proof: "برنامه تمرینی · ثبت تمرین · گزارش پیشرفت" },
  tr: { login: "Giriş yap", create: "Hesap oluştur", coaches: "Hedeflerine göre yapay zekâ koçları", explore: "Koçları keşfet", proof: "Programlar · antrenman takibi · ilerleme raporları" },
  ar: { login: "تسجيل الدخول", create: "إنشاء حساب", coaches: "مدربون بالذكاء الاصطناعي لأهدافك", explore: "استكشف المدربين", proof: "برامج · تتبع التدريب · تقارير التقدم" },
  de: { login: "Anmelden", create: "Konto erstellen", coaches: "KI-Coaches passend zu deinen Zielen", explore: "Coaches entdecken", proof: "Programme · Trainingsprotokoll · Fortschrittsberichte" },
} as const;

export default async function Page() {
  const lang = await getServerLang();
  const c = fitCopy[lang];
  const p = publicCopy[lang];
  const token = (await cookies()).get("token")?.value;
  const auth = token ? verifyToken(token) : null;
  const account = auth ? await prisma.user.findUnique({ where: { id: auth.userId }, select: { isBlocked: true } }) : null;
  const isLoggedIn = Boolean(account && !account.isBlocked);
  const rtl = lang === "fa";
  const coachHref = isLoggedIn ? "/fitness" : "/login?redirect=/fitness";

  return <main className="fit-page fit-landing" dir={rtl ? "rtl" : "ltr"}>
    <header className="fit-landing-header">
      <Link href="/" className="fit-brand" aria-label="AIFekr home"><span className="fit-brand-mark">AI</span><span>AIFekr <b>FIT</b></span></Link>
      <nav className="fit-landing-nav" aria-label="AIFekr FIT">
        <a href="#membership">{c.plans}</a>
        {isLoggedIn ? <Link className="fit-header-action" href="/fitness">{c.profile}</Link> : <><Link href="/login?redirect=/fitness">{p.login}</Link><Link className="fit-header-action" href="/register?plan=FIT_MONTHLY">{p.create}</Link></>}
      </nav>
    </header>

    <section className="fit-hero">
      <div className="fit-hero-copy">
        <span className="fit-chip">AIFekr FIT</span><p className="fit-kicker">{p.coaches}</p><h1>{c.tagline}</h1><p className="fit-proof">{p.proof}</p><p className="fit-safety">{c.safety}</p>
        <div className="fit-hero-actions"><Link className="fit-primary" href={isLoggedIn ? "/fitness" : "/register?plan=FIT_MONTHLY"}>{c.start} <span aria-hidden>→</span></Link><a className="fit-secondary" href="#coaches">{p.explore}</a></div>
      </div>
      <div className="fit-portraits" aria-label={c.trainers}><div className="fit-portrait fit-fika" role="img" aria-label="FIKA AI fitness coach"/><div className="fit-portrait fit-fiko" role="img" aria-label="FIKO AI fitness coach"/></div>
    </section>

    <section id="coaches" className="fit-section"><h2>{c.trainers}</h2><div className="fit-card-grid mt-6">{["FIKA", "FIKO"].map(name => <article className="fit-card" key={name}><span className="fit-chip">{c.ai}</span><h3>{name} FIT</h3><p>{c.programs} · {c.nutrition} · {c.gym}</p><Link href={coachHref}>{c.ai} →</Link></article>)}</div></section>
    <section className="fit-card-grid fit-section">{[c.programs, c.gym, c.history, c.nutrition].map(x => <article className="fit-card" key={x}><h3>{x}</h3><p>{c.safety}</p></article>)}</section>
    <section className="fit-card-grid fit-section">
      <article className="fit-card"><h2>{({ en:"Find your human coach",fa:"مربی انسانی مناسب خودت را پیدا کن",tr:"İnsan eğitmenini bul",ar:"اعثر على مدربك البشري",de:"Finde deinen Trainer" })[lang]}</h2><Link href="/fitness/marketplace?tab=trainers">{({ en:"Explore trainers & availability",fa:"مشاهده مربیان و زمان‌های رزرو",tr:"Eğitmenleri ve uygun saatleri keşfet",ar:"استكشف المدربين والمواعيد",de:"Trainer und Termine ansehen" })[lang]} →</Link></article>
      <article className="fit-card"><h2>{({ en:"Sell as a trainer",fa:"به‌عنوان مربی فعالیت کن",tr:"Eğitmen olarak satış yap",ar:"ابدأ البيع كمدرب",de:"Als Trainer verkaufen" })[lang]}</h2><p>{({ en:"Apply, submit credentials and publish after admin review.",fa:"درخواست و مدارکت را بفرست؛ پس از بررسی ادمین فعالیتت را شروع کن.",tr:"Başvur, belgelerini gönder ve inceleme sonrasında yayınla.",ar:"قدم طلبك ومؤهلاتك وانشر بعد المراجعة.",de:"Bewirb dich und reiche Nachweise zur Prüfung ein." })[lang]}</p><Link href="/fitness/marketplace?tab=apply">{({ en:"Trainer application",fa:"درخواست مربی شدن",tr:"Eğitmen başvurusu",ar:"طلب مدرب",de:"Trainerbewerbung" })[lang]} →</Link></article>
    </section>
    <section id="membership" className="fit-section"><DynamicPlans category="FITNESS"/></section>
    <footer className="fit-landing-footer"><p>{c.subscription}</p><Link className="fit-primary" href={isLoggedIn ? "/fitness" : "/register?plan=FIT_MONTHLY"}>{c.start} →</Link></footer>
  </main>;
}
