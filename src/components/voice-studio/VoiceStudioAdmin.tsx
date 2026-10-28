"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation, tri } from "@/lib/i18n";
import type { VoicePolicy } from "@/lib/voice-studio/domain";
import type { SpeechCatalog } from "@/lib/voice-studio/provider";
import "./voice-studio.css";
import {voiceErrorMessage} from "@/lib/voice-studio/errors";
type Row = {
    id: string;
    userId: string;
    status: string;
    modelId: string;
    reservedCredits: number;
    chargedCredits: number;
    refundedCredits: number;
    providerCostUsd: number | null;
    providerRequestId: string | null;
    errorCode: string | null;
    durationMs: number | null;
};
type AdminData = {
    settings: VoicePolicy;
    configured: boolean;
    privateStorage: boolean;
    workerHeartbeat: string | null;
    catalog: SpeechCatalog | null;
    rows: Row[];
    totals: {
        _sum: {
            chargedCredits: number | null;
            refundedCredits: number | null;
            providerCostUsd: number | null;
        };
        _count: number;
    };
};
export default function VoiceStudioAdmin() {
    const { lang } = useTranslation(), t = (fa: string, en: string, de: string, tr: string) => tri(lang, fa, en, de, tr);
    const [data, setData] = useState<AdminData | null>(null), [settings, setSettings] = useState<VoicePolicy | null>(null), [secret, setSecret] = useState(""), [advanced, setAdvanced] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [note, setNote] = useState(""), [reviewId, setReviewId] = useState(""), [confirmed, setConfirmed] = useState(false), [filter, setFilter] = useState("");
    async function load() { const r = await fetch("/api/admin/voice-studio", { cache: "no-store" }); const d = await r.json(); if (!r.ok)
        throw Error(d.code || "ADMIN_REQUIRED"); setData(d); setSettings(d.settings); setAdvanced(JSON.stringify({ allowedPlans: d.settings.allowedPlans, allowedVoices: d.settings.allowedVoices, modelUsdPer1k: d.settings.modelUsdPer1k, priceSource: d.settings.priceSource, priceVerifiedAt: d.settings.priceVerifiedAt, creditUsd: d.settings.creditUsd }, null, 2)); }
    useEffect(() => { const timer=setTimeout(()=>void load().catch(() => setError("ADMIN_DATA_UNAVAILABLE")),0);return()=>clearTimeout(timer); }, []);
    async function act(body: {action:string;[key:string]:unknown}) { setBusy(true); setError(""); try {
        const r = await fetch("/api/admin/voice-studio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const d = await r.json();
        if (!r.ok)
            throw Error(d.code || "REQUEST_FAILED");
        if(body.action==="test"){setData(previous=>previous?{...previous,catalog:d}:previous);}
        else {setSecret("");await load();}
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "REQUEST_FAILED");
    }
    finally {
        setBusy(false);
    } }
    if (!data || !settings)
        return <div className="vs-shell">{error || "…"}</div>;
    return <main className="vs-shell" dir={lang === "fa" ? "rtl" : "ltr"}><header className="vs-header"><div><span className="vs-eyebrow">AIFekr · Admin</span><h1>{t("مدیریت استودیوی صدا", "Voice Studio management", "Sprachstudio verwalten", "Ses stüdyosu yönetimi")}</h1><p>{t("مدیریت ارائه‌دهنده، تعرفه، ظرفیت و بررسی رزروهای نامشخص.", "Provider, pricing, capacity and uncertain-reservation review.", "Anbieter, Preise, Kapazität und Prüfung unklarer Reservierungen.", "Sağlayıcı, tarife, kapasite ve belirsiz rezervasyon incelemesi.")}</p></div><Link href="/voice-studio">{t("بازکردن استودیو", "Open studio", "Studio öffnen", "Stüdyoyu aç")}</Link></header>{error && <p role="alert" className="vs-error">{voiceErrorMessage(error,lang)}</p>}
 <section className="vs-panel"><h2>{t("آمادگی اتصال", "Readiness", "Bereitschaft", "Hazırlık")}</h2><p>{t("کلید پیکربندی شده", "Credential configured", "Zugangsdaten vorhanden", "Anahtar yapılandırıldı")}: {data.configured ? "✓" : "—"} · R2: {data.privateStorage ? "✓" : "—"}</p><p>{t("آخرین اجرای worker", "Worker heartbeat", "Worker-Heartbeat", "Worker son çalışma")}: {data.workerHeartbeat || "—"}</p><button disabled={busy} onClick={() => void act({ action: "test", ...(secret?{secret}:{}) })}>{t("تست بدون هزینه و دریافت صداها/مدل‌ها", "Test connection and discover voices/models (no synthesis)", "Verbindung testen und Stimmen/Modelle laden", "Bağlantıyı test et ve ses/model listesini al")}</button><p className="vs-muted">{t("خطای 403 یا نبود ذخیره‌سازی مانع فعال‌سازی است. هیچ تست پولی با این دکمه اجرا نمی‌شود.", "403 or missing private storage blocks activation. This button never runs a paid generation.", "403 oder fehlender privater Speicher verhindert die Aktivierung. Keine kostenpflichtige Generierung.", "403 veya özel depolama eksikliği etkinleştirmeyi engeller. Ücretli üretim yapılmaz.")}</p></section>
 <section className="vs-panel"><h2>{t("تنظیمات و نسخهٔ تعرفه", "Settings and pricing version", "Einstellungen und Preisversion", "Ayarlar ve tarife sürümü")} · {settings.version}</h2><label className="vs-check"><input type="checkbox" checked={settings.enabled} onChange={e => setSettings({ ...settings, enabled: e.target.checked })}/>{t("فعال‌سازی تولید", "Enable generation", "Generierung aktivieren", "Üretimi etkinleştir")}</label><label>{t("کلید جدید ElevenLabs؛ خالی یعنی بدون تغییر", "New ElevenLabs key; leave blank to keep current", "Neuer ElevenLabs-Schlüssel; leer = unverändert", "Yeni ElevenLabs anahtarı; boş bırakılırsa değişmez")}<input type="password" autoComplete="new-password" value={secret} onChange={e => setSecret(e.target.value)}/></label><div className="vs-two"><label>{t("کردیت هر بازه", "Credits per interval", "Credits pro Intervall", "Aralık başına kredi")}<input type="number" min={1} max={10000} value={settings.creditsPerInterval} onChange={e => setSettings({ ...settings, creditsPerInterval: Number(e.target.value) })}/></label><label>{t("بازهٔ صورتحساب (ثانیه)", "Billing interval (seconds)", "Abrechnungsintervall (Sekunden)", "Hesaplama aralığı (saniye)")}<select value={settings.billingInterval} onChange={e => setSettings({ ...settings, billingInterval: Number(e.target.value) as 20 | 30 })}><option value={30}>30</option><option value={20}>20</option></select></label>{(["maxCharacters", "maxDurationSeconds", "maxConcurrent", "maxPendingPerUser", "dailyJobs", "retentionDays", "trialGenerations", "trialMaxSeconds"] as const).map(key => <label key={key}>{({ maxCharacters: t("سقف نویسهٔ پروژه", "Project character limit", "Zeichenlimit pro Projekt", "Proje karakter sınırı"), maxDurationSeconds: t("سقف ثانیهٔ هر خروجی", "Maximum seconds per output", "Max. Sekunden pro Ausgabe", "Çıktı başına azami saniye"), maxConcurrent: t("هم‌زمانی سراسری", "Global concurrency", "Globale Parallelität", "Genel eşzamanlılık"), maxPendingPerUser: t("سقف کارهای معلق هر کاربر", "Pending jobs per user", "Offene Jobs pro Benutzer", "Kullanıcı başına bekleyen işler"), dailyJobs: t("کارهای روزانهٔ هر کاربر", "Daily jobs per user", "Tägliche Jobs pro Benutzer", "Kullanıcı başına günlük işler"), retentionDays: t("روزهای نگهداری فایل", "File retention days", "Aufbewahrungstage", "Dosya saklama günleri"), trialGenerations: t("نمونهٔ آزمایشی برای پلن‌های دیگر (۰ = خاموش)", "Trial samples for other plans (0 = off)", "Testmuster für andere Pakete (0 = aus)", "Diğer paketler için deneme (0 = kapalı)"), trialMaxSeconds: t("سقف ثانیهٔ نمونهٔ آزمایشی", "Trial sample max seconds", "Max. Sekunden Testmuster", "Deneme azami saniye") })[key]}<input type="number" value={settings[key]} onChange={e => setSettings({ ...settings, [key]: Number(e.target.value) })}/></label>)}</div><h3>{t("مدل‌های مجاز", "Approved models", "Freigegebene Modelle", "Onaylı modeller")}</h3>{data.catalog?.models.map(m => <label key={m.id} className="vs-check"><input type="checkbox" checked={settings.allowedModels.includes(m.id)} onChange={e => setSettings({ ...settings, allowedModels: e.target.checked ? [...settings.allowedModels, m.id] : settings.allowedModels.filter(id => id !== m.id) })}/>{m.name} · {m.languages.map(l => l.id).join(", ")}</label>)}<details><summary>{t("پلن‌ها، صداها و هزینهٔ ارائه‌دهنده", "Plans, voice allowlist and provider costs", "Tarife, Stimmen und Anbieterkosten", "Planlar, ses izin listesi ve sağlayıcı maliyeti")}</summary><p className="vs-muted">{t("modelUsdPer1k هزینهٔ دلار به ازای ۱۰۰۰ نویسه است؛ مقدار نامعلوم را وارد نکنید. منبع و تاریخ تأیید برای قیمت‌ها الزامی است.", "modelUsdPer1k is USD per 1,000 characters. Leave unknown costs unset. Prices require source and verification date.", "modelUsdPer1k: USD je 1.000 Zeichen. Unbekannte Kosten nicht eintragen. Quelle und Prüftermin erforderlich.", "modelUsdPer1k: 1.000 karakter başına USD. Bilinmeyen maliyeti boş bırakın. Kaynak ve doğrulama tarihi gerekir.")}</p><textarea aria-label="Advanced configuration JSON" rows={14} dir="ltr" value={advanced} onChange={e => setAdvanced(e.target.value)}/></details><button className="vs-primary" disabled={busy} onClick={() => { try {
        void act({ action: "settings", settings: { ...settings, ...JSON.parse(advanced) }, ...(secret ? { secret } : {}) });
    }
    catch {
        setError("INVALID_JSON");
    } }}>{t("ذخیره و ثبت نسخهٔ جدید", "Save new version", "Neue Version speichern", "Yeni sürümü kaydet")}</button></section>
 <section className="vs-panel"><h2>{t("مصرف و هزینه", "Usage and cost", "Nutzung und Kosten", "Kullanım ve maliyet")}</h2><p>{data.totals._count} {t("تولید ثبت‌شده", "generation records", "Generierungseinträge", "üretim kaydı")} · {data.totals._sum.chargedCredits || 0} {t("کردیت مصرفی", "credits charged", "verbrauchte Credits", "harcanan kredi")} · {data.totals._sum.refundedCredits || 0} {t("کردیت برگشتی", "credits refunded", "erstattete Credits", "iade kredi")}</p><p>{t("هزینهٔ برآوردشدهٔ دارای تعرفه", "Estimated cost with configured rates", "Geschätzte Kosten mit bestätigten Preisen", "Yapılandırılmış tarifeyle tahmini maliyet")}: {data.totals._sum.providerCostUsd ?? "—"} USD</p>{settings.creditUsd !== null && data.rows.some(r => r.providerCostUsd !== null && r.chargedCredits * settings.creditUsd! < r.providerCostUsd) && <p className="vs-error">{t("برخی خروجی‌ها ممکن است زیان‌ده باشند؛ هزینه و تعرفه را بررسی کنید.", "Some outputs may be unprofitable. Review provider costs and credit pricing.", "Einige Ausgaben können unwirtschaftlich sein. Kosten und Preise prüfen.", "Bazı çıktılar zarar ettirebilir. Maliyet ve kredi tarifesini inceleyin.")}</p>}<label>{t("فیلتر کاربر، وضعیت یا شناسه", "Filter user, status or ID", "Nach Benutzer, Status oder ID filtern", "Kullanıcı, durum veya kimliğe göre filtrele")}<input value={filter} onChange={e => setFilter(e.target.value)}/></label><div className="vs-table-wrap"><table className="vs-admin-table"><thead><tr>{["ID / User", "Status", "Model", "Reserved", "Charged", "Refunded", "USD", "Provider request"].map(v => <th key={v}>{v}</th>)}</tr></thead><tbody>{data.rows.filter(r => `${r.id} ${r.userId} ${r.status}`.includes(filter)).map(r => <tr key={r.id}><td>{r.id}<br />{r.userId}</td><td>{r.status}<small>{r.errorCode}</small>{r.status === "REVIEW" && <button onClick={() => { setReviewId(r.id); setConfirmed(false); setNote(""); }}>Review</button>}</td><td>{r.modelId}</td><td>{r.reservedCredits}</td><td>{r.chargedCredits}</td><td>{r.refundedCredits}</td><td>{r.providerCostUsd ?? "—"}</td><td>{r.providerRequestId || "—"}</td></tr>)}</tbody></table></div></section>
 {reviewId && <section className="vs-panel"><h2>{t("بررسی نتیجهٔ نامشخص", "Reconcile uncertain outcome", "Unklaren Vorgang prüfen", "Belirsiz sonucu uzlaştır")}</h2><p>{reviewId}</p><p>{t("ابتدا نتیجه و مصرف را در ElevenLabs بررسی کنید. این اقدام فقط پس از تأیید نبود خروجی قابل تحویل، رزرو را آزاد می‌کند؛ تولید مجدد خودکار انجام نمی‌شود.", "First verify the request and usage in ElevenLabs. Release only after confirming no deliverable exists. No automatic regeneration.", "Zuerst Anfrage und Verbrauch bei ElevenLabs prüfen. Nur ohne lieferbares Ergebnis freigeben. Keine automatische Wiederholung.", "Önce ElevenLabs isteğini ve kullanımını kontrol edin. Teslim edilebilir çıktı yoksa serbest bırakın. Otomatik yeniden üretim yok.")}</p><label>{t("یادداشت بررسی، حداقل ۲۰ نویسه", "Review note, at least 20 characters", "Prüfnotiz, mindestens 20 Zeichen", "İnceleme notu, en az 20 karakter")}<textarea value={note} onChange={e => setNote(e.target.value)}/></label><label className="vs-check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>{t("نبود خروجی قابل تحویل را بررسی و تأیید کردم.", "I checked and confirmed there is no deliverable.", "Ich habe geprüft, dass kein lieferbares Ergebnis existiert.", "Teslim edilebilir çıktı olmadığını kontrol edip doğruladım.")}</label><button disabled={busy || !confirmed || note.trim().length < 20} onClick={() => void act({ action: "reconcileNoOutput", id: reviewId, confirmed: true, note })}>{t("ثبت بررسی و بازگشت رزرو", "Record review and refund", "Prüfung speichern und erstatten", "İncelemeyi kaydet ve iade et")}</button></section>}</main>;
}
