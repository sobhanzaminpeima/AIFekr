export const dynamic = "force-dynamic";

import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";

export default async function PublicStudentProfilePage({ params }: { params: { slug: string } }) {
  const lang = await getServerLang();
  const user = await prisma.user.findFirst({ where: { studentPublicSlug: params.slug.toLowerCase(), studentProfilePublic: true }, select: { name: true, email: true, avatar: true, studentPublicSlug: true } });
  if (!user) notFound();
  return <main className="grid min-h-screen place-items-center bg-slate-950 px-4 py-12 text-white">
    <article className="w-full max-w-md overflow-hidden rounded-3xl border border-orange-400/25 bg-slate-900 shadow-2xl shadow-black/40">
      <div className="h-2 bg-gradient-to-r from-orange-500 via-amber-300 to-orange-500" />
      <div className="p-8 text-center">
        <div className="mx-auto mb-5 grid h-28 w-28 place-items-center overflow-hidden rounded-full border-4 border-orange-400/30 bg-slate-800 text-3xl font-bold text-orange-300">
          {user.avatar?.startsWith("https://") ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : user.name?.slice(0, 1) || "S"}
        </div>
        <h1 className="text-2xl font-bold">{user.name || "Student"}</h1>
        {user.email && <p className="mt-2 break-all text-sm text-slate-300">{user.email}</p>}
        <div className="my-7 border-t border-slate-700" />
        <div className="flex items-center justify-center gap-2"><Image src="/logo.svg" alt="AIFekr" width={32} height={32} /><span className="font-semibold tracking-wide">AIFekr</span></div>
        <p className="mt-2 text-xs text-slate-400">{tri(lang, `پروفایل دانشجویی AIFekr · @${user.studentPublicSlug}`, `AIFekr student profile · @${user.studentPublicSlug}`, `AIFekr-Studierendenprofil · @${user.studentPublicSlug}`, `AIFekr öğrenci profili · @${user.studentPublicSlug}`)}</p>
        <a href="https://aifekr.com" className="mt-6 inline-flex rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-400">{tri(lang, "ورود به AIFekr", "Open AIFekr", "AIFekr öffnen", "AIFekr'yi aç")}</a>
      </div>
    </article>
  </main>;
}
