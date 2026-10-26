"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation, tri } from "@/lib/i18n";
import { graphemes, estimatedSeconds, splitProject, creditsFor, type VoicePolicy } from "@/lib/voice-studio/domain";
import type { SpeechCatalog } from "@/lib/voice-studio/provider";
import "./voice-studio.css";
import {voiceErrorMessage} from "@/lib/voice-studio/errors";
type Project = {
    id: string;
    name: string;
    text: string;
    language: string;
    archivedAt: string | null;
};
type Generation = {
    id: string;
    status: string;
    segmentIndex: number;
    voiceId: string;
    modelId: string;
    durationMs: number | null;
    chargedCredits: number;
    reservedCredits: number;
    refundedCredits: number;
    errorCode: string | null;
    waveform: string | null;
    createdAt: string;
};
type Preset = {
    id: string;
    name: string;
    modelId: string;
    voiceId: string;
    settings: {
        stability?: number;
        style?: number;
        use_speaker_boost?: boolean;
    };
};
type Data = {
    policy: VoicePolicy;
    catalog: SpeechCatalog | null;
    catalogError: string | null;
    credits: number;
    projects: Project[];
    presets: Preset[];
};
export default function VoiceStudio() {
    const { lang } = useTranslation(), t = (fa: string, en: string, de: string, tr: string) => tri(lang, fa, en, de, tr);
    const [data, setData] = useState<Data | null>(null), [id, setId] = useState(""), [name, setName] = useState(""), [text, setText] = useState(""), [language, setLanguage] = useState("fa"), [modelId, setModel] = useState(""), [voiceId, setVoice] = useState(""), [search, setSearch] = useState(""), [voiceSearch, setVoiceSearch] = useState(""), [styleFilter, setStyleFilter] = useState(""), [segment, setSegment] = useState(0), [generations, setGenerations] = useState<Generation[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState(""), [offline, setOffline] = useState(false), [showArchived, setArchived] = useState(false), [statusFilter, setStatusFilter] = useState(""), [settings, setSettings] = useState<{
        stability?: number;
        style?: number;
        use_speaker_boost?: boolean;
    }>({}), [audioVersion, setAudioVersion] = useState(0);
    const errorText = (code: string) => { const known: Record<string, string> = { INSUFFICIENT_CREDITS: t("کردیت کافی نیست؛ کیف پول را شارژ کنید.", "Insufficient credits. Top up your wallet.", "Nicht genügend Credits. Guthaben aufladen.", "Yetersiz kredi. Bakiyenizi yükleyin."), VOICE_STUDIO_DISABLED: t("تولید صدا هنوز توسط مدیر فعال نشده است. متن شما قابل ذخیره است.", "Generation is not enabled by the admin yet. You can save your text.", "Generierung noch nicht freigeschaltet. Text kann gespeichert werden.", "Üretim yönetici tarafından açılmadı. Metninizi kaydedebilirsiniz."), CATALOG_NOT_VERIFIED: t("اتصال و فهرست صداها نیازمند بررسی مدیر است.", "The admin must verify connectivity and the voice catalog.", "Der Administrator muss Verbindung und Stimmen prüfen.", "Yönetici bağlantı ve ses listesini doğrulamalıdır.") }; if(voiceErrorMessage(code,lang)!==code)return voiceErrorMessage(code,lang);return known[code] || `${t("عملیات انجام نشد", "Action failed", "Aktion fehlgeschlagen", "İşlem başarısız")}: ${code}`; };
    async function post(body: unknown) { const r = await fetch("/api/voice-studio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const d = await r.json(); if (!r.ok)
        throw Error(d.code || "REQUEST_FAILED"); return d; }
    const load = useCallback(async () => { const r = await fetch("/api/voice-studio", { cache: "no-store" }); const d = await r.json(); if (!r.ok)
        throw Error(d.code || "AUTH_REQUIRED"); setData(d); return d as Data; }, []);
    const history = useCallback(async () => { if (!id)
        return; const r = await fetch(`/api/voice-studio?project=${encodeURIComponent(id)}`, { cache: "no-store" }); const d = await r.json(); if (r.ok)
        setGenerations(d.generations); }, [id]);
    useEffect(() => { const timer=setTimeout(()=>void load().catch(() => setError("LOAD_FAILED")),0);return()=>clearTimeout(timer); }, [load]);
    useEffect(() => { const initial=setTimeout(()=>void history(),0); const timer = setInterval(() => { if (document.visibilityState === "visible") {
        void history();
        void load().catch(() => { });
    } }, 5000); return () => {clearTimeout(initial);clearInterval(timer);}; }, [history, load]);
    useEffect(() => { const update = () => setOffline(!navigator.onLine); update(); addEventListener("online", update); addEventListener("offline", update); return () => { removeEventListener("online", update); removeEventListener("offline", update); }; }, []);
    useEffect(() => { try {
        if (text)
            localStorage.setItem(`aifekr-voice-draft:${id || "new"}`, JSON.stringify({ text, name, language }));
    }
    catch { } }, [text, name, language, id]);
    function choose(p: Project) { let draft = p; try {
        const saved = JSON.parse(localStorage.getItem(`aifekr-voice-draft:${p.id}`) || "null");
        if (saved && typeof saved.text === "string")
            draft = { ...p, ...saved };
    }
    catch { } setId(p.id); setName(draft.name); setText(draft.text); setLanguage(draft.language); setSegment(0); setGenerations([]); setMessage(""); setError(""); setSettings({}); }
    function fresh() { setId(""); setName(""); setText(""); setSegment(0); setGenerations([]); setMessage(""); }
    async function act(fn: () => Promise<void>) { setBusy(true); setError(""); try {
        await fn();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "REQUEST_FAILED");
    }
    finally {
        setBusy(false);
    } }
    async function save(extra: Record<string, unknown> = {}) { const d = await post({ action: "save", ...(id ? { id } : {}), name: name.trim() || t("پروژهٔ صوتی", "Voice project", "Sprachprojekt", "Ses projesi"), text, language, ...extra }); setId(d.project.id); await load(); setMessage(t("پروژه ذخیره شد", "Project saved", "Projekt gespeichert", "Proje kaydedildi")); return d.project as Project; }
    async function generateSelected(){
        const project=await save();
        const fingerprint=JSON.stringify({projectId:project.id,text,segment,voiceId,modelId,settings});
        const storageKey=`aifekr-voice-request:${project.id}`;
        let pending:{fingerprint:string;key:string}|null=null;
        try{pending=JSON.parse(sessionStorage.getItem(storageKey)||"null");}catch{}
        if(!pending||pending.fingerprint!==fingerprint)pending={fingerprint,key:crypto.randomUUID()};
        sessionStorage.setItem(storageKey,JSON.stringify(pending));
        await post({action:"generate",projectId:project.id,segmentIndex:segment,voiceId,modelId,idempotencyKey:pending.key,settings});
        sessionStorage.removeItem(storageKey);
        await load();
        const response=await fetch(`/api/voice-studio?project=${encodeURIComponent(project.id)}`,{cache:"no-store"});
        if(response.ok)setGenerations((await response.json()).generations);
        setMessage(t("در صف تولید قرار گرفت","Queued for generation","Zur Generierung eingereiht","Üretim kuyruğuna alındı"));
    }
    function statusName(status:string){return ({READY:t("آماده","Ready","Bereit","Hazır"),QUEUED:t("در صف","Queued","In Warteschlange","Kuyrukta"),RUNNING:t("در حال تولید","Generating","Wird generiert","Üretiliyor"),REVIEW:t("نیازمند بررسی","Needs review","Prüfung erforderlich","İnceleme gerekli"),FAILED:t("ناموفق","Failed","Fehlgeschlagen","Başarısız"),CANCELLED:t("لغوشده","Cancelled","Abgebrochen","İptal edildi")} as Record<string,string>)[status]||status;}
    const model = data?.catalog?.models.find(m => m.id === modelId), voice = data?.catalog?.voices.find(v => v.id === voiceId);
    const models = data?.catalog?.models.filter(m => data.policy.allowedModels.includes(m.id)) || [];
    const { segments, splitError } = useMemo(() => { try {
        return { segments: splitProject(text, language, data?.policy.maxDurationSeconds || 60, model?.maxCharacters || 5000), splitError: "" };
    }
    catch {
        return { segments: [], splitError: "UNSPLITTABLE_TEXT" };
    } }, [text, language, data?.policy.maxDurationSeconds, model?.maxCharacters]);
    const selected = segments[segment] || "", estimate = estimatedSeconds(selected || " ", language), reserved = data ? creditsFor(data.policy.maxDurationSeconds, data.policy) : 0;
    const voices = data?.catalog?.voices.filter(v => (!data.policy.allowedVoices.length || data.policy.allowedVoices.includes(v.id)) && `${v.name} ${Object.values(v.labels).join(" ")}`.toLowerCase().includes(voiceSearch.toLowerCase()) && (!styleFilter || v.labels.gender === styleFilter)) || [];
    if (!data)
        return <div className="vs-shell" role="status">{error ? errorText(error) : t("در حال دریافت استودیو…", "Loading studio…", "Studio wird geladen…", "Stüdyo yükleniyor…")}</div>;
    return <div className="vs-shell" dir={lang === "fa" ? "rtl" : "ltr"}><header className="vs-header"><div><span className="vs-eyebrow">AIFekr · ElevenLabs</span><h1>{t("استودیوی هوش مصنوعی صدا", "AI Voice Studio", "KI-Sprachstudio", "AI Ses Stüdyosu")}</h1><p>{t("از متن تا فایل صوتی؛ با هزینهٔ شفاف و کتابخانهٔ خصوصی.", "From text to audio, with clear pricing and a private library.", "Vom Text zur Audiodatei, mit transparenten Credits und privater Bibliothek.", "Metinden sese: şeffaf maliyet ve özel kitaplık.")}</p></div><div className="vs-balance">{data.credits.toLocaleString(lang)} <small>{t("کردیت موجود", "credits available", "verfügbare Credits", "kullanılabilir kredi")}</small><Link href="/credits">{t("افزایش اعتبار", "Top up", "Aufladen", "Bakiye yükle")}</Link></div></header>
 {!data.policy.enabled && <p className="vs-notice" role="status">{errorText("VOICE_STUDIO_DISABLED")}</p>}{data.catalogError && <p className="vs-notice">{errorText(data.catalogError)}</p>}{offline && <p role="alert" className="vs-notice">{t("آفلاین هستید؛ متن در این دستگاه حفظ می‌شود.", "You are offline. Your text is kept on this device.", "Offline. Ihr Text bleibt auf diesem Gerät erhalten.", "Çevrimdışısınız. Metin bu cihazda korunur.")}</p>}{error && <p className="vs-error" role="alert">{errorText(error)}</p>}{message && <p role="status">{message}</p>}
 <div className="vs-grid"><aside className="vs-panel"><div className="vs-row"><h2>{t("پروژه‌ها", "Projects", "Projekte", "Projeler")}</h2><button onClick={fresh}>{t("جدید", "New", "Neu", "Yeni")}</button></div><label>{t("جستجوی پروژه", "Search projects", "Projekte suchen", "Proje ara")}<input value={search} onChange={e => setSearch(e.target.value)}/></label><label className="vs-check"><input type="checkbox" checked={showArchived} onChange={e => setArchived(e.target.checked)}/>{t("نمایش آرشیو", "Show archived", "Archiv anzeigen", "Arşivi göster")}</label><nav className="vs-projects">{data.projects.filter(p => (showArchived || !p.archivedAt) && p.name.toLowerCase().includes(search.toLowerCase())).map(p => <button key={p.id} aria-pressed={id === p.id} onClick={() => choose(p)}>{p.name}{p.archivedAt ? " · 📁" : ""}</button>)}</nav></aside>
 <section className="vs-panel"><div className="vs-row"><h2>{t("متن و تنظیمات", "Text & settings", "Text & Einstellungen", "Metin ve ayarlar")}</h2><button disabled={busy || offline} onClick={() => void act(async () => { await save(); })}>{t("ذخیره", "Save", "Speichern", "Kaydet")}</button></div><label>{t("نام پروژه", "Project name", "Projektname", "Proje adı")}<input value={name} maxLength={120} onChange={e => setName(e.target.value)}/></label><label>{t("متن گویندگی", "Narration text", "Sprechtext", "Seslendirme metni")}<textarea className="vs-editor" value={text} maxLength={400000} onChange={e => { setText(e.target.value); setSegment(0); }}/></label><div className="vs-row vs-muted"><span>{graphemes(text).toLocaleString(lang)} / {data.policy.maxCharacters.toLocaleString(lang)}</span><button onClick={() => { try {
        const saved = JSON.parse(localStorage.getItem(`aifekr-voice-draft:${id || "new"}`) || "null");
        if (saved) {
            setText(saved.text);
            setName(saved.name);
            setLanguage(saved.language);
        }
    }
    catch { } }}>{t("بازیابی متن دستگاه", "Restore device draft", "Geräteentwurf laden", "Cihaz taslağını yükle")}</button></div>
 <div className="vs-two"><label>{t("مدل", "Model", "Modell", "Model")}<select value={modelId} onChange={e => { setModel(e.target.value); setSettings({}); setSegment(0); }}><option value="">—</option>{models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>{t("زبان متن", "Text language", "Textsprache", "Metin dili")}<select value={language} onChange={e => { setLanguage(e.target.value); setSegment(0); }}><option value={language}>{language}</option>{model?.languages.filter(l => l.id !== language).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label></div>
 <div className="vs-row"><label>{t("تنظیمات ذخیره‌شده","Saved presets","Gespeicherte Einstellungen","Kayıtlı ayarlar")}<select defaultValue="" onChange={e=>{const preset=data.presets.find(p=>p.id===e.target.value);if(preset){setVoice(preset.voiceId);setModel(preset.modelId);setSettings(preset.settings);}}}><option value="">—</option>{data.presets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button disabled={!voiceId||!modelId||busy} onClick={()=>{const presetName=prompt(t("نام تنظیمات","Preset name","Name der Einstellungen","Ayar adı"));if(presetName)void act(async()=>{await post({action:"savePreset",name:presetName,voiceId,modelId,settings});await load();});}}>{t("ذخیرهٔ تنظیمات","Save preset","Einstellungen speichern","Ayarları kaydet")}</button></div>{data.presets.map(p=><button key={p.id} disabled={busy} onClick={()=>void act(async()=>{await post({action:"deletePreset",id:p.id});await load();})}>{t("حذف تنظیمات","Delete preset","Einstellungen löschen","Ayarı sil")}: {p.name}</button>)}
 <details><summary>{t("تنظیمات پیشرفتهٔ سازگار با مدل", "Compatible advanced settings", "Kompatible erweiterte Einstellungen", "Uyumlu gelişmiş ayarlar")}</summary><label>{t("پایداری صدا", "Stability", "Stabilität", "Kararlılık")}<input type="range" min="0" max="1" step={modelId === "eleven_v3" ? "0.5" : "0.1"} value={settings.stability ?? .5} onChange={e => setSettings({ ...settings, stability: Number(e.target.value) })}/></label>{model?.style && <label>{t("شدت سبک", "Style strength", "Stilintensität", "Stil gücü")}<input type="range" min="0" max="1" step="0.1" value={settings.style ?? 0} onChange={e => setSettings({ ...settings, style: Number(e.target.value) })}/></label>}{model?.speakerBoost && <label className="vs-check"><input type="checkbox" checked={settings.use_speaker_boost ?? false} onChange={e => setSettings({ ...settings, use_speaker_boost: e.target.checked })}/>Speaker boost</label>}</details>
 <div className="vs-row">{id && <><button disabled={busy} onClick={() => void act(async () => { await save({ duplicate: true, name: name + " · copy" }); })}>{t("ساخت نسخه", "Duplicate", "Duplizieren", "Çoğalt")}</button><button disabled={busy} onClick={() => void act(async () => { await save({ archive: !data.projects.find(p => p.id === id)?.archivedAt }); })}>{t("آرشیو / بازگردانی", "Archive / restore", "Archiv / wiederherstellen", "Arşivle / geri al")}</button><button disabled={busy} onClick={() => { if (confirm(t("پروژه حذف شود؟", "Delete this project?", "Projekt löschen?", "Proje silinsin mi?")))
        void act(async () => { await post({ action: "deleteProject", id }); fresh(); await load(); }); }}>{t("حذف", "Delete", "Löschen", "Sil")}</button></>}</div></section>
 <aside className="vs-panel"><h2>{t("انتخاب صدا", "Choose a voice", "Stimme auswählen", "Ses seç")}</h2><label>{t("جستجوی صدا و سبک", "Search voice & style", "Stimme und Stil suchen", "Ses ve stil ara")}<input value={voiceSearch} onChange={e => setVoiceSearch(e.target.value)}/></label><label>{t("فیلتر صدا", "Voice filter", "Stimmenfilter", "Ses filtresi")}<select value={styleFilter} onChange={e => setStyleFilter(e.target.value)}><option value="">{t("همه", "All", "Alle", "Tümü")}</option>{[...new Set(data.catalog?.voices.map(v => v.labels.gender).filter(Boolean))].map(g => <option key={g}>{g}</option>)}</select></label><div className="vs-voices">{voices.map(v => <article key={v.id} className={voiceId === v.id ? "vs-selected" : ""}><button aria-pressed={voiceId === v.id} onClick={() => setVoice(v.id)}>{v.name}</button><small>{[v.labels.accent, v.labels.description].filter(Boolean).join(" · ")}</small>{v.preview && <audio controls preload="none" src={v.preview} aria-label={v.name}/>}</article>)}</div>{!voices.length && <p className="vs-muted">{t("صدای تأییدشده‌ای در این فیلتر نیست.", "No verified voices match this filter.", "Keine bestätigte Stimme für diesen Filter.", "Bu filtrede doğrulanmış ses yok.")}</p>}</aside></div>
 <section className="vs-action vs-panel"><div><strong>{voice?.name || t("صدا را انتخاب کنید", "Select a voice", "Stimme wählen", "Bir ses seçin")}</strong><p>{t("پروژه به بخش‌های مستقل تقسیم می‌شود؛ هیچ متنی حذف یا کوتاه نمی‌شود.", "Projects are split into separate outputs. Text is never silently truncated.", "Projekte werden aufgeteilt. Kein Text wird still gekürzt.", "Projeler ayrı çıktılara bölünür. Metin sessizce kesilmez.")}</p>{segments.length > 0 && <label>{t("بخش موردنظر", "Selected segment", "Gewählter Abschnitt", "Seçilen bölüm")}<select value={segment} onChange={e => setSegment(Number(e.target.value))}>{segments.map((s, i) => <option key={i} value={i}>{i + 1} / {segments.length} · ≈{Math.ceil(estimatedSeconds(s, language))} s</option>)}</select></label>}{splitError && <p role="alert">{errorText(splitError)}</p>}<p>{t("مدت تقریبی", "Approximate duration", "Ungefähre Dauer", "Yaklaşık süre")}: ≈{Math.ceil(estimate)} s · {t("کردیت تخمینی", "Estimated credits", "Geschätzte Credits", "Tahmini kredi")}: {creditsFor(estimate, data.policy)}</p><p>{t("رزرو حداکثری این بخش", "Maximum reservation for this segment", "Maximale Reservierung pro Abschnitt", "Bu bölüm için azami rezervasyon")}: <strong>{reserved}</strong> · {t("تسویه با مدت واقعی؛ باقیمانده برمی‌گردد.", "Settled on actual duration; unused credits are returned.", "Abrechnung nach Ist-Dauer, Rest wird erstattet.", "Gerçek süreye göre hesaplanır; kalan iade edilir.")}</p><small>{t("برآورد زمان تضمین نیست. خروجی بیشتر از سقف مجاز تحویل نمی‌شود و کردیت AIFekr کامل برمی‌گردد.", "Duration is an estimate. Over-limit outputs are not delivered and receive a full AIFekr refund.", "Dauer nur geschätzt. Zu lange Ausgaben werden nicht geliefert; volle Credit-Erstattung.", "Süre tahminidir. Sınırı aşan çıktı teslim edilmez ve AIFekr kredisi tamamen iade edilir.")}</small></div><button className="vs-primary" disabled={busy || offline || !data.policy.enabled || !selected || !voiceId || !model || !model.languages.some(l => l.id === language) || graphemes(text) > data.policy.maxCharacters || data.credits < reserved} onClick={() => void act(generateSelected)}>{busy ? "…" : t("تولید بخش انتخاب‌شده", "Generate selected segment", "Abschnitt generieren", "Seçili bölümü üret")}</button></section>
 <section className="vs-panel"><div className="vs-row"><h2>{t("کتابخانهٔ صوتی این پروژه", "Project audio library", "Audiobibliothek des Projekts", "Proje ses kitaplığı")}</h2><select aria-label="Generation status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">{t("همهٔ وضعیت‌ها", "All statuses", "Alle Status", "Tüm durumlar")}</option>{["READY", "QUEUED", "RUNNING", "REVIEW", "FAILED", "CANCELLED"].map(s => <option key={s} value={s}>{statusName(s)}</option>)}</select></div>{!generations.length && <p className="vs-muted">{t("یک پروژه انتخاب کنید؛ صداهای ذخیره‌شده اینجا نمایش داده می‌شوند.", "Select a project to see saved audio.", "Projekt wählen, um gespeicherte Audios zu sehen.", "Kaydedilmiş sesler için proje seçin.")}</p>}{generations.filter(g => !statusFilter || g.status === statusFilter).map(g => <article key={g.id} className="vs-generation"><div className="vs-row"><strong>{g.segmentIndex + 1} · {g.modelId}</strong><span role="status">{statusName(g.status)}</span></div><p>{g.durationMs ? `${(g.durationMs / 1000).toFixed(1)} s · ` : ""}{g.chargedCredits} {t("کردیت مصرفی", "credits charged", "verbrauchte Credits", "harcanan kredi")} · {g.refundedCredits} {t("برگشت", "refunded", "erstattet", "iade")}</p>{g.status === "REVIEW" && <p>{t("نتیجهٔ ارائه‌دهنده نامشخص است؛ رزرو تا بررسی مدیر نگه داشته می‌شود. دوباره تولید نکنید.", "Provider outcome is uncertain. Credits are held for admin review. Do not regenerate yet.", "Unklarer Anbieterstatus. Credits bleiben bis zur Prüfung reserviert. Noch nicht erneut generieren.", "Sağlayıcı sonucu belirsiz. Kredi yönetici incelemesine kadar tutulur. Yeniden üretmeyin.")}</p>}{g.errorCode && <p className="vs-muted">{g.errorCode}</p>}{g.status === "READY" && <><svg className="vs-wave" viewBox="0 0 400 48" role="img" aria-label={t("شکل موج واقعی صدا", "Actual audio waveform", "Echte Audiowellenform", "Gerçek ses dalgası")}>{(JSON.parse(g.waveform || "[]") as number[]).map((v, i) => <rect key={i} x={i * 5} y={24 - Math.max(1, v * 23)} width="3" height={Math.max(2, v * 46)} rx="1"/>)}</svg><audio key={audioVersion} controls preload="none" src={`/api/voice-studio?audio=${g.id}&v=${audioVersion}`}/><div className="vs-row"><a href={`/api/voice-studio?audio=${g.id}&download=1`}>MP3 ↓</a><button onClick={() => setAudioVersion(v => v + 1)}>{t("تازه‌سازی لینک پخش", "Refresh playback link", "Wiedergabelink erneuern", "Oynatma bağlantısını yenile")}</button><button onClick={() => void act(async () => { await post({ action: "deleteAudio", id: g.id }); await history(); })}>{t("حذف فایل", "Delete audio", "Audio löschen", "Sesi sil")}</button></div></>}{g.status === "QUEUED" && <button disabled={busy} onClick={() => void act(async () => { await post({ action: "cancel", id: g.id }); await history(); await load(); })}>{t("لغو و بازگشت رزرو", "Cancel and release credits", "Abbrechen und Credits freigeben", "İptal et ve krediyi iade et")}</button>}</article>)}</section></div>;
}
