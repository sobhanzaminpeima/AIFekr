"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Script from "next/script";
import {
  Image as ImageIcon, Video, Music, Wand2, Download, Loader2, Languages, Upload, X, Sparkles, Gift, Coins,
  Copy, Check, User, Package, Mountain, Palette, Briefcase, Wand, Camera, Mic, MicOff, Plus,
  History, PanelRightClose, Maximize2, Minimize2, Send, RotateCcw, Play, Pause, UserSquare2, MessageSquare,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { tri, type Lang } from "@/lib/i18n";
import ChatInterface from "@/components/chat/ChatInterface";
import CreditCost from "@/components/ui/CreditCost";

type MediaType = "chat" | "image" | "video" | "music";

const RATIOS = ["1:1", "16:9", "9:16", "4:3"];
const VIDEO_RATIOS = ["16:9", "9:16", "1:1"];
const VIDEO_STYLES = [
  { value: "واقعی", fa: "واقعی", en: "Realistic", de: "Realistisch" },
  { value: "انیمیشن", fa: "انیمیشن", en: "Animation", de: "Animation" },
  { value: "سینمایی", fa: "سینمایی", en: "Cinematic", de: "Filmisch" },
  { value: "کارتونی", fa: "کارتونی", en: "Cartoon", de: "Cartoon" },
];
const VIDEO_DURATIONS = [{ value: 5, credits: 20 }, { value: 10, credits: 35 }, { value: 30, credits: 80 }];
const MUSIC_GENRES = ["پاپ", "کلاسیک", "الکترونیک", "سنتی ایرانی", "آرامش‌بخش", "راک", "جاز", "هیپ‌هاپ"];
const MUSIC_DURATIONS = [{ value: 30, credits: 10 }, { value: 60, credits: 18 }, { value: 120, credits: 30 }];

interface PromptTemplate {
  id: string; title: string; titleEn: string | null; content: string; contentEn: string | null; category: string; thumbnailUrl: string | null;
}
const IMAGE_CATEGORIES = [
  { id: "all",       fa: "همه",              en: "All",         de: "Alle", icon: Sparkles,   gradient: "linear-gradient(135deg, #ea580c, #f97316)" },
  { id: "portrait",  fa: "پرتره",            en: "Portrait",    de: "Porträt", icon: User,       gradient: "linear-gradient(135deg, #ec4899, #f472b6)" },
  { id: "product",   fa: "محصول",            en: "Product",     de: "Produkt", icon: Package,    gradient: "linear-gradient(135deg, #06b6d4, #0ea5e9)" },
  { id: "landscape", fa: "منظره و طبیعت",    en: "Landscape",   de: "Landschaft", icon: Mountain,   gradient: "linear-gradient(135deg, #10b981, #22c55e)" },
  { id: "art",       fa: "هنری و نقاشی",     en: "Art",         de: "Kunst", icon: Palette,    gradient: "linear-gradient(135deg, #8b5cf6, #a78bfa)" },
  { id: "corporate", fa: "کسب‌وکار",         en: "Corporate",   de: "Unternehmen", icon: Briefcase,  gradient: "linear-gradient(135deg, #3b82f6, #6366f1)" },
  { id: "fantasy",   fa: "فانتزی و سینمایی", en: "Fantasy",     de: "Fantasie", icon: Wand,       gradient: "linear-gradient(135deg, #f59e0b, #ea580c)" },
  { id: "1980s",     fa: "دهه ۸۰ میلادی",    en: "1980s",       de: "1980er", icon: Camera,     gradient: "linear-gradient(135deg, #d946ef, #f472b6)" },
];
const REFERENCE_REQUIRED_CATEGORIES = new Set(["1980s"]);

const IMAGE_STYLES = ["realistic", "anime", "painting", "minimal", "fantasy", "3d"];
const IMAGE_STYLE_LABEL: Record<string, Record<Lang, string>> = {
  realistic: { fa: "واقعی", en: "Realistic", de: "Realistisch", tr: "Realistic" },
  anime: { fa: "انیمه", en: "Anime", de: "Anime", tr: "Anime" },
  painting: { fa: "نقاشی", en: "Painting", de: "Gemälde", tr: "Painting" },
  minimal: { fa: "مینیمال", en: "Minimal", de: "Minimalistisch", tr: "Minimal" },
  fantasy: { fa: "فانتزی", en: "Fantasy", de: "Fantasy", tr: "Fantasy" },
  "3d": { fa: "سه‌بعدی", en: "3D", de: "3D", tr: "3D" },
};

declare global {
  interface Window {
    puter?: { ai: { chat: (p: string, o?: { model?: string }) => Promise<string>; txt2img: (p: string, o?: { model?: string }) => Promise<HTMLImageElement> } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition: new () => any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition: new () => any;
  }
}

interface UserTurn {
  text: string;
  sourceImageUrl?: string | null;
  settings?: Record<string, unknown>;
}
interface AssistantTurn {
  images?: string[];
  videoUrl?: string;
  audioUrl?: string;
  error?: string;
  pending?: boolean;
  pendingLabel?: string;
}
interface ChatMessage { id: string; role: "user" | "assistant"; turn: UserTurn | AssistantTurn; }
interface ConversationSummary { id: string; title: string | null; updatedAt: string; }

const TYPE_META: Record<MediaType, { icon: typeof ImageIcon; labelFa: string; labelEn: string; labelDe: string }> = {
  chat: { icon: MessageSquare, labelFa: "همه", labelEn: "All", labelDe: "Alle" },
  image: { icon: ImageIcon, labelFa: "عکس", labelEn: "Image", labelDe: "Bild" },
  video: { icon: Video, labelFa: "ویدیو", labelEn: "Video", labelDe: "Video" },
  music: { icon: Music, labelFa: "موزیک", labelEn: "Music", labelDe: "Musik" },
};

export default function UnifiedCreateInterface({ lang }: { lang: Lang }) {
  const isFa = lang === "fa";
  // "چت"/"All" is the default landing tab -- a general AI assistant, same as
  // the reference site's own default, with عکس/ویدیو/موزیک one tap away.
  const [mediaType, setMediaType] = useState<MediaType>("chat");

  const [prompt, setPrompt] = useState("");
  const [imageStyle, setImageStyle] = useState("realistic");
  const [imageRatio, setImageRatio] = useState("1:1");
  const [imageQuality, setImageQuality] = useState<"standard" | "hd">("standard");
  const [imageCount, setImageCount] = useState(1);
  const [videoStyle, setVideoStyle] = useState(VIDEO_STYLES[0].value);
  const [videoDuration, setVideoDuration] = useState(5);
  const [videoRatio, setVideoRatio] = useState("16:9");
  const [musicGenre, setMusicGenre] = useState(MUSIC_GENRES[0]);
  const [musicDuration, setMusicDuration] = useState(30);

  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const [translating, setTranslating] = useState(false);

  const [mode, setMode] = useState<"credits" | "puter">("credits");
  const [puterReady, setPuterReady] = useState(false);
  const [imageProviders, setImageProviders] = useState<{ id: string; name: string }[]>([]);
  const [imageProvider, setImageProvider] = useState("");
  const [videoProviders, setVideoProviders] = useState<{ id: string; name: string }[]>([]);
  const [videoProvider, setVideoProvider] = useState("");

  const [toolsOpen, setToolsOpen] = useState(false);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<ConversationSummary[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => { if (typeof window !== "undefined" && window.puter) setPuterReady(true); }, []);

  useEffect(() => {
    fetch("/api/ai/image-providers", { credentials: "include" }).then((r) => r.json()).then((d) => {
      setImageProviders(d.providers || []);
      if (d.providers?.length) setImageProvider(d.providers[0].id);
    }).catch(() => {});
    fetch("/api/ai/video-providers", { credentials: "include" }).then((r) => r.json()).then((d) => {
      setVideoProviders(d.providers || []);
      if (d.providers?.length) setVideoProvider(d.providers[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (mediaType === "music") { setTemplates([]); return; }
    fetch(`/api/prompts?toolType=${mediaType}`).then((r) => r.json()).then((d) => {
      const list: PromptTemplate[] = d.prompts || [];
      setTemplates(list);
      if (mediaType === "image") {
        const counts = new Map<string, number>();
        for (const t of list) { if (!t.thumbnailUrl || t.category === "all") continue; counts.set(t.category, (counts.get(t.category) || 0) + 1); }
        let best: string | null = null, bestCount = 0;
        counts.forEach((c, cat) => { if (c > bestCount) { best = cat; bestCount = c; } });
        if (best) setActiveCategory(best);
      }
    }).catch(() => {});
  }, [mediaType]);

  const loadHistoryList = useCallback(() => {
    // The "chat" tab renders the full, self-contained <ChatInterface> below
    // instead, which manages its own conversations/history entirely --
    // nothing to fetch here for that tab.
    if (mediaType === "chat") { setHistory([]); return; }
    fetch(`/api/create/chat/conversations?type=${mediaType}`, { credentials: "include" })
      .then((r) => r.json()).then((d) => setHistory(d.conversations || [])).catch(() => {});
  }, [mediaType]);

  useEffect(() => { loadHistoryList(); }, [loadHistoryList]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  // Switching the media tab starts a fresh thread scoped to that type --
  // matches the reference screenshot's tabs, each with its own history.
  useEffect(() => { setConversationId(null); setMessages([]); setToolsOpen(false); }, [mediaType]);

  function parseTurn(content: string): UserTurn | AssistantTurn { try { return JSON.parse(content); } catch { return { text: content }; } }

  async function openConversation(id: string) {
    const res = await fetch(`/api/chat/history?conversationId=${id}`, { credentials: "include" });
    const data = await res.json();
    setConversationId(id);
    setMessages((data.messages || []).map((m: { id: string; role: "user" | "assistant"; content: string }) => ({ id: m.id, role: m.role, turn: parseTurn(m.content) })));
    setShowHistory(false);
  }
  function newConversation() { setConversationId(null); setMessages([]); setShowHistory(false); }

  function copyPrompt() { if (!prompt.trim()) return; navigator.clipboard.writeText(prompt); toast.success(tri(lang, "پرامپت کپی شد", "Prompt copied", "Prompt kopiert")); }

  function toggleVoiceInput() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast.error(tri(lang, "مرورگر شما از تشخیص صدا پشتیبانی نمی‌کند", "Your browser doesn't support voice input", "Ihr Browser unterstützt keine Spracheingabe")); return; }
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const recognition = new SR();
    recognition.lang = tri(lang, "fa-IR", "en-US", "de-DE");
    recognition.interimResults = true; recognition.continuous = false;
    recognitionRef.current = recognition;
    const base = prompt ? `${prompt} ` : "";
    let finalTranscript = "";
    recognition.onstart = () => setListening(true);
    recognition.onend = () => { setListening(false); recognitionRef.current = null; };
    recognition.onerror = () => { setListening(false); recognitionRef.current = null; };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) { const txt = e.results[i][0].transcript; if (e.results[i].isFinal) finalTranscript += txt; else interim += txt; }
      setPrompt(base + finalTranscript + interim);
    };
    recognition.start();
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const form = new FormData(); form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSourceImageUrl(data.url);
      toast.success(tri(lang, "عکس آپلود شد", "Photo uploaded", "Foto hochgeladen"));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tri(lang, "خطا در آپلود", "Upload failed", "Upload fehlgeschlagen"));
    } finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  }

  function templateText(tpl: PromptTemplate) { return !isFa && tpl.contentEn ? tpl.contentEn : tpl.content; }
  function pickTemplate(tpl: PromptTemplate) {
    setPrompt(templateText(tpl));
    if (mediaType === "image" && REFERENCE_REQUIRED_CATEGORIES.has(tpl.category)) {
      setMode("credits");
      if (!sourceImageUrl) toast(tri(lang, "این پرامپت روی عکس خودتان اعمال می‌شود — یک عکس مرجع آپلود کنید", "This prompt applies to your own photo — upload a reference photo", "Dieser Prompt wird auf Ihr eigenes Foto angewendet — laden Sie ein Referenzfoto hoch"), { icon: "📷" });
    }
    setShowTemplates(false); setToolsOpen(false);
    fetch("/api/prompts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: tpl.id }) }).catch(() => {});
  }

  async function translatePrompt() {
    if (!prompt.trim()) return;
    setTranslating(true);
    try {
      const res = await fetch("/api/image/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: prompt }) });
      const data = await res.json();
      setPrompt(data.translated || prompt);
    } catch { toast.error(tri(lang, "خطا در ترجمه", "Translation failed", "Übersetzung fehlgeschlagen")); }
    finally { setTranslating(false); }
  }

  async function ensureConversation(title: string): Promise<string> {
    if (conversationId) return conversationId;
    const res = await fetch("/api/create/chat/conversations", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ type: mediaType, title: title.slice(0, 50) }),
    });
    const data = await res.json();
    const id = data.conversation.id as string;
    setConversationId(id); loadHistoryList();
    return id;
  }
  async function saveMessage(convId: string, role: "user" | "assistant", turn: UserTurn | AssistantTurn) {
    await fetch("/api/create/chat/messages", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ conversationId: convId, role, content: JSON.stringify(turn) }),
    }).catch(() => {});
  }

  function pollVideo(predictionId: string, videoId: string, msgId: string, convId: string) {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/video/status?predictionId=${predictionId}&videoId=${videoId}`);
        const data = await res.json();
        if (data.status === "succeeded") {
          clearInterval(interval);
          const t: AssistantTurn = { videoUrl: data.output };
          setMessages((m) => m.map((msg) => (msg.id === msgId ? { ...msg, turn: t } : msg)));
          saveMessage(convId, "assistant", t); loadHistoryList();
        } else if (data.status === "failed") {
          clearInterval(interval);
          const t: AssistantTurn = { error: tri(lang, "تولید ویدیو ناموفق بود", "Video generation failed", "Videogenerierung fehlgeschlagen") };
          setMessages((m) => m.map((msg) => (msg.id === msgId ? { ...msg, turn: t } : msg)));
          saveMessage(convId, "assistant", t);
        }
      } catch { /* keep polling */ }
    }, 6000);
  }
  function pollMusic(predictionId: string, musicId: string, msgId: string, convId: string) {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/music/status?predictionId=${predictionId}&musicId=${musicId}`);
        const data = await res.json();
        if (data.status === "succeeded") {
          clearInterval(interval);
          const t: AssistantTurn = { audioUrl: data.output };
          setMessages((m) => m.map((msg) => (msg.id === msgId ? { ...msg, turn: t } : msg)));
          saveMessage(convId, "assistant", t); loadHistoryList();
        } else if (data.status === "failed") {
          clearInterval(interval);
          const t: AssistantTurn = { error: tri(lang, "تولید موزیک ناموفق بود", "Music generation failed", "Musikgenerierung fehlgeschlagen") };
          setMessages((m) => m.map((msg) => (msg.id === msgId ? { ...msg, turn: t } : msg)));
          saveMessage(convId, "assistant", t);
        }
      } catch { /* keep polling */ }
    }, 6000);
  }

  async function send() {
    if (!prompt.trim()) return;
    if (mediaType === "image" && mode === "puter" && !window.puter) { toast.error(tri(lang, "اتصال به Puter برقرار نشد", "Could not connect to Puter", "Verbindung zu Puter fehlgeschlagen")); return; }

    const settings = mediaType === "image" ? { style: imageStyle, ratio: imageRatio, quality: imageQuality, count: imageCount }
      : mediaType === "video" ? { style: videoStyle, duration: videoDuration, ratio: videoRatio }
      : { genre: musicGenre, duration: musicDuration };
    const userTurn: UserTurn = { text: prompt, sourceImageUrl: mediaType !== "music" ? sourceImageUrl : undefined, settings };
    const localUserId = `local-${Date.now()}`;
    const localAssistantId = `local-a-${Date.now()}`;
    setMessages((m) => [...m, { id: localUserId, role: "user", turn: userTurn }, { id: localAssistantId, role: "assistant", turn: { pending: true } }]);
    setSending(true);
    const sentPrompt = prompt;
    setPrompt("");

    try {
      const convId = await ensureConversation(sentPrompt);
      saveMessage(convId, "user", userTurn);

      if (mediaType === "image") {
        let images: string[] = [];
        if (mode === "puter") {
          const styledPrompt = imageStyle && imageStyle !== "realistic" ? `${sentPrompt}, ${imageStyle} style` : sentPrompt;
          images = await Promise.all(Array.from({ length: imageCount }, () => window.puter!.ai.txt2img(styledPrompt, { model: "gpt-image-1-mini" }).then((img) => img.src)));
        } else {
          const res = await fetch("/api/image/generate", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: sentPrompt, style: imageStyle, ratio: imageRatio, quality: imageQuality, count: imageCount, sourceImageUrl, provider: imageProvider }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          images = (data.images || []).map((img: { url: string }) => img.url);
        }
        const t: AssistantTurn = { images };
        setMessages((m) => m.map((msg) => (msg.id === localAssistantId ? { ...msg, turn: t } : msg)));
        saveMessage(convId, "assistant", t); loadHistoryList();
      } else if (mediaType === "video") {
        const res = await fetch("/api/video/generate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: sentPrompt, style: videoStyle, duration: videoDuration, ratio: videoRatio, sourceImageUrl, provider: videoProvider }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setMessages((m) => m.map((msg) => (msg.id === localAssistantId ? { ...msg, turn: { pending: true, pendingLabel: tri(lang, "در حال پردازش ویدیو... (۲ تا ۵ دقیقه)", "Processing video... (2-5 min)", "Video wird verarbeitet... (2-5 Min)") } } : msg)));
        pollVideo(data.predictionId, data.videoId, localAssistantId, convId);
      } else {
        const res = await fetch("/api/music/generate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: sentPrompt, genre: musicGenre, duration: musicDuration }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (data.status === "succeeded" && data.output) {
          const t: AssistantTurn = { audioUrl: data.output };
          setMessages((m) => m.map((msg) => (msg.id === localAssistantId ? { ...msg, turn: t } : msg)));
          saveMessage(convId, "assistant", t); loadHistoryList();
        } else {
          setMessages((m) => m.map((msg) => (msg.id === localAssistantId ? { ...msg, turn: { pending: true, pendingLabel: tri(lang, "در حال ساخت موزیک...", "Generating music...", "Musik wird erstellt...") } } : msg)));
          pollMusic(data.predictionId, data.musicId, localAssistantId, convId);
        }
      }
    } catch (err: unknown) {
      const errorTurn: AssistantTurn = { error: err instanceof Error ? err.message : tri(lang, "خطا در تولید", "Generation failed", "Generierung fehlgeschlagen") };
      setMessages((m) => m.map((msg) => (msg.id === localAssistantId ? { ...msg, turn: errorTurn } : msg)));
      if (conversationId) saveMessage(conversationId, "assistant", errorTurn);
    } finally { setSending(false); }
  }

  const previewCategories = mediaType === "image" ? IMAGE_CATEGORIES.filter((c) => c.id === "all" || templates.some((t) => t.category === c.id && !!t.thumbnailUrl)) : [];
  const previewTemplates = mediaType === "image" ? templates.filter((t) => !!t.thumbnailUrl && (activeCategory === "all" || t.category === activeCategory)).slice(0, 10) : [];

  return (
    <div
      className={fullscreen ? "fixed inset-0 z-[200] flex flex-col p-4" : "flex flex-col"}
      style={{ background: fullscreen ? "var(--surface-0)" : "transparent", height: fullscreen ? "100vh" : "min(78vh, 820px)" }}
      dir={isFa ? "rtl" : "ltr"}
    >
      <Script src="https://js.puter.com/v2/" strategy="afterInteractive" onReady={() => setPuterReady(true)} />

      {/* Media type tabs -- image/video/music share this one composer instead
          of three separate sidebar pages (matches the reference screenshot). */}
      <div className="flex items-center gap-2 pb-3 flex-shrink-0 overflow-x-auto">
        {(Object.keys(TYPE_META) as MediaType[]).map((mt) => {
          const meta = TYPE_META[mt];
          return (
            <button key={mt} onClick={() => setMediaType(mt)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium flex-shrink-0"
              style={{ background: mediaType === mt ? "var(--primary)" : "var(--surface-2)", color: mediaType === mt ? "white" : "var(--text-secondary)" }}>
              <meta.icon className="w-4 h-4" />
              {lang === "fa" ? meta.labelFa : lang === "de" ? meta.labelDe : meta.labelEn}
            </button>
          );
        })}
        {mediaType === "image" && (
          <Link href="/image/generate?tab=character"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium flex-shrink-0"
            style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
            <UserSquare2 className="w-4 h-4" />
            {tri(lang, "ساخت کاراکتر", "Character Creation", "Charaktererstellung")}
          </Link>
        )}
      </div>

      {/* Top bar -- the "chat" tab renders its own <ChatInterface>, which
          already has its own history/new-chat UI, so those buttons here
          would just be confusing duplicates for that tab. */}
      <div className="flex items-center justify-between gap-2 pb-3 flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-2">
          {mediaType !== "chat" && (
            <>
              <button onClick={() => setShowHistory((v) => !v)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                {showHistory ? <PanelRightClose className="w-3.5 h-3.5" /> : <History className="w-3.5 h-3.5" />}
                {tri(lang, "تاریخچه", "History", "Verlauf")}
              </button>
              <button onClick={newConversation} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                <RotateCcw className="w-3.5 h-3.5" /> {tri(lang, "گفتگوی جدید", "New chat", "Neuer Chat")}
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {mediaType === "image" && (
            <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <button onClick={() => setMode("credits")} className="px-3 py-1.5 text-xs font-medium flex items-center gap-1" style={{ background: mode === "credits" ? "var(--primary)" : "var(--surface-1)", color: mode === "credits" ? "white" : "var(--text-secondary)" }}>
                <Coins className="w-3.5 h-3.5" /> {tri(lang, "اعتبار", "Credits", "Guthaben")}
              </button>
              <button onClick={() => setMode("puter")} className="px-3 py-1.5 text-xs font-medium flex items-center gap-1" style={{ background: mode === "puter" ? "var(--primary)" : "var(--surface-1)", color: mode === "puter" ? "white" : "var(--text-secondary)" }}>
                <Gift className="w-3.5 h-3.5" /> {tri(lang, "رایگان", "Free", "Kostenlos")}
              </button>
            </div>
          )}
          <button onClick={() => setFullscreen((v) => !v)} className="p-1.5 rounded-xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {mediaType === "chat" ? (
        // The reference site's "همه"/"All" tab is a general assistant, not
        // another media-generation mode -- reusing the existing, fully
        // self-contained chat UI here instead of re-building a second one.
        <div className="flex-1 min-h-0 rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <ChatInterface />
        </div>
      ) : (
      <>
      <div className="flex-1 flex gap-4 min-h-0">
        {showHistory && (
          <div className="w-56 flex-shrink-0 rounded-2xl p-3 overflow-y-auto" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-medium mb-2 px-1" style={{ color: "var(--text-muted)" }}>{tri(lang, "گفتگوهای قبلی", "Past chats", "Frühere Chats")}</p>
            {history.length === 0 ? (
              <p className="text-xs px-1" style={{ color: "var(--text-muted)" }}>{tri(lang, "هنوز گفتگویی نیست", "No chats yet", "Noch keine Chats")}</p>
            ) : (
              <div className="space-y-1">
                {history.map((h) => (
                  <button key={h.id} onClick={() => openConversation(h.id)} className="w-full text-start px-2.5 py-2 rounded-lg text-xs truncate"
                    style={{ background: h.id === conversationId ? "var(--primary)" : "transparent", color: h.id === conversationId ? "white" : "var(--text-secondary)" }}>
                    {h.title || tri(lang, "بدون عنوان", "Untitled", "Unbenannt")}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-2xl p-4 space-y-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 py-10">
              {mediaType === "image" ? <ImageIcon className="w-10 h-10 opacity-20" style={{ color: "var(--text-muted)" }} /> : mediaType === "video" ? <Video className="w-10 h-10 opacity-20" style={{ color: "var(--text-muted)" }} /> : <Music className="w-10 h-10 opacity-20" style={{ color: "var(--text-muted)" }} />}
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {mediaType === "image" ? tri(lang, "با نوشتن یک پیام، اولین تصویرتان را بسازید", "Write a message to create your first image", "Schreiben Sie eine Nachricht für Ihr erstes Bild")
                  : mediaType === "video" ? tri(lang, "با نوشتن یک پیام، اولین ویدیوتان را بسازید", "Write a message to create your first video", "Schreiben Sie eine Nachricht für Ihr erstes Video")
                  : tri(lang, "با نوشتن یک پیام، اولین موزیکتان را بسازید", "Write a message to create your first track", "Schreiben Sie eine Nachricht für Ihren ersten Track")}
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "user" ? (
                  <div className="max-w-[80%] rounded-2xl rounded-tl-md px-4 py-2.5" style={{ background: "var(--primary)", color: "white" }}>
                    <p className="text-sm whitespace-pre-wrap">{(msg.turn as UserTurn).text}</p>
                    {(msg.turn as UserTurn).sourceImageUrl && <img src={(msg.turn as UserTurn).sourceImageUrl!} alt="ref" className="w-16 h-16 object-cover rounded-lg mt-2 opacity-90" />}
                  </div>
                ) : (
                  <div className="max-w-[85%] rounded-2xl rounded-tr-md px-4 py-3" style={{ background: "var(--surface-2)" }}>
                    {(msg.turn as AssistantTurn).pending ? (
                      <div className="flex items-center gap-2 py-2">
                        <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--primary)" }} />
                        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{(msg.turn as AssistantTurn).pendingLabel || tri(lang, "در حال ساخت...", "Generating...", "Wird erstellt...")}</span>
                      </div>
                    ) : (msg.turn as AssistantTurn).error ? (
                      <p className="text-sm" style={{ color: "#ef4444" }}>{(msg.turn as AssistantTurn).error}</p>
                    ) : (msg.turn as AssistantTurn).images ? (
                      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min((msg.turn as AssistantTurn).images?.length || 1, 2)}, 1fr)` }}>
                        {(msg.turn as AssistantTurn).images?.map((url, i) => (
                          <div key={i} className="relative group rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                            <img src={url} alt={`${i + 1}`} className="w-full h-auto max-w-[220px]" />
                            <a href={url} download className="absolute bottom-1.5 right-1.5 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(0,0,0,0.6)" }}><Download className="w-3.5 h-3.5 text-white" /></a>
                          </div>
                        ))}
                      </div>
                    ) : (msg.turn as AssistantTurn).videoUrl ? (
                      <div className="rounded-xl overflow-hidden max-w-[280px]" style={{ border: "1px solid var(--border)" }}>
                        {(msg.turn as AssistantTurn).videoUrl!.includes("placehold.co") ? (
                          <img src={(msg.turn as AssistantTurn).videoUrl} alt="preview" className="w-full" />
                        ) : (
                          <video src={(msg.turn as AssistantTurn).videoUrl} controls className="w-full" />
                        )}
                        <a href={(msg.turn as AssistantTurn).videoUrl} download className="flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium" style={{ background: "var(--surface-1)", color: "var(--text-secondary)" }}><Download className="w-3 h-3" />{tri(lang, "دانلود", "Download", "Herunterladen")}</a>
                      </div>
                    ) : (msg.turn as AssistantTurn).audioUrl ? (
                      <div className="rounded-xl p-3 min-w-[220px]" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                        <button onClick={() => { const el = document.getElementById(`audio-${msg.id}`) as HTMLAudioElement; if (!el) return; if (playingId === msg.id) { el.pause(); setPlayingId(null); } else { el.play(); setPlayingId(msg.id); } }}
                          className="w-9 h-9 rounded-full flex items-center justify-center mb-2" style={{ background: "var(--primary)" }}>
                          {playingId === msg.id ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
                        </button>
                        {!(msg.turn as AssistantTurn).audioUrl!.includes("placehold.co") && (
                          <audio id={`audio-${msg.id}`} src={(msg.turn as AssistantTurn).audioUrl} onEnded={() => setPlayingId(null)} />
                        )}
                        <a href={(msg.turn as AssistantTurn).audioUrl} download className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}><Download className="w-3 h-3" />{tri(lang, "دانلود MP3", "Download MP3", "MP3 herunterladen")}</a>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {mediaType === "image" && previewTemplates.length > 0 && messages.length === 0 && (
        <div className="mt-3 flex-shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5">
            {previewCategories.map((cat) => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0"
                style={{ background: activeCategory === cat.id ? "var(--primary)" : "var(--surface-1)", color: activeCategory === cat.id ? "white" : "var(--text-secondary)" }}>
                <cat.icon className="w-3.5 h-3.5" />
                {lang === "fa" ? cat.fa : lang === "de" ? cat.de || cat.en : cat.en}
              </button>
            ))}
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1 mt-1.5">
            {previewTemplates.map((tpl) => {
              const displayTitle = !isFa && tpl.titleEn ? tpl.titleEn : tpl.title;
              return (
                <button key={tpl.id} onClick={() => pickTemplate(tpl)} className="relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  <img src={tpl.thumbnailUrl!} alt={displayTitle} className="w-full h-full object-cover" />
                  {REFERENCE_REQUIRED_CATEGORIES.has(tpl.category) && <span className="absolute top-1 right-1 p-0.5 rounded-full" style={{ background: "rgba(0,0,0,0.55)" }}><Camera className="w-2.5 h-2.5 text-white" /></span>}
                  <div className="absolute inset-x-0 bottom-0 px-1 py-0.5 text-[9px] font-medium text-white truncate" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.85))" }}>{tri(lang, "امتحان کن", "Try it", "Testen")}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="mt-3 rounded-2xl p-3 flex-shrink-0" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        {sourceImageUrl && mediaType !== "music" && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="relative">
              <img src={sourceImageUrl} alt="reference" className="w-10 h-10 object-cover rounded-lg" style={{ border: "1px solid var(--border)" }} />
              <button onClick={() => setSourceImageUrl(null)} className="absolute -top-1.5 -left-1.5 p-0.5 rounded-full bg-black/70 text-white"><X className="w-3 h-3" /></button>
            </div>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{tri(lang, "عکس مرجع پیوست شد", "Reference photo attached", "Referenzfoto angehängt")}</span>
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="relative">
            <button onClick={() => setToolsOpen((v) => !v)} className="p-2.5 rounded-xl flex-shrink-0" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
              <Plus className={`w-5 h-5 transition-transform ${toolsOpen ? "rotate-45" : ""}`} />
            </button>
            {toolsOpen && (
              <div className="absolute bottom-full mb-2 w-72 rounded-2xl p-3 space-y-3 z-20 max-h-[70vh] overflow-y-auto" style={{ background: "var(--surface-0)", border: "1px solid var(--border)", boxShadow: "0 8px 32px rgba(0,0,0,0.35)" }}>
                {mediaType !== "music" && (
                  <button onClick={() => fileInputRef.current?.click()} disabled={(mediaType === "image" && mode !== "credits") || uploading}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium disabled:opacity-40" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {tri(lang, "آپلود عکس مرجع", "Upload reference photo", "Referenzfoto hochladen")}
                  </button>
                )}
                {mediaType !== "music" && (
                  <button onClick={() => { setShowTemplates(true); setToolsOpen(false); }} className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>
                    <span className="flex items-center gap-2"><Sparkles className="w-4 h-4" style={{ color: "var(--primary)" }} />{tri(lang, "پرامپت‌های آماده", "Ready prompts", "Fertige Prompts")}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--surface-1)", color: "var(--text-muted)" }}>{templates.length}</span>
                  </button>
                )}

                {mediaType === "image" && (
                  <>
                    {mode === "credits" && imageProviders.length > 0 && (
                      <div>
                        <p className="text-[10px] mb-1 px-1" style={{ color: "var(--text-muted)" }}>{tri(lang, "مدل تصویر", "Image model", "Bildmodell")}</p>
                        <select value={imageProvider} onChange={(e) => setImageProvider(e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                          {imageProviders.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] mb-1 px-1" style={{ color: "var(--text-muted)" }}>{tri(lang, "سبک", "Style", "Stil")}</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {IMAGE_STYLES.map((st) => (
                          <button key={st} onClick={() => setImageStyle(st)} className="py-1.5 rounded-lg text-[11px] font-medium" style={{ background: imageStyle === st ? "var(--primary)" : "var(--surface-2)", color: imageStyle === st ? "white" : "var(--text-secondary)" }}>{IMAGE_STYLE_LABEL[st][lang]}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] mb-1 px-1" style={{ color: "var(--text-muted)" }}>{tri(lang, "نسبت ابعاد", "Aspect ratio", "Seitenverhältnis")}</p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {RATIOS.map((r) => <button key={r} onClick={() => setImageRatio(r)} className="py-1.5 rounded-lg text-[11px] font-medium" style={{ background: imageRatio === r ? "var(--primary)" : "var(--surface-2)", color: imageRatio === r ? "white" : "var(--text-secondary)" }}>{r}</button>)}
                      </div>
                    </div>
                    {mode === "credits" && (
                      <div>
                        <p className="text-[10px] mb-1 px-1" style={{ color: "var(--text-muted)" }}>{tri(lang, "کیفیت", "Quality", "Qualität")}</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(["standard", "hd"] as const).map((q) => (
                            <button key={q} onClick={() => setImageQuality(q)} className="py-1.5 rounded-lg text-[11px] font-medium" style={{ background: imageQuality === q ? "var(--primary)" : "var(--surface-2)", color: imageQuality === q ? "white" : "var(--text-secondary)" }}>
                              {q === "standard" ? tri(lang, "استاندارد (۵)", "Standard (5)", "Standard (5)") : tri(lang, "HD (۱۰)", "HD (10)", "HD (10)")}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] mb-1 px-1" style={{ color: "var(--text-muted)" }}>{tri(lang, "تعداد", "Count", "Anzahl")}: {imageCount}</p>
                      <input type="range" min={1} max={4} value={imageCount} onChange={(e) => setImageCount(parseInt(e.target.value))} className="w-full accent-orange-600" />
                    </div>
                  </>
                )}

                {mediaType === "video" && (
                  <>
                    {videoProviders.length > 0 && (
                      <div>
                        <p className="text-[10px] mb-1 px-1" style={{ color: "var(--text-muted)" }}>{tri(lang, "مدل ویدیو", "Video model", "Videomodell")}</p>
                        <select value={videoProvider} onChange={(e) => setVideoProvider(e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                          {videoProviders.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] mb-1 px-1" style={{ color: "var(--text-muted)" }}>{tri(lang, "سبک", "Style", "Stil")}</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {VIDEO_STYLES.map((st) => <button key={st.value} onClick={() => setVideoStyle(st.value)} className="py-1.5 rounded-lg text-[11px] font-medium" style={{ background: videoStyle === st.value ? "var(--primary)" : "var(--surface-2)", color: videoStyle === st.value ? "white" : "var(--text-secondary)" }}>{lang === "fa" ? st.fa : lang === "de" ? st.de : st.en}</button>)}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] mb-1 px-1" style={{ color: "var(--text-muted)" }}>{tri(lang, "مدت", "Duration", "Dauer")}</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {VIDEO_DURATIONS.map((d) => <button key={d.value} onClick={() => setVideoDuration(d.value)} className="py-1.5 rounded-lg text-[10px] font-medium" style={{ background: videoDuration === d.value ? "var(--primary)" : "var(--surface-2)", color: videoDuration === d.value ? "white" : "var(--text-secondary)" }}>{d.value}s · {d.credits}</button>)}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] mb-1 px-1" style={{ color: "var(--text-muted)" }}>{tri(lang, "نسبت تصویر", "Aspect ratio", "Seitenverhältnis")}</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {VIDEO_RATIOS.map((r) => <button key={r} onClick={() => setVideoRatio(r)} className="py-1.5 rounded-lg text-[11px] font-medium" style={{ background: videoRatio === r ? "var(--primary)" : "var(--surface-2)", color: videoRatio === r ? "white" : "var(--text-secondary)" }}>{r}</button>)}
                      </div>
                    </div>
                  </>
                )}

                {mediaType === "music" && (
                  <>
                    <div>
                      <p className="text-[10px] mb-1 px-1" style={{ color: "var(--text-muted)" }}>{tri(lang, "ژانر", "Genre", "Genre")}</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {MUSIC_GENRES.map((g) => <button key={g} onClick={() => setMusicGenre(g)} className="py-1.5 rounded-lg text-[11px] font-medium" style={{ background: musicGenre === g ? "var(--primary)" : "var(--surface-2)", color: musicGenre === g ? "white" : "var(--text-secondary)" }}>{g}</button>)}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] mb-1 px-1" style={{ color: "var(--text-muted)" }}>{tri(lang, "مدت", "Duration", "Dauer")}</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {MUSIC_DURATIONS.map((d) => <button key={d.value} onClick={() => setMusicDuration(d.value)} className="py-1.5 rounded-lg text-[10px] font-medium" style={{ background: musicDuration === d.value ? "var(--primary)" : "var(--surface-2)", color: musicDuration === d.value ? "white" : "var(--text-secondary)" }}>{d.value}s · {d.credits}</button>)}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUpload} className="hidden" />

          <button onClick={copyPrompt} disabled={!prompt.trim()} className="p-2.5 rounded-xl disabled:opacity-30 flex-shrink-0" style={{ color: "var(--text-muted)" }} title={tri(lang, "کپی", "Copy", "Kopieren")}><Copy className="w-4 h-4" /></button>
          <button onClick={toggleVoiceInput} className="p-2.5 rounded-xl flex-shrink-0" style={{ color: listening ? "var(--primary)" : "var(--text-muted)", background: listening ? "rgba(234,88,12,0.12)" : "transparent" }} title={tri(lang, "ورودی صوتی", "Voice input", "Spracheingabe")}>
            {listening ? <MicOff className="w-4 h-4 animate-pulse" /> : <Mic className="w-4 h-4" />}
          </button>

          <textarea
            value={prompt} onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={mediaType === "image" ? tri(lang, "چه تصویری بسازم؟ توصیف کنید...", "What image should I create?", "Welches Bild soll ich erstellen?")
              : mediaType === "video" ? tri(lang, "چه ویدیویی بسازم؟ توصیف کنید...", "What video should I create?", "Welches Video soll ich erstellen?")
              : tri(lang, "چه موزیکی بسازم؟ توصیف کنید...", "What music should I create?", "Welche Musik soll ich erstellen?")}
            rows={1} className="flex-1 text-sm rounded-xl px-3 py-2.5 resize-none outline-none max-h-28"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          />
          {mediaType === "image" && (
            <button onClick={translatePrompt} disabled={translating || !prompt.trim()} className="p-2.5 rounded-xl disabled:opacity-30 flex-shrink-0" style={{ color: "var(--text-muted)" }} title={tri(lang, "ترجمه", "Translate", "Übersetzen")}>
              {translating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />} <CreditCost feature="image.translate" />
            </button>
          )}
          <button onClick={send} disabled={sending || !prompt.trim() || (mediaType === "image" && mode === "puter" && !puterReady)} className="p-2.5 rounded-xl text-white disabled:opacity-50 flex-shrink-0" style={{ background: "var(--primary)" }}>
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />} {!(mediaType === "image" && mode === "puter") && <CreditCost className="text-white" costKey={mediaType === "image" ? (imageQuality === "hd" ? "image_hd" : "image_standard") : mediaType === "video" ? (videoDuration <= 5 ? "video_5s" : videoDuration <= 10 ? "video_10s" : "video_30s") : (musicDuration <= 30 ? "music_30s" : musicDuration <= 60 ? "music_60s" : "music_120s")} times={mediaType === "image" ? imageCount : 1} />}
          </button>
        </div>
      </div>
      </>
      )}

      {showTemplates && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowTemplates(false)}>
          <div className="w-full max-w-4xl max-h-[85vh] rounded-2xl overflow-hidden flex flex-col" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="text-base font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}><Sparkles className="w-4 h-4" style={{ color: "var(--primary)" }} />{tri(lang, "گالری پرامپت‌های آماده", "Prompt Gallery", "Prompt-Galerie")}</h2>
              <button onClick={() => setShowTemplates(false)} className="p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }}><X className="w-5 h-5" /></button>
            </div>
            {mediaType === "image" && (
              <div className="flex items-center gap-2 px-5 py-3 overflow-x-auto flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
                {IMAGE_CATEGORIES.map((cat) => (
                  <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex-shrink-0"
                    style={{ background: activeCategory === cat.id ? "var(--primary)" : "var(--surface-1)", color: activeCategory === cat.id ? "white" : "var(--text-secondary)", border: `1px solid ${activeCategory === cat.id ? "var(--primary)" : "var(--border)"}` }}>
                    <cat.icon className="w-3.5 h-3.5" />{lang === "fa" ? cat.fa : lang === "de" ? cat.de || cat.en : cat.en}
                  </button>
                ))}
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-5">
              {templates.length === 0 ? (
                <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>{tri(lang, "هنوز پرامپتی اضافه نشده", "No prompts added yet", "Noch keine Prompts hinzugefügt")}</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.filter((tpl) => mediaType !== "image" || activeCategory === "all" || tpl.category === activeCategory).map((tpl) => {
                    const cat = IMAGE_CATEGORIES.find((c) => c.id === tpl.category) || IMAGE_CATEGORIES[0];
                    const displayTitle = !isFa && tpl.titleEn ? tpl.titleEn : tpl.title;
                    return (
                      <div key={tpl.id} className="rounded-2xl overflow-hidden flex flex-col transition-all hover:-translate-y-0.5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                        {tpl.thumbnailUrl ? <img src={tpl.thumbnailUrl} alt={displayTitle} className="w-full h-32 object-cover" /> : <div className="w-full h-24 flex items-center justify-center" style={{ background: cat.gradient }}><cat.icon className="w-8 h-8 text-white opacity-90" /></div>}
                        <div className="p-3.5 flex flex-col gap-2 flex-1">
                          <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{displayTitle}</div>
                          <p className="text-xs leading-5 line-clamp-3 flex-1" style={{ color: "var(--text-secondary)" }}>{templateText(tpl)}</p>
                          <button onClick={() => pickTemplate(tpl)} className="py-1.5 rounded-lg text-xs font-semibold text-white transition-all" style={{ background: "var(--primary)" }}>{tri(lang, "امتحان کن", "Try it", "Ausprobieren")}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
