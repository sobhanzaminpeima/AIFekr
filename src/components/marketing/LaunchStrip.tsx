import Link from "./PublicLink";
import {prisma} from "@/lib/db/prisma";
import {CHAT_STARTER} from "@/lib/billing/chatStarter";
import {priceForPeriod} from "@/lib/billing/plans";
import {text} from "@/lib/marketing/catalog";
import type {Lang} from "@/lib/i18n/server";
export default async function LaunchStrip({lang}:{lang:Lang}){
 const p=await prisma.package.findUnique({where:{planCode:CHAT_STARTER}});
 const prize=await prisma.playTournament.findFirst({where:{status:"PUBLISHED",rewardTitle:"MONTHLY_PACKAGE_CHOICE",startsAt:{lte:new Date()},endsAt:{gt:new Date()}},select:{id:true}});
 return <div className="m-launch-strip">{p?.isActive&&p.publicVisible&&p.publicationStatus==="PUBLISHED"&&p.baseCurrency==="IRT"&&<Link href="/start">{text(lang,["پکیج شروع چت","Chat Starter","Chat Starter","Chat Starter"])} · {priceForPeriod(p,"monthly").days} {text(lang,["روز","days","Tage","gün"])} + {p.credits} {text(lang,["کردیت","credits","Credits","kredi"])} · {priceForPeriod(p,"monthly").minor.toLocaleString(lang)} {text(lang,["تومان","Toman","Toman","Toman"])}</Link>}<Link href="/play">{prize?text(lang,["🏆 مسابقهٔ رایگان؛ جایزهٔ برنده: یک ماه دانشجویی، فیتنس یا بیزنس به انتخاب خودش","🏆 Free competition: winner chooses one month Student, Fitness or Business","🏆 Kostenloser Wettbewerb: ein Monat Studium, Fitness oder Business nach Wahl","🏆 Ücretsiz yarışma: kazanan bir ay Öğrenci, Fitness veya İşletme seçer"]):text(lang,["مسابقهٔ رایگان؛ مستقل از خرید ←","Free competitions · no purchase required →","Kostenlose Wettbewerbe · kein Kauf nötig →","Ücretsiz yarışmalar · satın alma gerekmez →"])}</Link><small>{text(lang,["خرید، شرط شرکت یا امتیاز بیشتر نیست.","No purchase required; buying gives no advantage.","Kein Kauf nötig; ein Kauf bietet keinen Vorteil.","Satın alma gerekmez; satın almak avantaj sağlamaz."])}</small></div>;
}
