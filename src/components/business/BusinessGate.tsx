import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { TrendingUp, Users, BarChart3, Globe, Zap, ArrowLeft } from "lucide-react";

export default async function BusinessGate({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { industryPackId: true },
      });
      if (user?.industryPackId) return <>{children}</>;
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--surface-0)" }}>
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Icon */}
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background: "linear-gradient(135deg, #ea580c, #f97316)" }}>
          <TrendingUp className="w-10 h-10 text-white" />
        </div>

        {/* Headline */}
        <div>
          <h1 className="text-3xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
            آیا می‌خواهی کسب‌وکارت رشد کنه؟
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            با ایجنت‌های هوش مصنوعی تخصصی، کسب‌وکار خود را به سطح بعدی ببر.<br />
            تحلیل، استراتژی، سئو، شبکه‌های اجتماعی و جلسات هوشمند — همه در یک پلتفرم.
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { icon: BarChart3, label: "دکتر کسب‌وکار", desc: "تحلیل و مشاوره هوشمند" },
            { icon: Users, label: "اتاق جلسه AI", desc: "جلسه با ایجنت‌های متخصص" },
            { icon: Globe, label: "سئو حرفه‌ای", desc: "رتبه‌بندی و بهینه‌سازی" },
            { icon: Zap, label: "شبکه‌های اجتماعی", desc: "تولید محتوا خودکار" },
            { icon: TrendingUp, label: "مشاور مدیرعامل", desc: "استراتژی و تصمیم‌گیری" },
            { icon: Globe, label: "طراح وبسایت", desc: "ساخت سایت هوشمند" },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="p-4 rounded-2xl text-right"
              style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <Icon className="w-5 h-5 mb-2" style={{ color: "#ea580c" }} />
              <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{label}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{desc}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/industry"
            className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-white text-lg transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #ea580c, #f97316)" }}>
            مشاهده بسته‌های صنعتی
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Link href="/chat"
            className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-medium text-lg transition-all"
            style={{ background: "var(--surface-1)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
            ادامه بدون بسته
          </Link>
        </div>

        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          بسته‌های صنعتی برای کسب‌وکارها طراحی شده‌اند و شامل ایجنت‌های تخصصی هر صنعت می‌باشند.
        </p>
      </div>
    </div>
  );
}