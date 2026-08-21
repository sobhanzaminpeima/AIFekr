"use client";

import { useState, useEffect } from "react";
import { MapPin, Loader2, CheckCircle2 } from "lucide-react";

interface PublicProperty {
  id: string; title: string; listingType: string; propertyType: string; price: number; nightlyPrice: number | null;
  address: string; city: string | null; bedrooms: number | null; bathrooms: number | null; areaSqm: number | null;
  description: string | null; status: string;
}

const LISTING_LABEL: Record<string, string> = { buy: "خرید", sell: "فروش", rent: "اجاره", short_term_rent: "اجاره روزانه" };

export default function PublicPropertyPage({ params }: { params: { id: string } }) {
  const [property, setProperty] = useState<PublicProperty | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundErr, setNotFoundErr] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/public/property/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.property) setProperty(d.property);
        else setNotFoundErr(true);
      })
      .catch(() => setNotFoundErr(true))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function submit() {
    if (!name.trim() || !phone.trim()) { setError("نام و شماره تماس الزامی است"); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/public/property-lead", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: params.id, name: name.trim(), phone: phone.trim(), message: message.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ارسال درخواست");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--surface-0)" }}><Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--primary)" }} /></div>;
  }
  if (notFoundErr || !property) {
    return <div className="min-h-screen flex items-center justify-center" dir="rtl" style={{ background: "var(--surface-0)", color: "var(--text-primary)" }}>ملک یافت نشد</div>;
  }

  return (
    <div dir="rtl" className="min-h-screen py-10 px-4" style={{ background: "var(--surface-0)" }}>
      <div className="max-w-lg mx-auto rounded-2xl p-6 space-y-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <div>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--surface-2)", color: "var(--primary)" }}>{LISTING_LABEL[property.listingType] || property.listingType}</span>
          <h1 className="text-xl font-bold mt-2" style={{ color: "var(--text-primary)" }}>{property.title}</h1>
          <p className="text-sm flex items-center gap-1 mt-1" style={{ color: "var(--text-secondary)" }}>
            <MapPin className="w-4 h-4" /> {property.address}{property.city ? `، ${property.city}` : ""}
          </p>
        </div>

        <div className="text-2xl font-bold" style={{ color: "#f59e0b" }}>
          {property.listingType === "short_term_rent" && property.nightlyPrice
            ? `${property.nightlyPrice.toLocaleString("fa-IR")} تومان / شب`
            : `${property.price.toLocaleString("fa-IR")} تومان`}
        </div>

        <div className="flex gap-3 text-sm" style={{ color: "var(--text-secondary)" }}>
          {property.bedrooms != null && <span>{property.bedrooms} خواب</span>}
          {property.bathrooms != null && <span>{property.bathrooms} سرویس</span>}
          {property.areaSqm != null && <span>{property.areaSqm} متر</span>}
        </div>

        {property.description && <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{property.description}</p>}

        {property.status !== "available" && (
          <p className="text-sm p-3 rounded-xl" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>این ملک دیگر در دسترس نیست</p>
        )}

        <div className="pt-3 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
          {submitted ? (
            <div className="flex items-center gap-2 text-sm p-3 rounded-xl" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
              <CheckCircle2 className="w-5 h-5" /> درخواست شما ثبت شد، به‌زودی با شما تماس گرفته می‌شود.
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>برای اطلاعات بیشتر یا رزرو بازدید، اطلاعات تماس خود را بگذارید</p>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام"
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="شماره تماس"
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="توضیحات (اختیاری)"
                className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
              <button onClick={submit} disabled={submitting} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "ارسال درخواست"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
