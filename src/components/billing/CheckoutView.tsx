"use client";
import { isStudentIntroPlan } from "@/lib/plans/studentOffer";

import { BUSINESS_PACKAGES } from "@/lib/plans/business";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, CreditCard, ShieldCheck, UploadCloud, FileText, Clock3, CircleCheck, CircleX, RefreshCw, Loader2 } from "lucide-react";
import { useTranslation, tri } from "@/lib/i18n";
import { readBankDetails, formatIban, receiptFileError } from "@/lib/payment/presentation";

type Payment = { id: string; plan: string; status: string; periodMonths: number; transferCurrency: string; transferMinor: number; bankSnapshot: string; receiptAt: string | null; reviewNote: string | null; entitlementSnapshot: string };

export default function CheckoutView({ params }: { params: { id: string } }) {
  const { lang } = useTranslation();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [copied, setCopied] = useState("");
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();
  const t = useCallback((fa: string, en: string, de: string, tr: string) => tri(lang, fa, en, de, tr), [lang]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/payment/${params.id}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPayment(data.payment);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("دریافت پرداخت ممکن نشد", "Unable to load payment", "Zahlung nicht verfügbar", "Ödeme yüklenemedi"));
    } finally { setLoading(false); }
  }, [params.id, t]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => () => { clearTimeout(copyTimer.current); }, []);

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key); clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(""), 2200);
    } catch { setError(t("کپی خودکار ممکن نشد؛ متن را انتخاب و کپی کنید.", "Select and copy the text manually.", "Bitte den Text auswählen und manuell kopieren.", "Metni seçip elle kopyalayın.")); }
  }

  function selectFile(next: File | null) {
    setError(""); setFile(null);
    if (!next) return;
    const problem = receiptFileError(next);
    if (problem) {
      setError(problem === "size" ? t("حجم رسید باید حداکثر ۵ مگابایت باشد.", "Receipt must be 5 MB or less.", "Der Beleg darf höchstens 5 MB groß sein.", "Dekont en fazla 5 MB olmalıdır.") : t("فقط فایل JPG، PNG یا PDF پذیرفته می‌شود.", "Choose a JPG, PNG or PDF file.", "Wählen Sie eine JPG-, PNG- oder PDF-Datei.", "JPG, PNG veya PDF dosyası seçin."));
      return;
    }
    setFile(next);
  }

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!file || busy) return;
    setBusy(true); setError("");
    try {
      const body = new FormData(); body.append("receipt", file);
      const response = await fetch(`/api/payment/${params.id}/receipt`, { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setFile(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : t("ارسال رسید ممکن نشد", "Upload failed", "Hochladen fehlgeschlagen", "Yükleme başarısız")); }
    finally { setBusy(false); }
  }

  const bank = readBankDetails(payment?.bankSnapshot || null);
  const approved = payment?.status === "SUCCESS";
  const pendingReview = payment?.status === "PENDING" && !!payment.receiptAt;
  const canUpload = payment?.status === "PENDING" && !payment.receiptAt && !!bank;
  const businessPackage = BUSINESS_PACKAGES.find(p => p.planCode === payment?.plan);
  let entitlement: {credits?:number;teamSeatLimit?:number} = {};
  try { entitlement = JSON.parse(payment?.entitlementSnapshot || "{}"); } catch {}
  const planName = businessPackage ? `${t("پکیج بیزنس", "Business package", "Business-Paket", "İşletme paketi")} ${lang === "fa" ? businessPackage.name : businessPackage.nameEn}` : (payment && isStudentIntroPlan(payment.plan)) ? t("آفر اولین اشتراک دانشجویی", "Student welcome offer", "Studierenden-Willkommensangebot", "Öğrenci hoş geldin teklifi") : payment?.plan.startsWith("STUDENT_") ? t("اشتراک دانشجویی", "Student subscription", "Studierendenabo", "Öğrenci aboneliği") : payment?.plan.startsWith("CRM_") ? t("اشتراک مدیریت مشتری", "CRM subscription", "CRM-Abonnement", "CRM aboneliği") : payment?.plan.startsWith("CREDITS_") ? t("خرید اعتبار AI", "AI credit top-up", "KI-Guthaben", "Yapay zekâ kredisi") : t("اشتراک AI تیم", "Team AI subscription", "Team-KI-Abonnement", "Ekip yapay zekâ aboneliği");
  const statusText = approved ? t("پرداخت تأیید شد؛ اشتراک فعال است.", "Payment approved. Your subscription is active.", "Zahlung bestätigt. Ihr Abo ist aktiv.", "Ödeme onaylandı. Aboneliğiniz etkin.") : payment?.status === "REJECTED" ? t("رسید تأیید نشد. توضیح بررسی را ببینید.", "Receipt rejected. Check the review note.", "Beleg abgelehnt. Lesen Sie den Prüfhinweis.", "Dekont reddedildi. İnceleme notunu okuyun.") : pendingReview ? t("رسید ثبت شد؛ منتظر بررسی ادمین است.", "Receipt received. Awaiting admin review.", "Beleg erhalten. Prüfung ausstehend.", "Dekont alındı. Yönetici incelemesi bekleniyor.") : t("این پرداخت دیگر قابل ارسال رسید نیست.", "This payment no longer accepts receipts.", "Für diese Zahlung können keine Belege mehr eingereicht werden.", "Bu ödeme artık dekont kabul etmiyor.");

  return <div className="workspace-page checkout-page" dir={lang === "fa" ? "rtl" : "ltr"}>
    <Link className="workspace-back" href="/plans"><ArrowLeft size={16}/>{t("بازگشت به پلن‌ها", "Back to plans", "Zurück zu Tarifen", "Paketlere dön")}</Link>
    <header className="workspace-heading"><span className="workspace-eyebrow">AIFekr / {t("پرداخت", "Checkout", "Zahlung", "Ödeme")}</span><h1>{t("پرداخت بانکی", "Bank transfer", "Banküberweisung", "Banka havalesi")}</h1><p>{t("اطلاعات حساب، مبلغ و رسید؛ همه در یک‌جا.", "Account details, amount and receipt. All in one place.", "Kontodaten, Betrag und Beleg. Alles an einem Ort.", "Hesap bilgileri, tutar ve dekont. Hepsi bir arada.")}</p></header>
    <ol className="checkout-steps" aria-label={t("مراحل پرداخت", "Payment steps", "Zahlungsschritte", "Ödeme adımları")}>{[t("انتقال مبلغ", "Transfer", "Überweisen", "Havale"), t("ارسال رسید", "Upload receipt", "Beleg senden", "Dekont yükle"), t("تأیید و فعال‌سازی", "Review & activation", "Prüfung & Aktivierung", "Onay ve etkinleştirme")].map((label, index) => <li key={label} className={approved || (pendingReview && index < 2) ? "complete" : ""} aria-current={(!payment?.receiptAt && index === 0) || (pendingReview && index === 2) ? "step" : undefined}><span>{approved || (pendingReview && index < 2) ? <Check size={14}/> : (index + 1).toLocaleString(lang)}</span>{label}</li>)}</ol>
    {error && <div className="workspace-alert" role="alert">{error}{!payment && <button className="workspace-button secondary" onClick={() => void load()}><RefreshCw size={16}/>{t("تلاش مجدد", "Retry", "Erneut versuchen", "Tekrar dene")}</button>}</div>}
    {loading && !payment && <div className="checkout-grid" aria-busy="true"><div className="skeleton h-72 rounded-3xl"/><div className="skeleton h-72 rounded-3xl"/></div>}
    {payment && <div className="checkout-grid">
      <section className="checkout-transfer" aria-label={t("اطلاعات انتقال", "Transfer details", "Überweisungsdaten", "Havale bilgileri")}>
        {bank ? <div className="bank-card">
          <div className="bank-card-top"><span>AIFekr <small> / BANK TRANSFER</small></span><CreditCard size={27} aria-hidden/></div>
          <div className="bank-chip" aria-hidden><i/><i/><i/></div>
          <div className="bank-iban-row"><div><span className="bank-label">IBAN · {payment.transferCurrency}</span><p dir="ltr" className="bank-iban">{formatIban(bank.iban)}</p></div><button type="button" onClick={() => void copy(bank.iban, "iban")} aria-label={t("کپی ایبان", "Copy IBAN", "IBAN kopieren", "IBAN kopyala")} title={t("کپی ایبان", "Copy IBAN", "IBAN kopieren", "IBAN kopyala")}>{copied === "iban" ? <Check size={18}/> : <Copy size={18}/>}</button></div>
          <div className="bank-card-bottom"><div><span className="bank-label">{t("صاحب حساب", "Account holder", "Kontoinhaber", "Hesap sahibi")}</span><p dir="ltr">{bank.holder}</p></div><ShieldCheck size={22} aria-hidden/></div>
        </div> : <div className="workspace-alert" role="alert">{t("اطلاعات حساب قابل دریافت نیست؛ پیش از انتقال با پشتیبانی تماس بگیرید.", "Account details unavailable. Contact support before transferring.", "Kontodaten fehlen. Kontaktieren Sie vor der Überweisung den Support.", "Hesap bilgileri yok. Havale öncesi destek ile iletişime geçin.")}</div>}
        <div className="checkout-reference"><div><span>{t("شناسه سفارش؛ در توضیح انتقال وارد کنید", "Order reference · include in transfer description", "Bestellreferenz · im Verwendungszweck angeben", "Sipariş referansı · havale açıklamasına ekleyin")}</span><p dir="ltr">{payment.id}</p></div><button className="workspace-icon-button" onClick={() => void copy(payment.id, "reference")} aria-label={t("کپی شناسه سفارش", "Copy reference", "Referenz kopieren", "Referansı kopyala")}>{copied === "reference" ? <Check size={17}/> : <Copy size={17}/>}</button></div>
        <span className="sr-only" role="status">{copied && t("کپی شد", "Copied", "Kopiert", "Kopyalandı")}</span>
        <p className="billing-note"><ShieldCheck size={18}/>{t("مبلغ دقیق را منتقل کنید. اشتراک فقط پس از بررسی و تأیید ادمین فعال می‌شود.", "Transfer the exact amount. Your subscription activates only after admin approval.", "Überweisen Sie den genauen Betrag. Aktivierung erst nach Admin-Freigabe.", "Tam tutarı havale edin. Abonelik yalnızca yönetici onayından sonra etkinleşir.")}</p>
        {payment.transferCurrency === "EUR" && <p className="checkout-bank-notice">{t("برای پرداخت یورو، انتقال از حساب یورویی زراعت‌بانک به این حساب زراعت‌بانک بدون کمیسیون است. اگر از بانک دیگری پرداخت می‌کنید، هزینهٔ انتقال را با بانک خود بررسی کنید.", "For euro payments, transfers from a Ziraat Bank euro account to this Ziraat account are commission-free. Check transfer fees with your bank when paying from another bank.", "Euro-Überweisungen von einem Ziraat-Eurokonto auf dieses Ziraat-Konto sind provisionsfrei. Bei anderen Banken prüfen Sie die Überweisungsgebühren.", "Euro ödemelerinde Ziraat Bankası euro hesabından bu Ziraat hesabına transfer komisyonsuzdur. Başka bankalardan öderken transfer ücretlerini bankanızdan kontrol edin.")}</p>}
      </section>
      <section className="checkout-summary">
        <div className="checkout-summary-heading"><span className="workspace-eyebrow">{t("خلاصه سفارش", "Order summary", "Bestellübersicht", "Sipariş özeti")}</span><h2>{planName}</h2>{payment.periodMonths > 0 && !payment.plan.startsWith("CREDITS_") && <p>{payment.periodMonths.toLocaleString(lang)} {t("ماه", "months", "Monate", "ay")}</p>}{businessPackage && <p>{t("تمام امکانات بیزنس و CRM", "All business features and CRM", "Alle Geschäftsfunktionen und CRM", "Tüm işletme özellikleri ve CRM")} · {entitlement.teamSeatLimit} {t("عضو", "members", "Mitglieder", "üye")} · {entitlement.credits?.toLocaleString(lang)} {t("اعتبار کل دوره", "term credits", "Credits im Zeitraum", "dönem kredisi")}</p>}<div className="checkout-amount" dir="ltr">{new Intl.NumberFormat(lang, { style: "currency", currency: payment.transferCurrency, minimumFractionDigits: 2 }).format(payment.transferMinor / 100)}</div></div>
        {canUpload ? <form onSubmit={upload} className="checkout-upload-form">
          <label className={`receipt-dropzone ${file ? "has-file" : ""}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy) selectFile(e.dataTransfer.files[0] || null); }}>
            {file ? <FileText size={30}/> : <UploadCloud size={32}/>}
            <strong>{file ? file.name : t("رسید را انتخاب کنید یا اینجا رها کنید", "Choose a receipt or drop it here", "Beleg auswählen oder hier ablegen", "Dekont seçin veya buraya bırakın")}</strong>
            <span>{file ? `${(file.size / 1024).toFixed(0)} KB · ${t("برای تغییر کلیک کنید", "Click to change", "Zum Ändern klicken", "Değiştirmek için tıklayın")}` : "JPG, PNG, PDF · 5 MB"}</span>
            <input disabled={busy} type="file" accept="image/jpeg,image/png,application/pdf" aria-label={t("انتخاب رسید پرداخت", "Choose payment receipt", "Zahlungsbeleg auswählen", "Ödeme dekontu seç")} onChange={e => { selectFile(e.target.files?.[0] || null); e.target.value = ""; }}/>
          </label>
          <button disabled={!file || busy} className="workspace-button billing-buy">{busy ? <Loader2 size={18} className="animate-spin"/> : <UploadCloud size={18}/>} {busy ? t("در حال ارسال…", "Uploading…", "Wird hochgeladen…", "Yükleniyor…") : t("ارسال رسید برای بررسی", "Submit receipt for review", "Beleg zur Prüfung senden", "Dekontu incelemeye gönder")}</button>
          <p className="checkout-upload-caption">{t("ارسال رسید به معنی تأیید پرداخت نیست.", "Uploading a receipt does not confirm payment.", "Ein hochgeladener Beleg bestätigt keine Zahlung.", "Dekont yüklemek ödeme onayı değildir.")}</p>
        </form> : <div className={`checkout-status ${approved ? "approved" : payment.status === "REJECTED" ? "rejected" : ""}`} role="status">{approved ? <CircleCheck size={30}/> : payment.status === "REJECTED" ? <CircleX size={30}/> : <Clock3 size={30}/>}<h3>{statusText}</h3>{payment.reviewNote && <p>{payment.reviewNote}</p>}{payment.receiptAt && <a className="workspace-button secondary" href={`/api/payment/${payment.id}/receipt`}><FileText size={16}/>{t("دانلود رسید", "Download receipt", "Beleg herunterladen", "Dekont indir")}</a>}{pendingReview && <button className="workspace-button secondary" disabled={loading} onClick={() => void load()}><RefreshCw size={16} className={loading ? "animate-spin" : ""}/>{t("بررسی وضعیت", "Refresh status", "Status aktualisieren", "Durumu yenile")}</button>}</div>}
      </section>
    </div>}
    <Link className="workspace-back" href="/settings">{t("تاریخچه حساب و پرداخت‌ها", "Account & payment history", "Konto- und Zahlungsverlauf", "Hesap ve ödeme geçmişi")}</Link>
  </div>;
}
