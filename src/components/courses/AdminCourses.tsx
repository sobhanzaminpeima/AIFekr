"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation, tri } from "@/lib/i18n";
import type { CourseContent } from "@/lib/courses/content";

type Course = { id: string; title: string; fieldOfStudy: string; description: string; language: string; status: string; version: number; activeJobId: string | null; content: string | null; jobs?: { id: string; status: string; credits: number; userId: string; idempotencyKey: string }[] };
async function api(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  const body = await response.json();
  if (!response.ok) throw Object.assign(new Error(body.code || body.error), { code: body.code || body.error, required: body.required });
  return body;
}
function CourseConfirmation({ message, accept, cancel, acceptText, cancelText }: { message: string; accept: () => void; cancel: () => void; acceptText: string; cancelText: string }) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const dialog=ref.current;dialog?.showModal();return()=>{dialog?.close();};},[]);
  return <dialog ref={ref} aria-label={message} onCancel={event=>{event.preventDefault();cancel();}} className="max-w-[calc(100%-2rem)] rounded-2xl border border-orange-400/30 p-6 shadow-2xl backdrop:bg-black/60" style={{background:"var(--surface-1)",color:"var(--text-primary)",width:500,maxWidth:"calc(100% - 2rem)"}}><p className="text-lg leading-8">{message}</p><div className="mt-6 flex flex-wrap gap-3"><button className="min-h-12 rounded-xl bg-orange-500 px-5 py-3 text-white" onClick={accept}>{acceptText}</button><button className="min-h-12 rounded-xl border px-5 py-3" onClick={cancel}>{cancelText}</button></div></dialog>;
}
export default function AdminCourses() {
  const { lang } = useTranslation(); const t = (fa: string, en: string, de: string, tr: string) => tri(lang, fa, en, de, tr);
  const router = useRouter(); const search = useSearchParams(); const selected = search.get("course");
  const [courses, setCourses] = useState<Course[]>([]); const [course, setCourse] = useState<Course | null>(null);
  const [draft, setDraft] = useState<CourseContent | null>(null); const [balance, setBalance] = useState(0); const [cost, setCost] = useState<number | null>(null); const [userId, setUserId] = useState("");
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState(""); const [insufficient, setInsufficient] = useState(false);
  const [confirmation,setConfirmation]=useState<"regenerate"|"publish"|null>(null);
  const [brief, setBrief] = useState({ fieldOfStudy: "", title: "", description: "", language: lang });
  const load = useCallback(async () => {
    const data = await api("/api/admin/ai-courses"); setCourses(data.courses); setCost(data.cost); setBalance(data.balance); setUserId(data.userId);
  }, []);
  const detail = useCallback(async () => {
    if (!selected) { setCourse(null); setDraft(null); return; }
    const data = await api(`/api/admin/ai-courses/${selected}`); setCourse(data.course); setDraft(data.course.content ? JSON.parse(data.course.content) : null);
    const storageKey = `aifekr:course-generation:${data.actorId}:${selected}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      let key: string | null = null;
      try { key = JSON.parse(stored).idempotencyKey; } catch { localStorage.removeItem(storageKey); }
      if (key && /^[a-zA-Z0-9_-]{16,100}$/.test(key)) {
        const known = data.course.jobs?.find((job: NonNullable<Course["jobs"]>[number]) => job.userId === data.actorId && job.idempotencyKey === key);
        const status = known?.status || (await api(`/api/admin/ai-courses/${selected}?requestKey=${encodeURIComponent(key)}`)).requestStatus;
        // Refresh keeps in-flight keys; only a proven terminal server state clears them.
        if (status && status !== "GENERATING") localStorage.removeItem(storageKey);
      }
    }
    setBrief({ fieldOfStudy: data.course.fieldOfStudy, title: data.course.title, description: data.course.description, language: data.course.language });
  }, [selected]);
  useEffect(() => { void load().catch(() => setNotice(t("بارگذاری ناموفق بود", "Could not load courses", "Kurse konnten nicht geladen werden", "Kurslar yüklenemedi"))); }, [load, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void detail().catch(() => setNotice("COURSE_LOAD_FAILED")); }, [detail]);
  useEffect(() => {
    if (!course?.activeJobId) return;
    const timer = setInterval(() => { if (document.visibilityState === "visible") void Promise.all([load(), detail()]).catch(() => {}); }, 4000);
    return () => clearInterval(timer);
  }, [course?.activeJobId, load, detail]);
  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setNotice("");
    try { const data = await api("/api/admin/ai-courses", { method: "POST", body: JSON.stringify(brief) }); router.replace(`/admin/ai-courses?course=${data.course.id}`); await load(); }
    catch { setNotice(t("اطلاعات دوره را کامل کن", "Complete the course brief", "Kursbeschreibung vervollständigen", "Kurs bilgilerini tamamla")); } finally { setBusy(false); }
  }
  async function save(status?: string) {
    if (!course) return; setBusy(true); setNotice("");
    try {
      await api(`/api/admin/ai-courses/${course.id}`, { method: "PATCH", body: JSON.stringify({ ...brief, version: course.version, ...(status ? { status } : draft ? { content: draft } : {}) }) });
      await Promise.all([load(), detail()]); setNotice(t("ذخیره شد؛ ویرایش دستی رایگان است", "Saved. Manual editing is free", "Gespeichert. Manuelle Bearbeitung ist kostenlos", "Kaydedildi. Elle düzenleme ücretsizdir"));
    } catch (e) { setNotice(e instanceof Error ? e.message : "SAVE_FAILED"); } finally { setBusy(false); }
  }
  async function generate(confirmed=false) {
    if (!course || cost === null) return;
    const regenerate = !!course.content;
    if (regenerate && !confirmed) { setConfirmation("regenerate"); return; }
    setBusy(true); setNotice(""); setInsufficient(false);
    const storageKey = `aifekr:course-generation:${userId}:${course.id}`;
    let request = { idempotencyKey: crypto.randomUUID(), expectedCredits: cost, regenerate, confirmRegeneration: regenerate };
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) request = JSON.parse(saved);
      else {
        // Persist the brief the administrator actually sees before starting paid generation.
        if (brief.title !== course.title || brief.description !== course.description || brief.fieldOfStudy !== course.fieldOfStudy || brief.language !== course.language) {
          await api(`/api/admin/ai-courses/${course.id}`, { method: "PATCH", body: JSON.stringify({ ...brief, version: course.version }) });
        }
        localStorage.setItem(storageKey, JSON.stringify(request));
      }
      setCourse(current => current ? { ...current, activeJobId: "pending", status: "GENERATING" } : current);
      setNotice(t("در حال تولید ساختار و درس‌ها؛ قبل از انتشار بازبینی می‌کنی", "Generating the structure and lessons; review before publication", "Struktur und Lektionen werden erstellt; danach prüfen", "Yapı ve dersler oluşturuluyor; yayımlamadan önce incele"));
      const data = await api(`/api/admin/ai-courses/${course.id}/generate`, { method: "POST", body: JSON.stringify(request) });
      if (data.job.status !== "GENERATING") localStorage.removeItem(storageKey);
      setNotice(data.job.status === "SUCCEEDED" ? t("دوره آمادهٔ بازبینی است؛ هنوز منتشر نشده", "Course ready for review; not published", "Kurs zur Prüfung bereit; noch unveröffentlicht", "Kurs incelemeye hazır; yayımlanmadı") : data.job.status === "REFUNDED" ? t("تولید ناموفق بود؛ اعتبار بازگردانده شد", "Generation failed; credits refunded", "Generierung fehlgeschlagen; Credits erstattet", "Oluşturma başarısız; krediler iade edildi") : t("تولید ادامه دارد؛ می‌توانی دوباره به همین دوره برگردی", "Generation in progress; return to this course anytime", "Generierung läuft; du kannst zurückkehren", "Oluşturuluyor; bu kursa tekrar dönebilirsin"));
      await Promise.all([load(), detail()]);
    } catch (e) {
      const error = e as Error & { code?: string; required?: number };
      if (error.code) localStorage.removeItem(storageKey); // Transport failures keep the exact key for a safe retry.
      setInsufficient(error.code === "INSUFFICIENT_CREDITS");
      if (error.required !== undefined) setCost(error.required);
      setNotice(error.code === "INSUFFICIENT_CREDITS" ? t("اعتبار کافی نیست؛ تولید شروع نشده", "Insufficient credits; generation did not start", "Nicht genügend Credits; keine Generierung gestartet", "Yetersiz kredi; oluşturma başlamadı") : error.code === "COST_CHANGED" ? t("هزینه تغییر کرده؛ مبلغ جدید را بررسی کن و دوباره تأیید کن", "Cost changed. Review the new amount and confirm again", "Kosten geändert. Neuen Betrag prüfen und bestätigen", "Maliyet değişti. Yeni tutarı kontrol edip tekrar onayla") : t("پاسخ نرسید؛ با همان درخواست دوباره امتحان کن تا شارژ تکراری نشود", "No response. Retry the same request safely", "Keine Antwort. Dieselbe Anfrage sicher wiederholen", "Yanıt alınamadı. Aynı isteği güvenle tekrar dene"));
      await Promise.all([load(), detail()]).catch(() => {});
    } finally { setBusy(false); }
  }
  function editLesson(chapter: number, lesson: number, key: "title" | "content" | "activity", value: string) {
    setDraft(previous => { if (!previous) return null; const next = structuredClone(previous); next.chapters[chapter].lessons[lesson][key] = value; return next; });
  }
  const input = "w-full rounded-xl border border-slate-500/30 bg-transparent p-3 min-h-12";
  const disabled = busy || !!course?.activeJobId;
  const unsaved = !!draft && !!course && JSON.stringify(draft) !== course.content;
  return <div dir={lang === "fa" ? "rtl" : "ltr"} className="mx-auto max-w-5xl space-y-6 p-4 md:p-8" style={{ color: "var(--text-primary)" }}>
    {confirmation && <CourseConfirmation message={confirmation === "regenerate" ? t(`تولید دوبارهٔ کل دوره ${cost} اعتبار AI مصرف می‌کند.`, `Regenerating the entire course will use ${cost} AI Credits.`, `Die vollständige Neugenerierung kostet ${cost} AI-Credits.`, `Tüm kursu yeniden oluşturmak ${cost} AI Kredisi kullanır.`) : t("محتوا را بازبینی کرده‌ای؟ فقط نسخهٔ ذخیره‌شده برای دانشجویان منتشر می‌شود.", "Reviewed the content? Only the saved version will be published to students.", "Inhalte geprüft? Nur die gespeicherte Version wird veröffentlicht.", "İçeriği inceledin mi? Yalnızca kaydedilmiş sürüm yayımlanır.")} acceptText={t("تأیید", "Confirm", "Bestätigen", "Onayla")} cancelText={t("انصراف", "Cancel", "Abbrechen", "İptal")} cancel={()=>setConfirmation(null)} accept={()=>{const action=confirmation;setConfirmation(null);if(action==="regenerate")void generate(true);else void save("PUBLISHED");}}/>}
    <header><h1 className="text-2xl font-bold">{t("دوره‌های هوش مصنوعی", "AI courses", "KI-Kurse", "AI kursları")}</h1><p className="mt-2 text-sm">{t("تولید ← بازبینی و ویرایش ← انتشار", "Generate → review and edit → publish", "Generieren → prüfen und bearbeiten → veröffentlichen", "Oluştur → incele ve düzenle → yayımla")}</p><p className="mt-3">{t("اعتبار قابل استفاده", "Available credits", "Verfügbare Credits", "Kullanılabilir kredi")}: {balance} · <Link className="underline" href="/admin/usage">Credit Rules</Link></p></header>
    {notice && <p role="status" className="rounded-xl border border-orange-400/40 p-4">{notice}</p>}
    {insufficient && <Link href="/credits" className="block rounded-xl bg-orange-500 p-4 text-white">{t("خرید اعتبار / ارتقای پکیج", "Buy credits / upgrade", "Credits kaufen / Upgrade", "Kredi satın al / yükselt")}</Link>}
    <div className="flex flex-wrap gap-2"><button className="rounded-xl border px-4 py-3" onClick={() => { router.replace("/admin/ai-courses"); setBrief({ fieldOfStudy: "", title: "", description: "", language: lang }); }}>+ {t("دورهٔ جدید", "New course", "Neuer Kurs", "Yeni kurs")}</button>{courses.map(item => <button key={item.id} className={`max-w-full rounded-xl border px-4 py-3 text-sm ${selected === item.id ? "border-orange-500" : "border-slate-500/30"}`} onClick={() => router.replace(`/admin/ai-courses?course=${item.id}`)}>{item.title} · {item.status}</button>)}</div>
    <form onSubmit={create} className="space-y-4 rounded-2xl border border-slate-500/30 p-4 md:p-6">
      {([['fieldOfStudy',t("رشتهٔ تحصیلی", "Field of study", "Studienfach", "Çalışma alanı")], ['title',t("عنوان دوره", "Course title", "Kurstitel", "Kurs başlığı")], ['description',t("شرح دوره", "Description", "Beschreibung", "Açıklama")]] as const).map(([key,label]) => <label key={key} className="block space-y-2"><span>{label}</span>{key === "description" ? <textarea required minLength={20} maxLength={6000} rows={4} className={input} disabled={disabled} value={brief[key]} onChange={e => setBrief({ ...brief, [key]: e.target.value })}/> : <input required minLength={3} maxLength={200} className={input} disabled={disabled} value={brief[key]} onChange={e => setBrief({ ...brief, [key]: e.target.value })}/>}</label>)}
      <label className="block space-y-2"><span>{t("زبان دوره", "Course language", "Kurssprache", "Kurs dili")}</span><select className={input} disabled={disabled} value={brief.language} onChange={e => setBrief({ ...brief, language: e.target.value as typeof lang })}>{[['fa','فارسی'],['en','English'],['de','Deutsch'],['tr','Türkçe']].map(([key,name]) => <option key={key} value={key}>{name}</option>)}</select></label>
      {!course ? <button disabled={busy} className="rounded-xl bg-orange-500 px-5 py-3 text-white">{t("ساخت پیش‌نویس رایگان", "Create free draft", "Kostenlosen Entwurf erstellen", "Ücretsiz taslak oluştur")}</button> : <button type="button" disabled={disabled} className="rounded-xl border px-5 py-3" onClick={() => void save()}>{t("ذخیرهٔ ویرایش — رایگان", "Save edits · free", "Änderungen speichern · kostenlos", "Düzenlemeyi kaydet · ücretsiz")}</button>}
    </form>
    {course && <section className="space-y-4 rounded-2xl border border-orange-400/30 bg-orange-400/5 p-5"><p>{course.status} · {t("نسخه", "Version", "Version", "Sürüm")} {course.version}</p><button disabled={disabled || cost === null} onClick={() => void generate()} className="min-h-12 rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white disabled:opacity-50">✨ {course.activeJobId ? t("در حال تولید…", "Generating…", "Wird generiert…", "Oluşturuluyor…") : course.content ? t("تولید دوبارهٔ کل دوره", "Regenerate entire course", "Gesamten Kurs neu generieren", "Tüm kursu yeniden oluştur") : t("تولید دوره", "Generate Course", "Kurs generieren", "Kurs oluştur")} · {cost ?? "…"} {t("اعتبار AI", "AI Credits", "AI-Credits", "AI Kredisi")}</button><p className="text-sm leading-7">{t("AI ساختار دوره، فصل‌ها، درس‌ها، فعالیت‌های یادگیری و پیش‌نویس آزمون‌ها را می‌سازد. قبل از انتشار، همه را بازبینی و ویرایش کن. ویرایش دستی، مطالعه و آزمون‌های عادی هزینهٔ تولید ندارند.", "AI generates the structure, chapters, lessons, learning activities and quiz drafts. Review and edit everything before publishing. Manual edits and normal course learning are free of generation charges.", "KI erstellt Struktur, Kapitel, Lektionen, Lernaktivitäten und Quizentwürfe. Vor Veröffentlichung alles prüfen und bearbeiten. Manuelle Änderungen und normales Lernen verursachen keine Generierungskosten.", "AI yapıyı, bölümleri, dersleri, etkinlikleri ve quiz taslaklarını oluşturur. Yayımlamadan önce hepsini inceleyip düzenle. Elle düzenleme ve normal öğrenme için oluşturma ücreti alınmaz.")}</p></section>}
    {course?.jobs && course.jobs.length > 0 && <section className="rounded-2xl border border-slate-500/30 p-4"><h2 className="font-bold">{t("سابقهٔ تولید و اعتبار", "Generation & credit history", "Generierungs- und Creditverlauf", "Oluşturma ve kredi geçmişi")}</h2><ul className="mt-3 space-y-2">{course.jobs.map(job => <li key={job.id} className="break-words text-sm">{job.status} · {job.status === "REFUNDED" ? `0 (${job.credits} refunded)` : `-${job.credits}`} AI Credits · {job.id.slice(0,8)}</li>)}</ul><Link href="/admin/logs" className="mt-3 inline-block underline">{t("دفتر اعتبار و تراکنش‌ها", "Credit ledger & transactions", "Credit-Transaktionen", "Kredi işlemleri")}</Link></section>}
    {draft && <fieldset disabled={disabled} className="space-y-4"><h2 className="text-xl font-bold">{t("بازبینی محتوا", "Review content", "Inhalte prüfen", "İçeriği incele")}</h2><label className="block">{t("معرفی", "Overview", "Überblick", "Genel bakış")}<textarea disabled={disabled} rows={4} className={input} value={draft.overview} onChange={e => setDraft({ ...draft, overview: e.target.value })}/></label><label className="block">{t("اهداف — هر هدف یک خط", "Objectives — one per line", "Ziele — eines je Zeile", "Hedefler — her satırda bir tane")}<textarea disabled={disabled} rows={4} className={input} value={draft.objectives.join("\n")} onChange={e => setDraft({ ...draft, objectives: e.target.value.split("\n") })}/></label>
      {draft.chapters.map((chapter, ci) => <details key={ci} className="rounded-2xl border border-slate-500/30 p-4"><summary className="cursor-pointer py-2 font-bold">{chapter.title}</summary><input aria-label={`Chapter ${ci+1} title`} className={input} value={chapter.title} onChange={e => setDraft(previous => { const next = structuredClone(previous!); next.chapters[ci].title = e.target.value; return next; })}/>{chapter.lessons.map((lesson, li) => <div key={li} className="mt-5 space-y-3"><input aria-label={`Lesson ${ci+1}.${li+1} title`} className={input} value={lesson.title} onChange={e => editLesson(ci,li,"title",e.target.value)}/><textarea aria-label={`Lesson ${ci+1}.${li+1} content`} className={input} rows={8} value={lesson.content} onChange={e => editLesson(ci,li,"content",e.target.value)}/><textarea aria-label={`Lesson ${ci+1}.${li+1} activity`} className={input} rows={3} value={lesson.activity} onChange={e => editLesson(ci,li,"activity",e.target.value)}/>{lesson.quiz.map((question, qi) => <div className="space-y-2 rounded-xl border border-slate-500/30 p-3" key={qi}><input aria-label={`Quiz ${ci}.${li}.${qi}`} className={input} value={question.question} onChange={e => setDraft(previous => { const next = structuredClone(previous!); next.chapters[ci].lessons[li].quiz[qi].question = e.target.value; return next; })}/>{question.options.map((option, oi) => <input key={oi} aria-label={`Option ${ci}.${li}.${qi}.${oi}`} className={input} value={option} onChange={e => setDraft(previous => { const next = structuredClone(previous!); next.chapters[ci].lessons[li].quiz[qi].options[oi] = e.target.value; return next; })}/>)}<select aria-label="Correct answer" className={input} value={question.correctIndex} onChange={e => setDraft(previous => { const next = structuredClone(previous!); next.chapters[ci].lessons[li].quiz[qi].correctIndex = Number(e.target.value); return next; })}>{question.options.map((_,oi) => <option key={oi} value={oi}>{oi+1}</option>)}</select><textarea aria-label="Quiz explanation" className={input} value={question.explanation} onChange={e => setDraft(previous => { const next = structuredClone(previous!); next.chapters[ci].lessons[li].quiz[qi].explanation = e.target.value; return next; })}/></div>)}</div>)}</details>)}
      <details className="rounded-2xl border p-4"><summary>{draft.finalProject.title}</summary><textarea aria-label="Final project instructions" rows={5} className={input} value={draft.finalProject.instructions} onChange={e => setDraft({ ...draft, finalProject: { ...draft.finalProject, instructions: e.target.value } })}/><textarea aria-label="Final project rubric" rows={4} className={input} value={draft.finalProject.rubric.join("\n")} onChange={e => setDraft({ ...draft, finalProject: { ...draft.finalProject, rubric: e.target.value.split("\n") } })}/></details>
      {unsaved && <p role="status">{t("قبل از انتشار، تغییرات را ذخیره کن", "Save changes before publishing", "Änderungen vor Veröffentlichung speichern", "Yayımlamadan önce değişiklikleri kaydet")}</p>}
      <div className="flex flex-wrap gap-3"><button disabled={disabled} className="rounded-xl border px-5 py-3" onClick={() => void save()}>{t("ذخیرهٔ تغییرات — رایگان", "Save changes · free", "Änderungen speichern · kostenlos", "Değişiklikleri kaydet · ücretsiz")}</button><button disabled={disabled || unsaved || course?.status !== "GENERATED"} className="rounded-xl bg-emerald-600 px-5 py-3 text-white" onClick={() => setConfirmation("publish")}>{t("تأیید بازبینی و انتشار", "Confirm review & publish", "Prüfung bestätigen & veröffentlichen", "İncelemeyi onayla ve yayımla")}</button><button disabled={disabled} className="rounded-xl border px-5 py-3" onClick={() => void save("ARCHIVED")}>{t("آرشیو", "Archive", "Archivieren", "Arşivle")}</button></div>
    </fieldset>}
  </div>;
}
