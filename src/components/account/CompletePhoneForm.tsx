"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Smartphone } from "lucide-react";

type Copy = { title: string; body: string; country: string; phone: string; save: string; required: string; invalid: string; logout: string };
type Data = { required: boolean; hasPhone: boolean; lang: string; copy: Copy; countries: { code: string; name: string; dialCode: string }[] };

/** Classic theme: the required mobile-number step (the new design has its own screen for the same API). */
export default function CompletePhoneForm() {
  const params = useSearchParams();
  const [data, setData] = useState<Data | null>(null), [country, setCountry] = useState("IR"), [phone, setPhone] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const redirect = params.get("redirect") || "";
  useEffect(() => {
    fetch("/api/account/phone", { cache: "no-store" }).then(r => r.json()).then((d: Data) => {
      if (d.hasPhone) { location.replace(redirect || "/home"); return; }
      setData(d);
    }).catch(() => setError("…"));
  }, [redirect]);
  if (!data) return <div className="min-h-[60vh] grid place-items-center text-sm" style={{ color: "var(--text-muted)" }}>{error || "…"}</div>;
  const c = data.copy, fa = data.lang === "fa", dial = data.countries.find(x => x.code === country)?.dialCode ?? "";
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return setError(c.required);
    setBusy(true); setError("");
    const r = await fetch("/api/account/phone", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ country, phone, redirect, lang: data!.lang }) }).catch(() => null);
    const d = await r?.json().catch(() => ({}));
    if (r?.ok) location.replace(d.redirect || "/home"); else { setError(d?.error || c.invalid); setBusy(false); }
  }
  const field = { background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" };
  return <div className="min-h-[70vh] grid place-items-center p-4" dir={fa ? "rtl" : "ltr"}>
    <form onSubmit={submit} className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
      <h1 className="flex items-center gap-2 text-lg font-bold" style={{ color: "var(--text-primary)" }}><Smartphone className="w-5 h-5" style={{ color: "var(--primary)" }}/>{c.title}</h1>
      <p className="text-sm leading-7" style={{ color: "var(--text-secondary)" }}>{c.body}</p>
      <label className="block text-sm" style={{ color: "var(--text-secondary)" }}>{c.country}
        <select value={country} onChange={e => setCountry(e.target.value)} className="mt-1.5 w-full px-4 py-3 rounded-xl text-sm" style={field}>{data.countries.map(x => <option key={x.code} value={x.code}>{x.name}</option>)}</select>
      </label>
      <label className="block text-sm" style={{ color: "var(--text-secondary)" }}>{c.phone} <span aria-hidden="true" style={{ color: "var(--primary)" }}>*</span>
        <span className="mt-1.5 flex gap-2" dir="ltr">
          {dial && <span className="flex items-center px-3 rounded-xl text-sm" style={field}>{dial}</span>}
          <input type="tel" required aria-required="true" autoComplete="tel-national" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder={country === "IR" ? "9123456789" : "123456789"} className="flex-1 min-w-0 px-4 py-3 rounded-xl text-sm outline-none" style={field}/>
        </span>
      </label>
      {error && <p role="alert" className="text-sm" style={{ color: "#ef4444" }}>{error}</p>}
      <button disabled={busy} className="w-full py-3 rounded-xl text-sm font-semibold text-white" style={{ background: "var(--primary)", opacity: busy ? .7 : 1 }}>{c.save}</button>
      <button type="button" onClick={() => { void fetch("/api/auth/logout", { method: "POST" }).finally(() => location.replace("/login")); }} className="block w-full text-center text-xs" style={{ color: "var(--text-muted)" }}>{c.logout}</button>
    </form>
  </div>;
}
