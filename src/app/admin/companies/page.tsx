"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Building2, Mail, Phone, Globe } from "lucide-react";

type Company = {
  id: string; name: string; industry: string; website?: string; phone?: string;
  email?: string; size?: string; isActive: boolean; createdAt: string;
  user: { name?: string; email?: string; phone?: string };
  industryPack?: { name: string; emoji: string };
  category?: { name: string };
};

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/admin/companies");
    const d = await r.json();
    setCompanies(d.companies || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.user?.name || "").toLowerCase().includes(search.toLowerCase()) ||
    c.industry.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>مدیریت شرکت‌ها</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{companies.length} شرکت</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو..." className="w-full pr-10 pl-4 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
      </div>

      {loading ? (
        <div className="text-center py-20" style={{ color: "var(--text-muted)" }}>در حال بارگذاری...</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(co => (
            <div key={co.id} className="p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(234,88,12,0.12)" }}>
                    <Building2 className="w-5 h-5" style={{ color: "var(--primary)" }} />
                  </div>
                  <div>
                    <div className="font-medium" style={{ color: "var(--text-primary)" }}>{co.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{co.industry}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {co.industryPack && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(234,88,12,0.1)", color: "var(--primary)" }}>
                      {co.industryPack.emoji} {co.industryPack.name}
                    </span>
                  )}
                  {co.category && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                      {co.category.name}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${co.isActive ? "text-green-400" : "text-red-400"}`}
                    style={{ background: co.isActive ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)" }}>
                    {co.isActive ? "فعال" : "غیرفعال"}
                  </span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>کاربر: </span>{co.user?.name || co.user?.email || "—"}
                </div>
                {co.website && (
                  <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    <Globe className="w-3 h-3" />{co.website}
                  </div>
                )}
                {co.phone && (
                  <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    <Phone className="w-3 h-3" />{co.phone}
                  </div>
                )}
                {co.email && (
                  <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    <Mail className="w-3 h-3" />{co.email}
                  </div>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-20" style={{ color: "var(--text-muted)" }}>شرکتی یافت نشد</div>
          )}
        </div>
      )}
    </div>
  );
}
