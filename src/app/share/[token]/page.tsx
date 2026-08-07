import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import ReactMarkdown from "react-markdown";
import { toJalali } from "@/lib/utils/jalali";

export const dynamic = "force-dynamic";

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Try BusinessAnalysis
  const analysis = await prisma.businessAnalysis.findUnique({
    where: { shareToken: token },
    select: { businessName: true, industry: true, result: true, createdAt: true, user: { select: { name: true } } },
  });

  if (analysis) {
    return (
      <SharedLayout
        badge="آنالیز کسب‌وکار"
        title={analysis.businessName}
        subtitle={analysis.industry}
        author={analysis.user.name}
        date={analysis.createdAt}
        content={analysis.result}
      />
    );
  }

  // Try ContentPipelineRun
  const run = await prisma.contentPipelineRun.findUnique({
    where: { shareToken: token },
    select: {
      topic: true, status: true, createdAt: true,
      user: { select: { name: true } },
      steps: { where: { agentKey: "publisher", status: "done" }, select: { output: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (run) {
    return (
      <SharedLayout
        badge="محتوای تولیدشده"
        title={run.topic}
        subtitle={run.status === "done" ? "تکمیل شده" : "در حال پردازش"}
        author={run.user.name}
        date={run.createdAt}
        content={run.steps[0]?.output ?? "محتوا هنوز آماده نشده است."}
      />
    );
  }

  notFound();
}

function SharedLayout({
  badge, title, subtitle, author, date, content,
}: {
  badge: string; title: string; subtitle: string; author: string | null;
  date: Date; content: string;
}) {
  const dateStr = toJalali(date);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#ea580c,#f97316)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>A</div>
          <span style={{ fontWeight: 600, fontSize: 15 }}>AiFekr</span>
        </div>
        <a href="/register" style={{ padding: "8px 18px", borderRadius: 8, background: "#ea580c", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
          امتحان کن — رایگان
        </a>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px" }} dir="rtl">
        {/* Badge */}
        <div style={{ display: "inline-block", padding: "4px 12px", borderRadius: 20, background: "rgba(234,88,12,0.15)", border: "1px solid rgba(234,88,12,0.3)", color: "#f97316", fontSize: 12, fontWeight: 600, marginBottom: 20 }}>
          {badge}
        </div>

        {/* Title */}
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 8px 0", lineHeight: 1.4 }}>{title}</h1>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, margin: "0 0 32px 0" }}>
          {subtitle} · {author ? `توسط ${author} · ` : ""}{dateStr}
        </p>

        {/* Body */}
        <div
          style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16, padding: "32px 28px",
            lineHeight: 1.8, fontSize: 15, color: "rgba(255,255,255,0.85)",
          }}
        >
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>

        {/* CTA */}
        <div style={{ marginTop: 40, padding: "28px", borderRadius: 16, background: "rgba(234,88,12,0.08)", border: "1px solid rgba(234,88,12,0.2)", textAlign: "center" }}>
          <p style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 600 }}>می‌خوای برای کسب‌وکار خودت هم از هوش مصنوعی استفاده کنی؟</p>
          <a href="/register" style={{ display: "inline-block", padding: "12px 32px", borderRadius: 10, background: "#ea580c", color: "#fff", textDecoration: "none", fontSize: 15, fontWeight: 700 }}>
            شروع رایگان با AiFekr
          </a>
        </div>
      </main>
    </div>
  );
}
