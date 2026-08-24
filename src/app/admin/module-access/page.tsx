"use client";

import { useState, useEffect, useCallback } from "react";
import { ToggleLeft, ToggleRight, Search, Layers, UserCog } from "lucide-react";
import toast from "react-hot-toast";

type Pack = { id: string; slug: string; name: string; emoji: string };
type ModuleRow = { key: string; category: "crm" | "agent"; labelFa: string; labelEn: string; enabled: boolean };
type OverrideModuleRow = { key: string; category: "crm" | "agent"; labelFa: string; labelEn: string; override: boolean | null };
type SearchedUser = { id: string; name: string | null; phone: string | null; industryPackId: string | null };

export default function ModuleAccessAdminPage() {
  const [tab, setTab] = useState<"packs" | "customers">("packs");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>مدیریت دسترسی ماژول‌ها</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          کنترل نمایش ماژول‌های CRM و ایجنت‌ها بر اساس پک صنعتی، با امکان استثنا برای مشتریان خاص
        </p>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab("packs")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: tab === "packs" ? "var(--primary)" : "var(--surface-2)", color: tab === "packs" ? "#fff" : "var(--text-secondary)" }}>
          <Layers className="w-4 h-4" /> پیش‌فرض پک‌ها
        </button>
        <button onClick={() => setTab("customers")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: tab === "customers" ? "var(--primary)" : "var(--surface-2)", color: tab === "customers" ? "#fff" : "var(--text-secondary)" }}>
          <UserCog className="w-4 h-4" /> استثنای مشتری
        </button>
      </div>

      {tab === "packs" ? <PackDefaultsTab /> : <CustomerOverridesTab />}
    </div>
  );
}

function PackDefaultsTab() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingModules, setLoadingModules] = useState(false);

  const loadPacks = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/industry-packs", { credentials: "include" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "خطا در دریافت پک‌ها");
      setPacks(d.packs || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "خطا در دریافت پک‌ها");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPacks(); }, [loadPacks]);

  const loadModules = useCallback(async (pack: Pack) => {
    setSelectedPack(pack);
    setLoadingModules(true);
    try {
      const r = await fetch(`/api/admin/industry-packs/${pack.id}/modules`, { credentials: "include" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "خطا در دریافت ماژول‌ها");
      setModules(d.modules || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "خطا در دریافت ماژول‌ها");
      setModules([]);
    } finally {
      setLoadingModules(false);
    }
  }, []);

  async function toggleModule(m: ModuleRow) {
    if (!selectedPack) return;
    const next = !m.enabled;
    setModules(prev => prev.map(x => x.key === m.key ? { ...x, enabled: next } : x));
    const r = await fetch(`/api/admin/industry-packs/${selectedPack.id}/modules`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleKey: m.key, enabled: next }),
    });
    if (!r.ok) {
      toast.error("خطا در ذخیره — تغییر بازگردانده شد");
      setModules(prev => prev.map(x => x.key === m.key ? { ...x, enabled: !next } : x));
    }
  }

  if (loading) return <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>در حال بارگذاری...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="space-y-2">
        {packs.map(p => (
          <button key={p.id} onClick={() => loadModules(p)}
            className="w-full flex items-center gap-3 p-3 rounded-xl text-right"
            style={{
              background: selectedPack?.id === p.id ? "var(--surface-2)" : "var(--surface-1)",
              border: `1px solid ${selectedPack?.id === p.id ? "var(--primary)" : "var(--border)"}`,
            }}>
            <span className="text-xl">{p.emoji}</span>
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{p.name}</span>
          </button>
        ))}
      </div>

      <div className="md:col-span-2">
        {!selectedPack ? (
          <div className="text-center py-16 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
            یک پک صنعتی را از سمت راست انتخاب کنید
          </div>
        ) : loadingModules ? (
          <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>در حال بارگذاری ماژول‌ها...</div>
        ) : modules.length === 0 ? (
          <div className="text-center py-16 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
            ماژول گیت‌شده‌ای برای این صنعت تعریف نشده است
          </div>
        ) : (
          <div className="space-y-3">
            <ModuleGroup title="ماژول‌های CRM" items={modules.filter(m => m.category === "crm")} onToggle={toggleModule} />
            <ModuleGroup title="ایجنت‌های تخصصی" items={modules.filter(m => m.category === "agent")} onToggle={toggleModule} />
          </div>
        )}
      </div>
    </div>
  );
}

function ModuleGroup({ title, items, onToggle }: { title: string; items: ModuleRow[]; onToggle: (m: ModuleRow) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
      <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text-secondary)" }}>{title}</h3>
      <div className="space-y-2">
        {items.map(m => (
          <div key={m.key} className="flex items-center justify-between p-2.5 rounded-xl" style={{ background: "var(--surface-2)" }}>
            <div>
              <div className="text-sm" style={{ color: "var(--text-primary)" }}>{m.labelFa}</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }} dir="ltr">{m.labelEn} · {m.key}</div>
            </div>
            <button onClick={() => onToggle(m)} style={{ color: m.enabled ? "var(--primary)" : "var(--text-muted)" }}>
              {m.enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomerOverridesTab() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<SearchedUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchedUser | null>(null);
  const [modules, setModules] = useState<OverrideModuleRow[]>([]);
  const [loadingModules, setLoadingModules] = useState(false);

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const r = await fetch(`/api/admin/users?search=${encodeURIComponent(query)}`, { credentials: "include" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "خطا در جستجو");
      setUsers(d.users || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "خطا در جستجو");
    } finally {
      setSearching(false);
    }
  }

  async function selectUser(u: SearchedUser) {
    setSelectedUser(u);
    setLoadingModules(true);
    try {
      const r = await fetch(`/api/admin/users/${u.id}/module-overrides`, { credentials: "include" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "خطا در دریافت استثناها");
      setModules(d.modules || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "خطا در دریافت استثناها");
      setModules([]);
    } finally {
      setLoadingModules(false);
    }
  }

  async function setOverride(m: OverrideModuleRow, value: boolean | null) {
    if (!selectedUser) return;
    const prev = m.override;
    setModules(list => list.map(x => x.key === m.key ? { ...x, override: value } : x));
    const r = await fetch(`/api/admin/users/${selectedUser.id}/module-overrides`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleKey: m.key, enabled: value }),
    });
    if (!r.ok) {
      toast.error("خطا در ذخیره — تغییر بازگردانده شد");
      setModules(list => list.map(x => x.key === m.key ? { ...x, override: prev } : x));
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && search()}
            placeholder="جستجوی مشتری با نام یا شماره..." className="w-full pr-10 pl-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        </div>
        <button onClick={search} disabled={searching} className="w-full py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
          {searching ? "..." : "جستجو"}
        </button>
        <div className="space-y-2">
          {users.map(u => (
            <button key={u.id} onClick={() => selectUser(u)}
              className="w-full flex flex-col items-start p-3 rounded-xl text-right"
              style={{ background: selectedUser?.id === u.id ? "var(--surface-2)" : "var(--surface-1)", border: `1px solid ${selectedUser?.id === u.id ? "var(--primary)" : "var(--border)"}` }}>
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{u.name || "بدون نام"}</span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }} dir="ltr">{u.phone}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="md:col-span-2">
        {!selectedUser ? (
          <div className="text-center py-16 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
            یک مشتری را جستجو و انتخاب کنید
          </div>
        ) : loadingModules ? (
          <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>در حال بارگذاری...</div>
        ) : (
          <div className="rounded-2xl p-4 space-y-2" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
              «استثنا» بر پیش‌فرض پک صنعتی مشتری اولویت دارد. حالت «پیش‌فرض» یعنی استثنایی ثبت نشده و تنظیم پک اعمال می‌شود.
            </p>
            {modules.map(m => (
              <div key={m.key} className="flex items-center justify-between p-2.5 rounded-xl" style={{ background: "var(--surface-2)" }}>
                <div>
                  <div className="text-sm" style={{ color: "var(--text-primary)" }}>{m.labelFa}</div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }} dir="ltr">{m.labelEn} · {m.key}</div>
                </div>
                <div className="flex gap-1">
                  {([
                    { v: true as boolean | null, label: "فعال" },
                    { v: null, label: "پیش‌فرض" },
                    { v: false as boolean | null, label: "غیرفعال" },
                  ]).map(opt => (
                    <button key={String(opt.v)} onClick={() => setOverride(m, opt.v)}
                      className="px-2.5 py-1 rounded-lg text-xs"
                      style={{
                        background: m.override === opt.v ? "var(--primary)" : "var(--surface-1)",
                        color: m.override === opt.v ? "#fff" : "var(--text-secondary)",
                        border: "1px solid var(--border)",
                      }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
