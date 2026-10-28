"use client";
import { useCallback, useEffect, useMemo, useState,useRef } from "react";
import GeneratePanel from "./GeneratePanel";
import GenerationProgress from "./GenerationProgress";
import Link from "next/link";
import { Archive, AudioLines, Check, Coins, Copy, Download, FolderOpen, MoreHorizontal, Pause, Play, Plus, RefreshCw, RotateCcw, Save, Search, Settings2, Trash2 } from "lucide-react";
import { useTranslation, tri } from "@/lib/i18n";
import { graphemes, estimatedSeconds, splitProject, creditsFor, type VoicePolicy } from "@/lib/voice-studio/domain";
import type { SpeechCatalog } from "@/lib/voice-studio/provider";
import "./voice-studio.css";
import "./studio-layout.css";
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
    providerStartedAt?:string|null;
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
    access?: { planAllowed: boolean; storageReady: boolean };
    policy: VoicePolicy;
    catalog: SpeechCatalog | null;
    catalogError: string | null;
    credits: number;
    projects: Project[];
    presets: Preset[];
};
export default function VoiceStudio() {
    const { lang } = useTranslation(), t = (fa: string, en: string, de: string, tr: string) => tri(lang, fa, en, de, tr);
    const [data, setData] = useState<Data | null>(null), [id, setId] = useState(""), [name, setName] = useState(""), [text, setText] = useState(""), [language, setLanguage] = useState<string>(lang), [pickedModel, setModel] = useState(""), [voiceId, setVoice] = useState(""), [voiceSearch, setVoiceSearch] = useState(""), [styleFilter, setStyleFilter] = useState(""), [segment, setSegment] = useState(0), [generations, setGenerations] = useState<Generation[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState(""), [offline, setOffline] = useState(false), [showArchived, setArchived] = useState(false), [statusFilter, setStatusFilter] = useState(""), [settings, setSettings] = useState<{
        stability?: number;
        style?: number;
        use_speaker_boost?: boolean;
    }>({}), [audioVersion, setAudioVersion] = useState(0);
    const errorText = (code: string) => { const known: Record<string, string> = { INSUFFICIENT_CREDITS: t("کردیت کافی نیست؛ کیف پول را شارژ کنید.", "Insufficient credits. Top up your wallet.", "Nicht genügend Credits. Guthaben aufladen.", "Yetersiz kredi. Bakiyenizi yükleyin."), VOICE_STUDIO_DISABLED: t("تولید صدا هنوز توسط مدیر فعال نشده است. متن شما قابل ذخیره است.", "Generation is not enabled by the admin yet. You can save your text.", "Generierung noch nicht freigeschaltet. Text kann gespeichert werden.", "Üretim yönetici tarafından açılmadı. Metninizi kaydedebilirsiniz."), CATALOG_NOT_VERIFIED: t("اتصال و فهرست صداها نیازمند بررسی مدیر است.", "The admin must verify connectivity and the voice catalog.", "Der Administrator muss Verbindung und Stimmen prüfen.", "Yönetici bağlantı ve ses listesini doğrulamalıdır.") }; if(voiceErrorMessage(code,lang)!==code)return voiceErrorMessage(code,lang);return known[code] || `${t("عملیات انجام نشد", "Action failed", "Aktion fehlgeschlagen", "İşlem başarısız")}: ${code}`; };
    const initialProject=useRef(false);
    const player=useRef<HTMLAudioElement|null>(null), [playing,setPlaying]=useState(""), [presetId,setPresetId]=useState("");
    // One shared player for voice previews instead of a full audio control per card.
    function togglePreview(voice:string,src:string){const audio=player.current;if(!audio)return;if(playing===voice){audio.pause();return;}audio.src=src;void audio.play().then(()=>setPlaying(voice)).catch(()=>setPlaying(""));}
    const preferredLanguage=`${lang}`;
    const wasPending=useRef(false);
    const [submitting,setSubmitting]=useState(false);
    const pending=generations.some(g=>g.status==="QUEUED"||g.status==="RUNNING");
    const progressJob=generations.find(g=>g.status==="QUEUED"||g.status==="RUNNING")||generations[0];
    async function post(body: unknown) { const r = await fetch("/api/voice-studio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const d = await r.json(); if (!r.ok)
        throw Error(d.code || "REQUEST_FAILED"); return d; }
    const load = useCallback(async () => { const r = await fetch("/api/voice-studio", { cache: "no-store" }); const d = await r.json(); if (!r.ok)
        throw Error(d.code || "AUTH_REQUIRED"); setData(d);
        const approved=(d as Data).catalog?.models.filter(m=>d.policy.allowedModels.includes(m.id)&&m.languages.some(l=>l.id===preferredLanguage))||[];
        const recommended=approved.find(m=>/turbo|flash|conversational/i.test(m.id))||approved.find(m=>m.id==="eleven_v3")||approved[0];
        if(recommended)setModel(current=>current||recommended.id);
        const firstVoice=(d as Data).catalog?.voices.find(v=>!d.policy.allowedVoices.length||d.policy.allowedVoices.includes(v.id));
        if(firstVoice)setVoice(current=>current||firstVoice.id);
        if(!initialProject.current){initialProject.current=true;const query=new URLSearchParams(location.search).get("project");const project=d.projects.find((p:Project)=>p.id===query);if(project){setId(project.id);setName(project.name);setText(project.text);setLanguage(project.language);}}
        return d as Data; }, [preferredLanguage]);
    const history = useCallback(async () => { if (!id)
        return; const r = await fetch(`/api/voice-studio?project=${encodeURIComponent(id)}`, { cache: "no-store" }); const d = await r.json(); if (r.ok)
        setGenerations(d.generations); }, [id]);
    useEffect(() => { const timer=setTimeout(()=>void load().catch(() => setError("LOAD_FAILED")),0);return()=>clearTimeout(timer); }, [load]);
    useEffect(()=>{if(wasPending.current&&!pending)void load().catch(()=>{});wasPending.current=pending;},[pending,load]);
    useEffect(() => { const initial=setTimeout(()=>void history(),0); const timer = setInterval(() => { if (document.visibilityState === "visible") {
        void history();
    } }, pending?1000:12000); return () => {clearTimeout(initial);clearInterval(timer);}; }, [history,pending]);
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
        setSubmitting(true);try{
        const project=await save();
        const fingerprint=JSON.stringify({projectId:project.id,text,segment,voiceId,modelId,settings});
        const storageKey=`aifekr-voice-request:${project.id}`;
        let pending:{fingerprint:string;key:string}|null=null;
        try{pending=JSON.parse(sessionStorage.getItem(storageKey)||"null");}catch{}
        if(!pending||pending.fingerprint!==fingerprint)pending={fingerprint,key:crypto.randomUUID()};
        sessionStorage.setItem(storageKey,JSON.stringify(pending));
        const queued=await post({action:"generate",projectId:project.id,segmentIndex:segment,voiceId,modelId,idempotencyKey:pending.key,settings});
        setGenerations(current=>[queued.generation,...current.filter(g=>g.id!==queued.generation.id)]);
        requestAnimationFrame(()=>document.getElementById("voice-generation-progress")?.scrollIntoView({block:"nearest",behavior:"auto"}));
        sessionStorage.removeItem(storageKey);
        await load();
        const response=await fetch(`/api/voice-studio?project=${encodeURIComponent(project.id)}`,{cache:"no-store"});
        if(response.ok)setGenerations((await response.json()).generations);
        setMessage(t("در صف تولید قرار گرفت","Queued for generation","Zur Generierung eingereiht","Üretim kuyruğuna alındı"));
        }finally{setSubmitting(false);}
    }
    function statusName(status:string){return ({READY:t("آماده","Ready","Bereit","Hazır"),QUEUED:t("در صف","Queued","In Warteschlange","Kuyrukta"),RUNNING:t("در حال تولید","Generating","Wird generiert","Üretiliyor"),REVIEW:t("نیازمند بررسی","Needs review","Prüfung erforderlich","İnceleme gerekli"),FAILED:t("ناموفق","Failed","Fehlgeschlagen","Başarısız"),CANCELLED:t("لغوشده","Cancelled","Abgebrochen","İptal edildi")} as Record<string,string>)[status]||status;}
    const allowedModels = data?.catalog?.models.filter(m => data.policy.allowedModels.includes(m.id)) || [];
    const models = allowedModels.filter(m => m.languages.some(l => l.id === language));
    const languageNames = new Map(allowedModels.flatMap(m => m.languages.map(l => [l.id, l.name] as const)));
    const languageLabel = (id: string) => id === "fa" ? t("فارسی", "Persian", "Persisch", "Farsça") : languageNames.get(id) || id;
    const languages = [...languageNames.keys()].sort((a, b) => a === language ? -1 : b === language ? 1 : languageLabel(a).localeCompare(languageLabel(b)));
    // The effective model always speaks the chosen language; the picked one is kept if it can.
    const modelId = models.some(m => m.id === pickedModel) ? pickedModel : models[0]?.id ?? pickedModel;
    const model = data?.catalog?.models.find(m => m.id === modelId), voice = data?.catalog?.voices.find(v => v.id === voiceId);
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
    const blockedReason=!data.policy.enabled?errorText("VOICE_STUDIO_DISABLED"):data.access&&!data.access.planAllowed?errorText("PLAN_REQUIRED"):!text.trim()?t("اول متن گویندگی را بنویسید.","Write the narration text first.","Zuerst den Sprechtext schreiben.","Önce seslendirme metnini yazın."):!voiceId?t("یک صدا از فهرست صداها انتخاب کنید.","Choose a voice from the voice list.","Eine Stimme aus der Liste wählen.","Ses listesinden bir ses seçin."):!model?t("برای این زبان مدلی فعال نیست.","No enabled model supports this language.","Kein aktiviertes Modell unterstützt diese Sprache.","Bu dil için etkin model yok."):graphemes(text)>data.policy.maxCharacters?errorText("PROJECT_TEXT_TOO_LONG"):data.credits<reserved?errorText("INSUFFICIENT_CREDITS"):offline?t("اتصال اینترنت برقرار نیست.","You are offline.","Sie sind offline.","Çevrimdışısınız."):"";
    const genders=[...new Set(data.catalog?.voices.map(v => v.labels.gender).filter(Boolean))];
    const current=data.projects.find(p=>p.id===id);
    const totalSeconds=Math.ceil(estimatedSeconds(text || " ", language));
    return <div className="vs-shell vs-app" dir={lang === "fa" ? "rtl" : "ltr"}>
 <header className="vs-top"><div><span className="vs-eyebrow">AIFekr · ElevenLabs</span><h1>{t("استودیوی هوش مصنوعی صدا", "AI Voice Studio", "KI-Sprachstudio", "AI Ses Stüdyosu")}</h1><p>{t("متن را بنویسید، صدا را انتخاب کنید و فایل صوتی بگیرید.", "Write your text, pick a voice, get your audio file.", "Text schreiben, Stimme wählen, Audiodatei erhalten.", "Metni yazın, sesi seçin, ses dosyanızı alın.")}</p></div><div className="vs-wallet"><Coins size={18}/><strong>{data.credits.toLocaleString(lang)}</strong><span>{t("کردیت", "credits", "Credits", "kredi")}</span><Link href="/credits">{t("افزایش", "Top up", "Aufladen", "Yükle")}</Link></div></header>
 {!data.policy.enabled && <p className="vs-notice" role="status">{errorText("VOICE_STUDIO_DISABLED")}</p>}{data.policy.enabled && data.access && !data.access.planAllowed && <p className="vs-notice" role="status">{errorText("PLAN_REQUIRED")} <Link href="/pricing">{t("مشاهدهٔ پکیج‌ها", "See plans", "Pakete ansehen", "Paketleri gör")}</Link></p>}{data.policy.enabled && data.access && !data.access.storageReady && <p className="vs-notice" role="status">{errorText("PRIVATE_STORAGE_REQUIRED")}</p>}{data.catalogError && <p className="vs-notice">{errorText(data.catalogError)}</p>}{offline && <p role="alert" className="vs-notice">{t("آفلاین هستید؛ متن در این دستگاه حفظ می‌شود.", "You are offline. Your text is kept on this device.", "Offline. Ihr Text bleibt auf diesem Gerät erhalten.", "Çevrimdışısınız. Metin bu cihazda korunur.")}</p>}{error && <p className="vs-error" role="alert">{errorText(error)}</p>}{message && <p className="vs-toast" role="status">{message}</p>}
 <div className="vs-projectbar"><FolderOpen size={18} aria-hidden/><select aria-label={t("پروژه", "Project", "Projekt", "Proje")} value={id} onChange={e => { const p = data.projects.find(p => p.id === e.target.value); if (p) choose(p); else fresh(); }}><option value="">{t("پروژهٔ جدید", "New project", "Neues Projekt", "Yeni proje")}</option>{data.projects.filter(p => showArchived || !p.archivedAt || p.id === id).map(p => <option key={p.id} value={p.id}>{p.name}{p.archivedAt ? ` (${t("آرشیو", "archived", "archiviert", "arşiv")})` : ""}</option>)}</select><label className="vs-check"><input type="checkbox" checked={showArchived} onChange={e => setArchived(e.target.checked)}/>{t("آرشیو", "Archived", "Archiv", "Arşiv")}</label><span className="vs-spacer"/><button onClick={fresh}><Plus size={16}/>{t("جدید", "New", "Neu", "Yeni")}</button><button disabled={busy || offline} onClick={() => void act(async () => { await save(); })}><Save size={16}/>{t("ذخیره", "Save", "Speichern", "Kaydet")}</button>{id && <details className="vs-menu"><summary aria-label={t("کارهای بیشتر", "More actions", "Weitere Aktionen", "Diğer işlemler")}><MoreHorizontal size={18}/></summary><div><button disabled={busy} onClick={() => void act(async () => { await save({ duplicate: true, name: name + " · copy" }); })}><Copy size={15}/>{t("ساخت نسخه", "Duplicate", "Duplizieren", "Çoğalt")}</button><button disabled={busy} onClick={() => void act(async () => { await save({ archive: !current?.archivedAt }); })}><Archive size={15}/>{current?.archivedAt ? t("بازگردانی از آرشیو", "Restore", "Wiederherstellen", "Geri al") : t("آرشیو", "Archive", "Archivieren", "Arşivle")}</button><button className="vs-danger" disabled={busy} onClick={() => { if (confirm(t("پروژه حذف شود؟", "Delete this project?", "Projekt löschen?", "Proje silinsin mi?")))
        void act(async () => { await post({ action: "deleteProject", id }); fresh(); await load(); }); }}><Trash2 size={15}/>{t("حذف پروژه", "Delete project", "Projekt löschen", "Projeyi sil")}</button></div></details>}</div>
 <div className="vs-layout"><div className="vs-main">
 <section className="vs-card"><div className="vs-card-head"><span className="vs-step">1</span><div><h2>{t("متن", "Text", "Text", "Metin")}</h2><p>{t("متنی که باید خوانده شود", "What should be spoken", "Was gesprochen werden soll", "Seslendirilecek metin")}</p></div><select className="vs-compact" aria-label={t("زبان متن", "Text language", "Textsprache", "Metin dili")} value={language} onChange={e => { setLanguage(e.target.value); setSegment(0); }}>{(languages.length ? languages : [language]).map(id => <option key={id} value={id}>{languageLabel(id)}</option>)}</select></div>
 <input className="vs-name" aria-label={t("نام پروژه", "Project name", "Projektname", "Proje adı")} placeholder={t("نام پروژه (اختیاری)", "Project name (optional)", "Projektname (optional)", "Proje adı (isteğe bağlı)")} value={name} maxLength={120} onChange={e => setName(e.target.value)}/>
 <textarea className="vs-editor" aria-label={t("متن گویندگی", "Narration text", "Sprechtext", "Seslendirme metni")} placeholder={t("متن گویندگی را اینجا بنویسید یا بچسبانید…", "Type or paste the narration here…", "Sprechtext hier eingeben oder einfügen…", "Seslendirme metnini buraya yazın veya yapıştırın…")} value={text} maxLength={400000} onChange={e => { setText(e.target.value); setSegment(0); }}/>
 <div className="vs-editor-foot"><span className={graphemes(text) > data.policy.maxCharacters ? "vs-over" : ""}>{graphemes(text).toLocaleString(lang)} / {data.policy.maxCharacters.toLocaleString(lang)} {t("نویسه", "characters", "Zeichen", "karakter")}{text.trim() ? ` · ≈ ${totalSeconds.toLocaleString(lang)} ${t("ثانیه", "s", "s", "sn")}` : ""}{segments.length > 1 ? ` · ${segments.length.toLocaleString(lang)} ${t("بخش", "segments", "Abschnitte", "bölüm")}` : ""}</span><button className="vs-link" onClick={() => { try {
        const saved = JSON.parse(localStorage.getItem(`aifekr-voice-draft:${id || "new"}`) || "null");
        if (saved) {
            setText(saved.text);
            setName(saved.name);
            setLanguage(saved.language);
        }
    }
    catch { } }}><RotateCcw size={14}/>{t("بازیابی پیش‌نویس", "Restore draft", "Entwurf laden", "Taslağı yükle")}</button></div></section>
 <section className="vs-card"><div className="vs-card-head"><span className="vs-step">2</span><div><h2>{t("صدا", "Voice", "Stimme", "Ses")}</h2><p>{voice?.name || t("یک گوینده انتخاب کنید", "Pick a speaker", "Sprecher wählen", "Bir seslendirmen seçin")}</p></div></div>
 <div className="vs-voice-tools"><label className="vs-search"><Search size={16} aria-hidden/><input aria-label={t("جستجوی صدا", "Search voices", "Stimmen suchen", "Ses ara")} placeholder={t("جستجوی نام یا سبک…", "Search name or style…", "Name oder Stil suchen…", "İsim veya stil ara…")} value={voiceSearch} onChange={e => setVoiceSearch(e.target.value)}/></label>{genders.length > 1 && <div className="vs-chips" role="group" aria-label={t("فیلتر صدا", "Voice filter", "Stimmenfilter", "Ses filtresi")}>{["", ...genders].map(g => <button key={g || "all"} aria-pressed={styleFilter === g} onClick={() => setStyleFilter(g)}>{g === "" ? t("همه", "All", "Alle", "Tümü") : g === "female" ? t("زن", "Female", "Weiblich", "Kadın") : g === "male" ? t("مرد", "Male", "Männlich", "Erkek") : g === "neutral" ? t("خنثی", "Neutral", "Neutral", "Nötr") : g}</button>)}</div>}</div>
 <div className="vs-voice-grid">{voices.map(v => <div key={v.id} className={`vs-voice${voiceId === v.id ? " vs-selected" : ""}`}><button className="vs-voice-pick" aria-pressed={voiceId === v.id} onClick={() => setVoice(v.id)}><span className="vs-avatar" aria-hidden>{v.name.slice(0, 1)}</span><span className="vs-voice-text" dir="auto"><strong>{v.name.split(" - ")[0]}</strong><small>{v.name.split(" - ")[1] || [v.labels.accent, v.labels.description || v.labels.age].filter(Boolean).join(" · ")}</small></span>{voiceId === v.id && <Check size={16} className="vs-tick"/>}</button>{v.preview && <button className="vs-play" aria-label={`${t("پیش‌نمایش", "Preview", "Vorhören", "Önizle")} ${v.name}`} onClick={() => togglePreview(v.id, v.preview!)}>{playing === v.id ? <Pause size={15}/> : <Play size={15}/>}</button>}</div>)}</div>
 {!voices.length && <p className="vs-muted">{t("صدای تأییدشده‌ای در این فیلتر نیست.", "No verified voices match this filter.", "Keine bestätigte Stimme für diesen Filter.", "Bu filtrede doğrulanmış ses yok.")}</p>}
 <audio ref={player} hidden onEnded={() => setPlaying("")} onPause={() => setPlaying("")}/>
 <details className="vs-settings"><summary><Settings2 size={16}/>{t("مدل و تنظیمات صدا", "Model & voice settings", "Modell & Stimmeinstellungen", "Model ve ses ayarları")}<span className="vs-muted">{model?.name}</span></summary>
 <div className="vs-two"><label>{t("مدل", "Model", "Modell", "Model")}<select value={modelId} onChange={e => { setModel(e.target.value); setSettings({}); setSegment(0); }}>{!models.length&&<option value="">—</option>}{models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>{t("تنظیمات ذخیره‌شده","Saved presets","Gespeicherte Einstellungen","Kayıtlı ayarlar")}<select value={presetId} onChange={e=>{setPresetId(e.target.value);const preset=data.presets.find(p=>p.id===e.target.value);if(preset){setVoice(preset.voiceId);setModel(preset.modelId);setSettings(preset.settings);}}}><option value="">—</option>{data.presets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div>
 <label>{t("پایداری صدا", "Stability", "Stabilität", "Kararlılık")}<input type="range" min="0" max="1" step={modelId === "eleven_v3" ? "0.5" : "0.1"} value={settings.stability ?? .5} onChange={e => setSettings({ ...settings, stability: Number(e.target.value) })}/></label>{model?.style && <label>{t("شدت سبک", "Style strength", "Stilintensität", "Stil gücü")}<input type="range" min="0" max="1" step="0.1" value={settings.style ?? 0} onChange={e => setSettings({ ...settings, style: Number(e.target.value) })}/></label>}{model?.speakerBoost && <label className="vs-check"><input type="checkbox" checked={settings.use_speaker_boost ?? false} onChange={e => setSettings({ ...settings, use_speaker_boost: e.target.checked })}/>Speaker boost</label>}
 <div className="vs-row vs-start"><button disabled={!voiceId||!modelId||busy} onClick={()=>{const presetName=prompt(t("نام تنظیمات","Preset name","Name der Einstellungen","Ayar adı"));if(presetName)void act(async()=>{await post({action:"savePreset",name:presetName,voiceId,modelId,settings});await load();});}}><Save size={15}/>{t("ذخیرهٔ این تنظیمات","Save these settings","Diese Einstellungen speichern","Bu ayarları kaydet")}</button>{presetId&&<button className="vs-danger" disabled={busy} onClick={()=>void act(async()=>{await post({action:"deletePreset",id:presetId});setPresetId("");await load();})}><Trash2 size={15}/>{t("حذف تنظیمات انتخاب‌شده","Delete selected preset","Ausgewählte Einstellung löschen","Seçili ayarı sil")}</button>}</div></details></section>
 {splitError&&<p role="alert" className="vs-error">{errorText(splitError)}</p>}
 </div>
 <aside className="vs-side">
 <GeneratePanel blockedReason={blockedReason} voice={voice?.name} model={model?.name} segments={segments} segment={segment} onSegment={setSegment} estimate={estimate} estimatedCredits={creditsFor(estimate,data.policy)} reserved={reserved} interval={data.policy.billingInterval} rate={data.policy.creditsPerInterval} disabled={busy||!!blockedReason||!selected} busy={busy} pending={pending} onGenerate={()=>void act(generateSelected)}/>
 <GenerationProgress job={progressJob} submitting={submitting}/>
 <section className="vs-card vs-library"><div className="vs-card-head"><AudioLines size={18} className="vs-accent"/><div><h2>{t("فایل‌های صوتی", "Audio files", "Audiodateien", "Ses dosyaları")}</h2></div>{generations.length > 0 && <select className="vs-compact" aria-label={t("وضعیت", "Status", "Status", "Durum")} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">{t("همه", "All", "Alle", "Tümü")}</option>{["READY", "QUEUED", "RUNNING", "REVIEW", "FAILED", "CANCELLED"].map(s => <option key={s} value={s}>{statusName(s)}</option>)}</select>}</div>{!generations.length && <p className="vs-muted vs-empty">{id ? t("هنوز صدایی برای این پروژه ساخته نشده.", "No audio for this project yet.", "Noch kein Audio für dieses Projekt.", "Bu proje için henüz ses yok.") : t("بعد از اولین تولید، فایل‌ها اینجا می‌آیند.", "Your files will appear here after the first generation.", "Nach der ersten Generierung erscheinen die Dateien hier.", "İlk üretimden sonra dosyalar burada görünür.")}</p>}{generations.filter(g => !statusFilter || g.status === statusFilter).map(g => <article key={g.id} className="vs-generation"><div className="vs-row"><strong>{t("بخش", "Part", "Teil", "Bölüm")} {(g.segmentIndex + 1).toLocaleString(lang)}</strong><span className={`vs-pill vs-pill-${g.status.toLowerCase()}`}>{statusName(g.status)}</span></div><p className="vs-muted">{g.durationMs ? `${(g.durationMs / 1000).toFixed(1)} s · ` : ""}{g.chargedCredits} {t("کردیت", "credits", "Credits", "kredi")}{g.refundedCredits ? ` · ${g.refundedCredits} ${t("برگشت", "refunded", "erstattet", "iade")}` : ""}</p>{g.status === "REVIEW" && <p>{t("نتیجهٔ ارائه‌دهنده نامشخص است؛ رزرو تا بررسی مدیر نگه داشته می‌شود. دوباره تولید نکنید.", "Provider outcome is uncertain. Credits are held for admin review. Do not regenerate yet.", "Unklarer Anbieterstatus. Credits bleiben bis zur Prüfung reserviert. Noch nicht erneut generieren.", "Sağlayıcı sonucu belirsiz. Kredi yönetici incelemesine kadar tutulur. Yeniden üretmeyin.")}</p>}{g.errorCode && <p className="vs-muted">{errorText(g.errorCode)}</p>}{g.status === "READY" && <><svg className="vs-wave" viewBox="0 0 400 48" role="img" aria-label={t("شکل موج واقعی صدا", "Actual audio waveform", "Echte Audiowellenform", "Gerçek ses dalgası")}>{(JSON.parse(g.waveform || "[]") as number[]).map((v, i) => <rect key={i} x={i * 5} y={24 - Math.max(1, v * 23)} width="3" height={Math.max(2, v * 46)} rx="1"/>)}</svg><audio key={audioVersion} controls preload="none" src={`/api/voice-studio?audio=${g.id}&v=${audioVersion}`}/><div className="vs-row vs-start"><a href={`/api/voice-studio?audio=${g.id}&download=1`}><Download size={15}/>MP3</a><button aria-label={t("تازه‌سازی لینک پخش", "Refresh playback link", "Wiedergabelink erneuern", "Oynatma bağlantısını yenile")} title={t("تازه‌سازی لینک پخش", "Refresh playback link", "Wiedergabelink erneuern", "Oynatma bağlantısını yenile")} onClick={() => setAudioVersion(v => v + 1)}><RefreshCw size={15}/></button><button className="vs-danger" aria-label={t("حذف فایل", "Delete audio", "Audio löschen", "Sesi sil")} title={t("حذف فایل", "Delete audio", "Audio löschen", "Sesi sil")} onClick={() => { if (confirm(t("فایل صوتی حذف شود؟", "Delete this audio?", "Audio löschen?", "Ses silinsin mi?"))) void act(async () => { await post({ action: "deleteAudio", id: g.id }); await history(); }); }}><Trash2 size={15}/></button></div></>}{g.status === "QUEUED" && <button disabled={busy} onClick={() => void act(async () => { await post({ action: "cancel", id: g.id }); await history(); await load(); })}>{t("لغو و بازگشت رزرو", "Cancel and release credits", "Abbrechen und Credits freigeben", "İptal et ve krediyi iade et")}</button>}</article>)}</section>
 </aside></div></div>;
}
