import {cookies} from "next/headers";
import {redirect,notFound} from "next/navigation";
import Link from "next/link";
import {verifyToken} from "@/lib/auth/jwt";
import {prisma} from "@/lib/db/prisma";
import {parseCourseContent,courseLessons} from "@/lib/courses/content";
import {getServerLang} from "@/lib/i18n/server";
import {tri} from "@/lib/i18n/tri";
import LearningBlocks from "@/components/courses/LearningBlocks";
export const dynamic="force-dynamic";
export default async function Preview({params,searchParams}:{params:{id:string};searchParams:{lesson?:string}}){
 const token=cookies().get("token")?.value,payload=token?verifyToken(token):null;
 if(!payload)redirect("/login");
 const admin=await prisma.user.findUnique({where:{id:payload.userId},select:{role:true,isBlocked:true}});
 if(!admin||admin.isBlocked)redirect("/login");
 if(!["ADMIN","SUPER_ADMIN"].includes(admin.role))redirect("/home");
 const course=await prisma.aiCourse.findUnique({where:{id:params.id}});if(!course?.content)notFound();
 const content=parseCourseContent(course.content),lessons=courseLessons(content),lesson=lessons.find(l=>l.id===searchParams.lesson)||lessons[0];
 const lang=await getServerLang(),t=(fa:string,en:string,de:string,tr:string)=>tri(lang,fa,en,de,tr);
 return <div dir={lang==="fa"?"rtl":"ltr"} className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
 <Link className="inline-flex min-h-12 items-center rounded-xl border px-4" href={`/admin/ai-courses?course=${course.id}`}>{t("بازگشت به ویرایشگر","Back to editor","Zurück zum Editor","Düzenleyiciye dön")}</Link>
 <header className="space-y-3"><p className="text-orange-400">{t("پیش‌نمایش مدیریت — پیشرفت یا اعتبار تغییر نمی‌کند","Admin preview · no progress or credit changes","Admin-Vorschau · keine Fortschritts- oder Creditänderung","Yönetici önizlemesi · ilerleme veya kredi değişmez")}</p><h1 className="text-3xl font-bold">{course.title}</h1><p className="leading-8">{content.overview}</p><p>{course.status} · v{course.version} · {lessons.length} {t("درس","lessons","Lektionen","ders")}</p></header>
 <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
 <details open className="rounded-2xl border border-slate-500/30 p-4"><summary className="cursor-pointer font-semibold">{t("سرفصل‌ها","Curriculum","Lehrplan","Müfredat")}</summary><nav aria-label={t("پیش‌نمایش درس‌ها","Lesson preview","Lektionsvorschau","Ders önizlemesi")} className="mt-4 grid gap-2">{lessons.map(l=><Link key={l.id} href={`?lesson=${l.id}`} aria-current={l.id===lesson.id?"page":undefined} className={`rounded-xl border p-3 text-sm leading-6 ${l.id===lesson.id?"border-orange-500":"border-slate-500/20"}`}>{l.title}</Link>)}</nav></details>
 <article dir={course.language==="fa"?"rtl":"ltr"} className="min-w-0 space-y-6 rounded-2xl border border-slate-500/30 p-5 md:p-8"><p className="text-sm text-orange-400">{lesson.chapter}</p><h2 className="text-2xl font-bold">{lesson.title}</h2><LearningBlocks blocks={lesson.blocks} fallback={lesson.content}/><section className="rounded-xl border border-orange-500/30 p-5"><h3 className="font-semibold">{t("تمرین","Practice","Übung","Alıştırma")}</h3><p className="mt-3 leading-8">{lesson.activity}</p></section><details className="rounded-xl border p-4"><summary>{t("بازبینی آزمون و پاسخ‌ها — مخصوص ادمین","Review quiz and answers · admin only","Quiz und Antworten prüfen · nur Admin","Quiz ve cevapları incele · yalnızca yönetici")}</summary>{lesson.quiz.map((q,i)=><div key={i} className="mt-5 space-y-3"><h3 className="font-semibold">{q.question}</h3><ol className="list-inside list-decimal">{q.options.map((v,j)=><li key={j} className={j===q.correctIndex?"text-emerald-400":""}>{v}</li>)}</ol><p className="leading-7">{q.explanation}</p></div>)}</details></article>
 </div></div>;
}
