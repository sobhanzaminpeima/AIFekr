export const dynamic = "force-dynamic";

import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import StudentBrandCard from "@/components/student/StudentBrandCard";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

export default async function PublicStudentProfilePage({ params }: { params: { slug: string } }) {
  const lang = await getServerLang();
  const user = await prisma.user.findFirst({ where: { studentPublicSlug: params.slug.toLowerCase(), studentProfilePublic: true }, select: { name: true, avatar: true, studentPublicSlug: true } });
  if (!user) notFound();
  return <main dir={lang === "fa" ? "rtl" : "ltr"} className="min-h-screen bg-slate-950 px-4 py-10 text-white">
    <div className="mx-auto max-w-sm">
      <div className="mb-5 flex justify-end"><LanguageSwitcher /></div>
      <StudentBrandCard lang={lang} name={user.name} avatar={user.avatar} publicSlug={user.studentPublicSlug} />
      <a href="/register?plan=STUDENT_FIRST_THREE_MONTHS" className="mt-6 flex items-center justify-center rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-400">{tri(lang, "من هم به AIFekr می‌پیوندم", "Join me at AIFekr", "Auch bei AIFekr mitmachen", "Ben de AIFekr'e katılıyorum")}</a>
    </div>
  </main>;
}
