"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3, CreditCard, FileText, ArrowRight, RefreshCw, AlertCircle, UploadCloud } from "lucide-react";
import { tri, useTranslation } from "@/lib/i18n";
import { paymentHistoryQuery, type PaymentHistoryFilter } from "@/lib/payment/tracking";
import { checkoutStage } from "@/lib/payment/checkoutStage";

type PaymentRow = { id: string; plan: string; status: string; gateway: string; amount: number; transferCurrency: string; transferMinor: number; receiptAt: string | null; reviewAt: string | null; reviewNote: string | null; createdAt: string; refId: string | null; packageName: string | null; packageNameEn: string | null; resumeUrl: string | null };
type History = { payments: PaymentRow[]; page: number; hasMore: boolean; pendingCount: number; reviewCount: number };

export default function PaymentsView() {
  const { lang } = useTranslation();
  const router = useRouter();
  const [filter, setFilter] = useState<PaymentHistoryFilter>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<History | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pendingCount = useRef<number | null>(null);
  const requestId = useRef(0);
  const t = useCallback((fa: string, en: string, de: string, tr: string) => tri(lang, fa, en, de, tr), [lang]);
  useEffect(() => { const query = paymentHistoryQuery(new URLSearchParams(window.location.search)); setFilter(query.filter); setPage(query.page); }, []);
  const load = useCallback(async (background = false) => {
    const id = ++requestId.current;
    if (!background) setLoading(true);
    try {
      const response = await fetch(`/api/user/payments?page=${page}&filter=${filter}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || t("دریافت وضعیت ممکن نشد", "Unable to load payment status", "Zahlungsstatus nicht verfügbar", "Ödeme durumu yüklenemedi"));
      if (id !== requestId.current) return;
      setData(body); setError("");
      if (pendingCount.current !== null && pendingCount.current !== body.pendingCount) router.refresh();
      pendingCount.current = body.pendingCount;
    } catch (e) { if (id === requestId.current) setError(e instanceof Error ? e.message : t("دریافت وضعیت ممکن نشد", "Unable to load status", "Status nicht verfügbar", "Durum yüklenemedi")); }
    finally { if (id === requestId.current) setLoading(false); }
  }, [filter, page, router, t]);
  useEffect(() => { void load(); return () => { requestId.current += 1; }; }, [load]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void load(true); };
    const timer = data?.pendingCount ? window.setInterval(refresh, 15000) : null;
    document.addEventListener("visibilitychange", refresh);
    return () => { if (timer !== null) window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [load, data?.pendingCount]);

  function changeFilter(next: PaymentHistoryFilter) { setFilter(next); setPage(1); router.replace(`/payments?filter=${next}`, { scroll: false }); }
  const date = (value: string) => new Intl.DateTimeFormat(lang === "fa" ? "fa-IR" : lang === "de" ? "de-DE" : lang === "tr" ? "tr-TR" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  const panel = { background: "var(--surface-1)", border: "1px solid var(--border)" };
  return <div className="workspace-page mx-auto max-w-4xl space-y-5" dir={lang === "fa" ? "rtl" : "ltr"}>
    <header className="rounded-3xl p-5 sm:p-7" style={{ ...panel, background: "linear-gradient(120deg,rgba(249,115,22,.12),rgba(14,165,233,.08))" }}>
      <div className="mb-3 flex items-center gap-3"><CreditCard className="text-orange-500" size={25}/><h1 className="text-xl font-bold sm:text-2xl">{t("پرداخت‌ها و فعال‌سازی", "Payments & activation", "Zahlungen und Aktivierung", "Ödemeler ve etkinleştirme")}</h1></div>
      <p className="text-sm leading-7" style={{ color: "var(--text-secondary)" }}>{t("همهٔ سفارش‌ها و رسیدها اینجا محفوظ‌اند. حتی با بستن صفحه می‌توانی از همین بخش در منو پیگیری کنی.", "Your orders and receipts stay here. Return through Payments in the menu, even after closing the page.", "Bestellungen und Belege bleiben hier. Auch nach dem Schließen findest du sie unter Zahlungen im Menü.", "Sipariş ve dekontların burada saklanır. Sayfayı kapatsan da menüdeki Ödemeler bölümünden takip edebilirsin.")}</p>
      {!!data?.reviewCount && <Link href="/payments?filter=pending" onClick={() => { setFilter("pending"); setPage(1); }} className="mt-4 flex items-center gap-2 rounded-xl p-3 text-sm font-medium" style={{ background: "var(--surface-1)" }}><Clock3 size={18} className="shrink-0 text-orange-500"/>{t(`${data.reviewCount} رسید در انتظار بررسی؛ پرداخت دوباره لازم نیست.`, `${data.reviewCount} receipts awaiting review. No second payment needed.`, `${data.reviewCount} Belege in Prüfung. Keine erneute Zahlung nötig.`, `${data.reviewCount} dekont incelemede. Tekrar ödeme gerekmiyor.`)}</Link>}
    </header>
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label={t("فیلتر پرداخت‌ها", "Payment filters", "Zahlungsfilter", "Ödeme filtreleri")} className="flex min-w-0 flex-wrap gap-2">
        {(["all", "pending", "paid", "problem"] as const).map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => changeFilter(value)} className="min-h-11 rounded-xl px-4 py-2 text-sm" style={{ ...panel, background: filter === value ? "rgba(249,115,22,.14)" : "var(--surface-1)", color: filter === value ? "#f97316" : "var(--text-secondary)" }}>{value === "all" ? t("همه", "All", "Alle", "Tümü") : value === "pending" ? t("در انتظار", "Pending", "Ausstehend", "Bekliyor") : value === "paid" ? t("تأییدشده", "Approved", "Bestätigt", "Onaylandı") : t("نیاز به پیگیری", "Needs attention", "Handlungsbedarf", "İşlem gerekiyor")}</button>)}
      </div>
      <button type="button" disabled={loading} onClick={() => void load()} className="ms-auto flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm" style={panel}><RefreshCw size={16} className={loading ? "animate-spin" : ""}/>{t("به‌روزرسانی", "Refresh", "Aktualisieren", "Yenile")}</button>
    </div>
    {error && <p role="alert" className="rounded-xl border border-red-500/30 p-4 text-sm text-red-500">{error}</p>}
    <div aria-busy={loading} className="space-y-3">
      {loading ? <div role="status" className="rounded-2xl p-8 text-center" style={panel}><RefreshCw className="mx-auto mb-3 animate-spin text-orange-500" size={22}/>{t("در حال دریافت سفارش‌ها…", "Loading orders…", "Bestellungen werden geladen…", "Siparişler yükleniyor…")}</div> : data?.payments.map(payment => {
        const stage = checkoutStage(payment);
        const approved = stage === "approved" || payment.status === "PAID";
        const review = stage === "review";
        const pending = payment.status === "PENDING";
        const bank = payment.gateway === "bank_transfer";
        const Icon = approved ? CheckCircle2 : review ? Clock3 : pending ? UploadCloud : AlertCircle;
        const amount = bank && payment.transferMinor > 0 ? new Intl.NumberFormat(lang, { style: "currency", currency: payment.transferCurrency }).format(payment.transferMinor / 100) : `${payment.amount.toLocaleString(lang)} ${t("تومان", "toman", "Toman", "toman")}`;
        const title = (lang === "fa" ? payment.packageName : payment.packageNameEn) || (payment.plan.startsWith("STUDENT_") ? t("پکیج دانشجویی", "Student package", "Studierendenpaket", "Öğrenci paketi") : payment.plan.startsWith("VOICE_") ? t("تماس هوش مصنوعی", "AI calling", "KI-Anrufe", "Yapay zekâ aramaları") : payment.plan.startsWith("CREDITS_") ? t("اعتبار هوش مصنوعی", "AI credits", "KI-Credits", "Yapay zekâ kredisi") : payment.plan);
        return <article key={payment.id} className="rounded-2xl p-4 sm:p-5" style={panel}>
          <div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: approved ? "rgba(34,197,94,.12)" : "rgba(249,115,22,.12)", color: approved ? "#16a34a" : "#f97316" }}><Icon size={22}/></div><div className="min-w-0 flex-1"><h2 className="break-words font-semibold">{title}</h2><p className="mt-1 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>{date(payment.createdAt)}</p></div><span className="break-words text-sm font-semibold" dir="auto">{amount}</span></div>
          <p className="mt-4 text-sm font-medium">{approved ? t("پرداخت تأیید شده", "Payment approved", "Zahlung bestätigt", "Ödeme onaylandı") : review ? t("رسید دریافت شد؛ منتظر بررسی ادمین", "Receipt received · awaiting review", "Beleg erhalten · Prüfung ausstehend", "Dekont alındı · inceleme bekleniyor") : pending && bank ? t("منتظر انتقال مبلغ یا ارسال رسید", "Awaiting transfer or receipt", "Überweisung oder Beleg ausstehend", "Havale veya dekont bekleniyor") : pending ? t("پرداخت هنوز تکمیل نشده", "Payment is not complete yet", "Zahlung noch nicht abgeschlossen", "Ödeme henüz tamamlanmadı") : payment.status === "REJECTED" ? t("رسید تأیید نشد؛ توضیح بررسی را بخوان", "Receipt not approved · read the review", "Beleg abgelehnt · Prüfhinweis lesen", "Dekont onaylanmadı · incelemeyi oku") : t("پرداخت تکمیل نشد؛ وضعیت را پیگیری کن", "Payment not completed · check its status", "Zahlung nicht abgeschlossen · Status prüfen", "Ödeme tamamlanmadı · durumunu kontrol et")}</p>
          {review && <p className="mt-2 text-xs leading-6" style={{ color: "var(--text-secondary)" }}>{t("کار دیگری لازم نیست. نتیجه در همین بخش ثبت می‌شود؛ دوباره پرداخت نکن.", "No action needed. The result will appear here; do not pay again.", "Keine weitere Aktion nötig. Das Ergebnis erscheint hier; nicht erneut zahlen.", "Başka işlem gerekmiyor. Sonuç burada görünecek; tekrar ödeme yapma.")}</p>}
          {payment.reviewNote && <p className="mt-3 break-words rounded-xl p-3 text-sm leading-6" style={{ background: "var(--surface-0)" }}>{payment.reviewNote}</p>}
          <details className="mt-3 text-xs" style={{ color: "var(--text-secondary)" }}><summary className="cursor-pointer py-2">{t("شناسه و جزئیات سفارش", "Order reference & details", "Bestellreferenz und Details", "Sipariş referansı ve ayrıntılar")}</summary><p dir="ltr" className="break-all py-2">{payment.id}</p>{payment.refId && <p className="break-all">{t("کد پیگیری:", "Reference:", "Referenz:", "Referans:")} {payment.refId}</p>}{payment.receiptAt && <p className="mt-2">{t("ارسال رسید:", "Receipt sent:", "Beleg gesendet:", "Dekont gönderildi:")} {date(payment.receiptAt)}</p>}{payment.reviewAt && <p className="mt-2">{t("بررسی:", "Reviewed:", "Geprüft:", "İncelendi:")} {date(payment.reviewAt)}</p>}</details>
          <div className="mt-3 flex flex-wrap gap-2">
            {bank && <Link href={`/checkout/${payment.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white">{pending && !review ? <UploadCloud size={16}/> : <ArrowRight size={16}/>} {review ? t("پیگیری تأیید", "Track approval", "Freigabe verfolgen", "Onayı takip et") : pending ? t("ادامهٔ پرداخت و رسید", "Continue payment & receipt", "Zahlung und Beleg fortsetzen", "Ödeme ve dekonta devam et") : t("جزئیات پرداخت", "Payment details", "Zahlungsdetails", "Ödeme ayrıntıları")}</Link>}
            {pending && payment.resumeUrl && <a href={payment.resumeUrl} className="inline-flex min-h-11 items-center rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white">{t("ادامهٔ پرداخت در زرین‌پال", "Continue on Zarinpal", "Bei Zarinpal fortsetzen", "Zarinpal'da devam et")}</a>}
            {bank && payment.receiptAt && <a href={`/api/payment/${payment.id}/receipt`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 text-sm" style={{ borderColor: "var(--border)" }}><FileText size={16}/>{t("رسید ثبت‌شده", "Saved receipt", "Gespeicherter Beleg", "Kayıtlı dekont")}</a>}
            {approved && <Link href={payment.plan.startsWith("STUDENT_") ? "/student" : payment.plan.startsWith("VOICE_") ? "/voice-agent" : "/home"} className="inline-flex min-h-11 items-center rounded-xl border px-4 py-2 text-sm" style={{ borderColor: "var(--border)" }}>{t("ورود به فضای من", "Open my workspace", "Meinen Bereich öffnen", "Alanıma git")}</Link>}
            {!pending && !approved && <Link href="/contact" className="inline-flex min-h-11 items-center rounded-xl border px-4 py-2 text-sm" style={{ borderColor: "var(--border)" }}>{t("پیگیری با پشتیبانی", "Contact support", "Support kontaktieren", "Destekle iletişime geç")}</Link>}
          </div>
        </article>;
      })}
      {!loading && data && !data.payments.length && <div className="rounded-2xl p-7 text-center" style={panel}><CreditCard className="mx-auto mb-3 text-orange-500" size={30}/><p>{filter === "all" ? t("هنوز سفارشی ثبت نکرده‌ای", "No orders yet", "Noch keine Bestellungen", "Henüz sipariş yok") : t("سفارشی با این وضعیت نداری", "No orders with this status", "Keine Bestellungen mit diesem Status", "Bu durumda sipariş yok")}</p><Link href="/plans" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-orange-500 px-4 py-2 text-sm text-white">{t("مشاهدهٔ پکیج‌ها", "View packages", "Pakete ansehen", "Paketlere bak")}</Link></div>}
    </div>
    {data && (page > 1 || data.hasMore) && <nav className="flex items-center justify-between gap-3" aria-label={t("صفحه‌های پرداخت", "Payment pages", "Zahlungsseiten", "Ödeme sayfaları")}><button type="button" disabled={loading || page === 1} onClick={() => setPage(value => value - 1)} className="min-h-11 rounded-xl border px-4 py-2 text-sm disabled:opacity-40">{t("جدیدتر", "Newer", "Neuere", "Daha yeni")}</button><span className="text-sm">{page.toLocaleString(lang)}</span><button type="button" disabled={loading || !data.hasMore} onClick={() => setPage(value => value + 1)} className="min-h-11 rounded-xl border px-4 py-2 text-sm disabled:opacity-40">{t("قدیمی‌تر", "Older", "Ältere", "Daha eski")}</button></nav>}
    <p className="text-xs leading-6" style={{ color: "var(--text-secondary)" }}>{t("دسترسی ثابت: منوی پنل ← پرداخت‌ها و فعال‌سازی. نتیجهٔ بررسی از اطلاعات سرور خوانده می‌شود.", "Always available: workspace menu → Payments & activation. Review results come from the server.", "Immer erreichbar: Menü → Zahlungen und Aktivierung. Prüfergebnisse stammen vom Server.", "Kalıcı erişim: panel menüsü → Ödemeler ve etkinleştirme. İnceleme sonucu sunucudan alınır.")}</p>
  </div>;
}
