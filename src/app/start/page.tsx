import PublicShell from "@/components/marketing/PublicShell";
import StarterCheckout from "@/components/marketing/StarterCheckout";
import {getServerLang} from "@/lib/i18n/server";
import {text} from "@/lib/marketing/catalog";
import {prisma} from "@/lib/db/prisma";
import {CHAT_STARTER} from "@/lib/billing/chatStarter";
import {priceForPeriod} from "@/lib/billing/plans";
export const dynamic="force-dynamic";
export const metadata={title:"AIFekr Chat Starter",robots:{index:false,follow:true}};
export default async function Page(){const lang=await getServerLang(),p=await prisma.package.findUnique({where:{planCode:CHAT_STARTER}}),available=!!p?.isActive&&p.publicationStatus==="PUBLISHED"&&p.publicVisible;const price=p?priceForPeriod(p,"monthly"):null;
 return <PublicShell lang={lang}><section className="m-container m-section m-pricing-hero"><span className="m-eyebrow">AIFekr AI Chat</span><h1>{text(lang,["شروعی ساده، با هزینهٔ مشخص","A simple start, one clear price","Einfach starten, klarer Preis","Kolay başlangıç, net fiyat"])}</h1>{available&&price&&<p className="m-price">{price.minor.toLocaleString(lang)} <small>{text(lang,["تومان","Toman","Toman","Toman"])}</small></p>}<p>{p?.duration??30} {text(lang,["روز دسترسی چت","days of chat access","Tage Chat-Zugang","gün sohbet erişimi"])} · {p?.credits??100} {text(lang,["کردیت چت","chat credits","Chat-Credits","sohbet kredisi"])}</p><p>{text(lang,["مصرف کردیت هر پاسخ پیش از ارسال در چت مشخص است. مسابقه‌ها رایگان‌اند و خرید، شرط شرکت یا افزایش شانس برنده‌شدن نیست.","Chat shows credits per response before sending. Competitions are free; buying does not affect eligibility or results.","Der Chat zeigt die Credits je Antwort vor dem Senden. Wettbewerbe sind kostenlos; ein Kauf beeinflusst weder Teilnahme noch Ergebnis.","Sohbet, göndermeden önce yanıt başına kredi tutarını gösterir. Yarışmalar ücretsizdir; satın almak katılımı veya sonuçları etkilemez."])}</p><StarterCheckout lang={lang} plan={CHAT_STARTER} available={available}/></section></PublicShell>;
}
