"use client";
import { useEffect, useState } from "react";
import { useTranslation, tri } from "@/lib/i18n";
import type { ChatPolicy } from "@/lib/ai-chat/policy";
import "@/components/admin/admin-workspace.css";
type Data = {
  policy: ChatPolicy;
  metrics: {
    guests: number;
    converted: number;
    chatOnly: number;
    statuses: { status: string; _count: { _all: number } }[];
    usage: {
      _sum: { credits: number | null; costUsd: number | null };
      _count: { _all: number };
    };
    discovery: { action: string; _count: { _all: number } }[];
  };
  modules: string[];
  providers: { id: string; name: string; model: string; enabled: boolean }[];
};
export default function AdminChat() {
  const { lang } = useTranslation(),
    t = (fa: string, en: string, de: string, tr: string) =>
      tri(lang, fa, en, de, tr),
    [data, setData] = useState<Data>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("overview");
  useEffect(() => {
    fetch("/api/admin/ai-chat")
      .then(async (r) => {
        if (!r.ok) throw Error("LOAD_FAILED");
        setData(await r.json());
      })
      .catch((e) => setError(e.message));
  }, []);
  async function save() {
    if (!data) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.policy),
      });
      if (!r.ok) throw Error("SAVE_FAILED");
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function update(p: Partial<ChatPolicy>) {
    if (data) setData({ ...data, policy: { ...data.policy, ...p } });
  }
  return (
    <main className="admin-workspace-page space-y-5">
      <header className="admin-page-header">
        <div>
          <span className="admin-page-kicker">AIFEKR · AI CHAT</span>
          <h1>
            {t(
              "مدیریت چت هوش مصنوعی",
              "AI Chat management",
              "KI-Chat-Verwaltung",
              "AI Sohbet yönetimi",
            )}
          </h1>
          <p>
            {t(
              "چت مستقل، سهمیه مهمان، اعتبار و پیشنهاد اختیاری ماژول‌ها. محتوای خصوصی گفتگوها در این صفحه نمایش داده نمی‌شود.",
              "Independent chat, guest quotas, credits and optional discovery. Private conversation content is not displayed here.",
              "Unabhängiger Chat, Gastkontingente, Credits und optionale Empfehlungen. Private Chatinhalte werden hier nicht angezeigt.",
              "Bağımsız sohbet, misafir kotaları, krediler ve isteğe bağlı keşif. Özel sohbet içerikleri burada gösterilmez.",
            )}
          </p>
        </div>
        <a href="/chat" className="text-orange-500">
          AIFekr AI Chat ↗
        </a>
      </header>
      <nav className="admin-section-tabs">
        {[
          ["overview", t("نمای کلی", "Overview", "Übersicht", "Genel bakış")],
          [
            "policy",
            t(
              "سهمیه و هزینه",
              "Quotas & costs",
              "Kontingente und Kosten",
              "Kotalar ve maliyet",
            ),
          ],
          [
            "discovery",
            t(
              "پیشنهاد ماژول‌ها",
              "Module discovery",
              "Modulempfehlungen",
              "Modül keşfi",
            ),
          ],
        ].map(([id, label]) => (
          <button
            key={id}
          aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert">
          {t(
            "بارگذاری یا ذخیره انجام نشد؛ دوباره تلاش کنید.",
            "Could not load or save. Please retry.",
            "Laden oder Speichern fehlgeschlagen. Erneut versuchen.",
            "Yüklenemedi veya kaydedilemedi. Tekrar deneyin.",
          )}
        </p>
      )}
      {data && (
        <>
          {tab === "overview" && (
            <>
              <div className="admin-metric-grid">
                {[
                  [
                    t(
                      "مهمان‌ها · ۷ روز",
                      "Guests · 7 days",
                      "Gäste · 7 Tage",
                      "Misafirler · 7 gün",
                    ),
                    data.metrics.guests,
                  ],
                  [
                    t(
                      "انتقال موفق به حساب",
                      "Merged into accounts",
                      "In Konten übernommen",
                      "Hesaplara aktarılan",
                    ),
                    data.metrics.converted,
                  ],
                  [
                    t(
                      "حساب فقط چت",
                      "Chat-only accounts",
                      "Nur-Chat-Konten",
                      "Yalnız sohbet hesapları",
                    ),
                    data.metrics.chatOnly,
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <small>{label}</small>
                    <strong>{Number(value).toLocaleString(lang)}</strong>
                  </div>
                ))}
              </div>
              <section className="admin-overview-card">
                <div>
                  <h2>
                    {t(
                      "مصرف و نتیجه درخواست‌ها · ۷ روز",
                      "Usage & request results · 7 days",
                      "Nutzung und Anfrageergebnisse · 7 Tage",
                      "Kullanım ve istek sonuçları · 7 gün",
                    )}
                  </h2>
                  <p>
                    {data.metrics.statuses
                      .map((s) => `${s.status}: ${s._count._all}`)
                      .join(" · ")}
                  </p>
                  <p>
                    {t(
                      "کردیت مصرف‌شده",
                      "Credits used",
                      "Verwendete Credits",
                      "Kullanılan krediler",
                    )}
                    : {data.metrics.usage._sum.credits ?? 0} ·{" "}
                    {t(
                      "هزینه تخمینی API",
                      "Estimated API cost",
                      "Geschätzte API-Kosten",
                      "Tahmini API maliyeti",
                    )}
                    : ${(data.metrics.usage._sum.costUsd ?? 0).toFixed(4)}
                  </p>
                </div>
              </section>
              {data.providers.map((p) => (
                <section key={p.id} className="admin-overview-card">
                  <div>
                    <h2>{p.name}</h2>
                    <p dir="ltr">{p.model}</p>
                    <p>
                      {p.enabled
                        ? t(
                            "ارائه‌دهنده فعال",
                            "Provider enabled",
                            "Anbieter aktiviert",
                            "Sağlayıcı etkin",
                          )
                        : t(
                            "ارائه‌دهنده غیرفعال",
                            "Provider disabled",
                            "Anbieter deaktiviert",
                            "Sağlayıcı devre dışı",
                          )}
                    </p>
                  </div>
                  <a href="/admin/llm" className="text-orange-500">
                    {t(
                      "مدیریت مدل‌ها",
                      "Manage models",
                      "Modelle verwalten",
                      "Modelleri yönet",
                    )}
                  </a>
                </section>
              ))}
            </>
          )}
          {tab === "policy" && (
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <label className="flex gap-3 items-center">
                <input
                  type="checkbox"
                  checked={data.policy.enabled}
                  onChange={(e) => update({ enabled: e.target.checked })}
                />
                {t(
                  "فعال‌سازی چت مستقل",
                  "Enable independent chat",
                  "Unabhängigen Chat aktivieren",
                  "Bağımsız sohbeti etkinleştir",
                )}
              </label>
              <div className="grid sm:grid-cols-2 gap-4">
                {(
                  [
                    [
                      "guestTurns",
                      t(
                        "پیام رایگان مهمان",
                        "Free guest turns",
                        "Kostenlose Gastnachrichten",
                        "Ücretsiz misafir mesajları",
                      ),
                      0,
                      10,
                    ],
                    [
                      "guestTtlHours",
                      t(
                        "نگهداری مهمان · ساعت",
                        "Guest retention · hours",
                        "Gastaufbewahrung · Stunden",
                        "Misafir saklama · saat",
                      ),
                      1,
                      168,
                    ],
                    [
                      "registeredFreeDaily",
                      t(
                        "سهمیه رایگان روزانه حساب",
                        "Daily account free turns",
                        "Tägliche kostenlose Nachrichten",
                        "Günlük ücretsiz hesap mesajları",
                      ),
                      0,
                      100,
                    ],
                    [
                      "creditsPerTurn",
                      t(
                        "کردیت هر پیام موفق پس از سهمیه",
                        "Credits per success after allowance",
                        "Credits je Erfolg nach Kontingent",
                        "Hak sonrası başarılı mesaj kredisi",
                      ),
                      1,
                      100,
                    ],
                    [
                      "dailyRequests",
                      t(
                        "سقف درخواست کل روزانه",
                        "Global daily request cap",
                        "Globales Tageslimit",
                        "Genel günlük istek sınırı",
                      ),
                      1,
                      10000,
                    ],
                    [
                      "dailyBudgetUsd",
                      t(
                        "بودجه API روزانه · دلار",
                        "Daily API budget · USD",
                        "API-Tagesbudget · USD",
                        "Günlük API bütçesi · USD",
                      ),
                      0.05,
                      1000,
                    ],
                  ] as const
                ).map(([key, label, min, max]) => (
                  <label key={key} className="grid gap-2">
                    {label}
                    <input
                      type="number"
                      required
                      min={min}
                      max={max}
                      step={key === "dailyBudgetUsd" ? 0.05 : 1}
                      value={data.policy[key]}
                      onChange={(e) =>
                        update({ [key]: Number(e.target.value) })
                      }
                    />
                  </label>
                ))}
              </div>
              <button className="admin-action" disabled={busy}>
                {t(
                  "ذخیره سیاست‌ها",
                  "Save policy",
                  "Richtlinie speichern",
                  "Politikayı kaydet",
                )}
              </button>
            </form>
          )}
          {tab === "discovery" && (
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <label className="flex gap-3">
                <input
                  type="checkbox"
                  checked={data.policy.discoveryEnabled}
                  onChange={(e) =>
                    update({ discoveryEnabled: e.target.checked })
                  }
                />
                {t(
                  "پیشنهاد اختیاری ماژول پس از پاسخ",
                  "Optional module suggestions after answers",
                  "Optionale Modulempfehlungen nach Antworten",
                  "Yanıtlardan sonra isteğe bağlı modül önerileri",
                )}
              </label>
              <label className="grid gap-2">
                {t(
                  "حداقل اطمینان",
                  "Minimum confidence",
                  "Mindestkonfidenz",
                  "Asgari güven",
                )}
                <input
                  type="number"
                  min=".5"
                  max="1"
                  step=".05"
                  value={data.policy.discoveryThreshold}
                  onChange={(e) =>
                    update({ discoveryThreshold: +e.target.value })
                  }
                />
              </label>
              <label className="grid gap-2">
                {t(
                  "حداقل فاصله پیشنهاد · پاسخ موفق",
                  "Minimum spacing · successful answers",
                  "Mindestabstand · erfolgreiche Antworten",
                  "Asgari aralık · başarılı yanıtlar",
                )}
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={data.policy.discoveryFrequency}
                  onChange={(e) =>
                    update({ discoveryFrequency: +e.target.value })
                  }
                />
              </label>
              <div className="grid sm:grid-cols-2 gap-3">
                {data.modules.map((m) => (
                  <label key={m} className="flex gap-3 rounded-xl border p-4">
                    <input
                      type="checkbox"
                      checked={!data.policy.disabledModules.includes(m)}
                      onChange={(e) =>
                        update({
                          disabledModules: e.target.checked
                            ? data.policy.disabledModules.filter((v) => v !== m)
                            : [...data.policy.disabledModules, m],
                        })
                      }
                    />
                    {m}
                  </label>
                ))}
              </div>
              <p className="text-xs opacity-70">
                {data.metrics.discovery
                  .map((e) => `${e.action}: ${e._count._all}`)
                  .join(" · ")}
              </p>
              <button className="admin-action" disabled={busy}>
                {t(
                  "ذخیره پیشنهادها",
                  "Save discovery",
                  "Empfehlungen speichern",
                  "Keşfi kaydet",
                )}
              </button>
            </form>
          )}
        </>
      )}
    </main>
  );
}
