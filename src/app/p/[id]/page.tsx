"use client";

import { useState, useEffect } from "react";
import { MapPin, Loader2, CheckCircle2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { tri } from "@/lib/i18n/tri";
import { formatListingPrice } from "@/lib/industry/realEstate/listingFormat";

interface PublicProperty {
  id: string; title: string; listingType: string; propertyType: string; price: number; nightlyPrice: number | null;
  address: string; city: string | null; bedrooms: number | null; bathrooms: number | null; areaSqm: number | null;
  description: string | null; status: string; currency: string; images: string[];
}

// This is the page an agent sends to their own prospective buyer, so it was
// the worst place in the product to be Persian-only: a German or Turkish
// agent had no shareable listing page their client could actually read.
const LISTING_LABEL_FA: Record<string, string> = { buy: "خرید", sell: "فروش", rent: "اجاره", short_term_rent: "اجاره روزانه" };
const LISTING_LABEL_EN: Record<string, string> = { buy: "For purchase", sell: "For sale", rent: "For rent", short_term_rent: "Short-term rental" };
const LISTING_LABEL_DE: Record<string, string> = { buy: "Zum Kauf", sell: "Zum Verkauf", rent: "Zur Miete", short_term_rent: "Kurzzeitmiete" };

export default function PublicPropertyPage({ params }: { params: { id: string } }) {
  const { lang } = useTranslation();
  const dir = lang === "fa" ? "rtl" : "ltr";
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
    if (!name.trim() || !phone.trim()) { setError(tri(lang, "نام و شماره تماس الزامی است", "Name and phone number are required", "Name und Telefonnummer sind erforderlich")); return; }
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
      setError(e instanceof Error ? e.message : tri(lang, "خطا در ارسال درخواست", "Could not send your request", "Anfrage konnte nicht gesendet werden"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--surface-0)" }}><Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--primary)" }} /></div>;
  }
  if (notFoundErr || !property) {
    return <div className="min-h-screen flex items-center justify-center" dir={dir} style={{ background: "var(--surface-0)", color: "var(--text-primary)" }}>{tri(lang, "ملک یافت نشد", "Property not found", "Objekt nicht gefunden")}</div>;
  }

  return (
    <div dir={dir} className="min-h-screen py-10 px-4" style={{ background: "var(--surface-0)" }}>
      <div className="max-w-lg mx-auto rounded-2xl overflow-hidden space-y-4 pb-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        {/* This used to be nowhere on the page a lead actually sees, even
            when photos existed -- the public API never returned them. */}
        {property.images.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto" style={{ scrollSnapType: "x mandatory" }}>
            {property.images.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={url} alt={`${property.title} ${i + 1}`}
                className="h-56 w-full flex-shrink-0 object-cover"
                style={{ scrollSnapAlign: "start" }} />
            ))}
          </div>
        )}
        <div className="px-6 pt-6 space-y-4">
          <div>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--surface-2)", color: "var(--primary)" }}>{tri(lang, LISTING_LABEL_FA, LISTING_LABEL_EN, LISTING_LABEL_DE)[property.listingType] || property.listingType}</span>
            <h1 className="text-xl font-bold mt-2" style={{ color: "var(--text-primary)" }}>{property.title}</h1>
            <p className="text-sm flex items-center gap-1 mt-1" style={{ color: "var(--text-secondary)" }}>
              <MapPin className="w-4 h-4" /> {property.address}{property.city ? `${tri(lang, "، ", ", ", ", ")}${property.city}` : ""}
            </p>
          </div>

          <div className="text-2xl font-bold" style={{ color: "#f59e0b" }}>
            {property.listingType === "short_term_rent" && property.nightlyPrice
              ? `${formatListingPrice(property.nightlyPrice, property.currency, lang)}${tri(lang, " / شب", " / night", " / Nacht")}`
              : formatListingPrice(property.price, property.currency, lang)}
          </div>

          <div className="flex gap-3 text-sm" style={{ color: "var(--text-secondary)" }}>
            {property.bedrooms != null && <span>{tri(lang, `${property.bedrooms} خواب`, `${property.bedrooms} bedrooms`, `${property.bedrooms} Schlafzimmer`)}</span>}
            {property.bathrooms != null && <span>{tri(lang, `${property.bathrooms} سرویس`, `${property.bathrooms} bathrooms`, `${property.bathrooms} Badezimmer`)}</span>}
            {property.areaSqm != null && <span>{tri(lang, `${property.areaSqm} متر`, `${property.areaSqm} sqm`, `${property.areaSqm} m²`)}</span>}
          </div>

          {property.description && <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{property.description}</p>}

          {property.status !== "available" && (
            <p className="text-sm p-3 rounded-xl" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>{tri(lang, "این ملک دیگر در دسترس نیست", "This property is no longer available", "Dieses Objekt ist nicht mehr verfügbar")}</p>
          )}

          <div className="pt-3 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
            {submitted ? (
              <div className="flex items-center gap-2 text-sm p-3 rounded-xl" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
                <CheckCircle2 className="w-5 h-5" /> {tri(lang, "درخواست شما ثبت شد، به‌زودی با شما تماس گرفته می‌شود.", "Your request has been received. We will contact you shortly.", "Ihre Anfrage ist eingegangen. Wir melden uns in Kürze bei Ihnen.")}
              </div>
            ) : (
              <>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{tri(lang, "برای اطلاعات بیشتر یا رزرو بازدید، اطلاعات تماس خود را بگذارید", "Leave your contact details for more information or to book a viewing", "Hinterlassen Sie Ihre Kontaktdaten für weitere Informationen oder einen Besichtigungstermin")}</p>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tri(lang, "نام", "Name", "Name")}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={tri(lang, "شماره تماس", "Phone number", "Telefonnummer")}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder={tri(lang, "توضیحات (اختیاری)", "Message (optional)", "Nachricht (optional)")}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
                <button onClick={submit} disabled={submitting} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : tri(lang, "ارسال درخواست", "Send request", "Anfrage senden")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
