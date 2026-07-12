export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db/prisma";
import { Globe, User, Clock } from "lucide-react";

export default async function GeneratedWebsitesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q || "";
  const page = Number(params.page || 1);
  const limit = 20;

  // Deliberately not using `include: { user: ... }` here — that's a required
  // relation, and Prisma throws a hard "Inconsistent query result" error for
  // the *entire* query if any row's userId no longer resolves to a User
  // (e.g. a user was deleted via raw SQL, bypassing Prisma's cascade). A
  // manual left-join-style fetch degrades to "ناشناس" per row instead of
  // crashing the whole admin page.
  const where = q ? { businessName: { contains: q } } : {};

  const [rawWebsites, total] = await Promise.all([
    prisma.generatedWebsite.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.generatedWebsite.count({ where }),
  ]);

  const userIds = Array.from(new Set(rawWebsites.map((w) => w.userId)));
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, phone: true, email: true } })
    : [];
  const usersById = new Map(users.map((u) => [u.id, u]));
  const websites = rawWebsites.map((w) => ({ ...w, user: usersById.get(w.userId) ?? null }));

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>وبسایت‌های تولیدشده</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{total.toLocaleString("fa-IR")} وبسایت</p>
        </div>
      </div>

      <form method="GET">
        <input name="q" defaultValue={q} placeholder="جستجو بر اساس نام کسب‌وکار یا کاربر..."
          className="w-full max-w-sm px-3 py-2 rounded-xl text-sm outline-none"
          style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
      </form>

      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--surface-1)", borderBottom: "1px solid var(--border)" }}>
              {["نام کسب‌وکار", "کاربر", "صنعت", "حجم کد", "تاریخ ساخت", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-right font-medium" style={{ color: "var(--text-muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {websites.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center" style={{ color: "var(--text-muted)" }}>
                  هنوز وبسایتی تولید نشده است
                </td>
              </tr>
            )}
            {websites.map((w, i) => {
              let industry = "-";
              try { industry = JSON.parse(w.brief)?.industry || "-"; } catch {}
              return (
                <tr key={w.id} style={{ borderBottom: i < websites.length - 1 ? "1px solid var(--border)" : undefined, background: i % 2 === 0 ? "var(--surface-0)" : "var(--surface-1)" }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 flex-shrink-0" style={{ color: "var(--primary)" }} />
                      <span style={{ color: "var(--text-primary)" }}>{w.businessName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                      <span style={{ color: "var(--text-secondary)" }}>{w.user?.name || w.user?.phone || w.user?.email || "ناشناس"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{industry}</td>
                  <td className="px-4 py-3 text-center" style={{ color: "var(--text-secondary)" }}>
                    {(w.htmlCode.length / 1024).toFixed(1)} KB
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      <Clock className="w-3 h-3" />
                      {new Date(w.createdAt).toLocaleDateString("fa-IR")}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-left">
                    <a
                      href={`/api/admin/generated-websites/${w.id}/preview`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: "rgba(234,88,12,0.15)", color: "var(--primary)" }}
                    >
                      پیش‌نمایش
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
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
