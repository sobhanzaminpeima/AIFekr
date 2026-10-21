"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslation, tri } from "@/lib/i18n";
export default function DiscoveryCard({ requestId }: { requestId: string }) {
  const { lang } = useTranslation(),
    [card, setCard] = useState<{
      id: string;
      title: string;
      description: string;
      features: string[];
      href: string;
    } | null>(null),
    loaded = useRef("");
  async function event(action: string, moduleId?: string) {
    const r = await fetch("/api/ai-chat/v1/discovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, requestId, moduleId, language: lang }),
    });
    return r.json();
  }
  useEffect(() => {
    if (loaded.current === requestId) return;
    loaded.current = requestId;
    fetch("/api/ai-chat/v1/discovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "recommend", requestId, language: lang }),
    })
      .then((r) => r.json())
      .then((d) => setCard(d.card))
      .catch(() => {});
  }, [requestId, lang]);
  useEffect(() => {
    if (card)
      void fetch("/api/ai-chat/v1/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "shown",
          requestId,
          moduleId: card.id,
          language: lang,
        }),
      });
  }, [card, requestId, lang]);
  if (!card) return null;
  return (
    <aside className="chat-discovery-card">
      <small>
        {tri(
          lang,
          "ماژول مرتبط آی‌فکر · اختیاری",
          "Relevant AIFekr module · optional",
          "Passendes AIFekr-Modul · optional",
          "İlgili AIFekr modülü · isteğe bağlı",
        )}
      </small>
      <strong>{card.title}</strong>
      <p>{card.description}</p>
      <ul>
        {card.features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <a href={card.href} onClick={() => void event("click", card.id)}>
        {tri(
          lang,
          "بررسی ماژول",
          "Explore module",
          "Modul entdecken",
          "Modülü keşfet",
        )}
      </a>
      <button
        onClick={() => {
          void event("dismiss", card.id);
          setCard(null);
        }}
      >
        {tri(lang, "نشان نده", "Dismiss", "Ausblenden", "Kapat")}
      </button>
      <button
        onClick={() => {
          void event("disable");
          setCard(null);
        }}
      >
        {tri(
          lang,
          "پیشنهادها را غیرفعال کن",
          "Disable recommendations",
          "Empfehlungen deaktivieren",
          "Önerileri kapat",
        )}
      </button>
    </aside>
  );
}
