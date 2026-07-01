"use client";

import { useState } from "react";
import { Save, User, Lock } from "lucide-react";
import toast from "react-hot-toast";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    toast.success("تنظیمات ذخیره شد");
  }

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>تنظیمات حساب</h1>

      <div className="p-5 rounded-2xl space-y-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 mb-2">
          <User className="w-5 h-5" style={{ color: "var(--primary)" }} />
          <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>اطلاعات شخصی</h2>
        </div>
        <div>
          <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>نام نمایشی</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام خود را وارد کنید"
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
          style={{ background: "var(--primary)" }}>
          <Save className="w-4 h-4" />
          {saving ? "در حال ذخیره..." : "ذخیره"}
        </button>
      </div>
    </div>
  );
}
