export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db/prisma";
import { MessageSquare, User, Clock, Trash2 } from "lucide-react";

export default async function ChatsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q || "";
  const page = Number(params.page || 1);
  const limit = 20;

  const where = q
    ? { OR: [{ title: { contains: q } }, { user: { name: { contains: q } } }] }
    : {};

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: {
        user: { select: { name: true, phone: true, email: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.conversation.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>مدیریت چت‌ها</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{total.toLocaleString("fa-IR")} مکالمه</p>
        </div>
      </div>

      {/* Search */}
      <form method="GET">
        <input name="q" defaultValue={q} placeholder="جستجو در مکالمات..."
          className="w-full max-w-sm px-3 py-2 rounded-xl text-sm outline-none"
          style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
      </form>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--surface-1)", borderBottom: "1px solid var(--border)" }}>
              {["عنوان مکالمه", "کاربر", "مدل", "پیام‌ها", "آخرین فعالیت"].map(h => (
                <th key={h} className="px-4 py-3 text-right font-medium" style={{ color: "var(--text-muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {conversations.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center" style={{ color: "var(--text-muted)" }}>
                  مکالمه‌ای یافت نشد
                </td>
              </tr>
            )}
            {conversations.map((c, i) => (
              <tr key={c.id} style={{ borderBottom: i < conversations.length - 1 ? "1px solid var(--border)" : undefined, background: i % 2 === 0 ? "var(--surface-0)" : "var(--surface-1)" }}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 flex-shrink-0" style={{ color: "var(--primary)" }} />
                    <span style={{ color: "var(--text-primary)" }}>{c.title || "بدون عنوان"}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                    <span style={{ color: "var(--text-secondary)" }}>{c.user.name || c.user.phone || c.user.email || "ناشناس"}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                    {c.model.includes("haiku") ? "Haiku" : c.model.includes("sonnet") ? "Sonnet" : "Opus"}
                  </span>
                </td>
                <td className="px-4 py-3 text-center" style={{ color: "var(--text-secondary)" }}>{c._count.messages}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    <Clock className="w-3 h-3" />
                    {new Date(c.updatedAt).toLocaleDateString("fa-IR")}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <a key={p} href={`?q=${q}&page=${p}`}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-sm"
              style={{ background: p === page ? "var(--primary)" : "var(--surface-1)", color: p === page ? "white" : "var(--text-secondary)" }}>
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
