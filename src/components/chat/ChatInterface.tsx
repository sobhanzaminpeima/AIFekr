"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import {
  Send, Square, Paperclip, RotateCcw, Copy, ThumbsUp, ThumbsDown,
  User, Sparkles, Mic, MicOff, Volume2, VolumeX,
  ChevronDown, ChevronUp, Briefcase, TrendingUp, DollarSign, ShoppingCart,
  Rocket, Scale, Users, Search, Check, FileText, FileDown, Hash, Zap,
  Image as ImageIcon, Video, Music, MessageSquare, Loader2, Download,
  Play, Pause, Upload, X, Languages, UserSquare2, Coins, Gift, Database,
} from "lucide-react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import toast from "react-hot-toast";
import { useTranslation, tri, type Lang } from "@/lib/i18n";
import { OPEN_COMMAND_PALETTE_EVENT } from "@/components/ui/CommandPalette";
import { maxReferenceImages } from "@/lib/constants/imageUploadLimits";
import { downscaleImage } from "@/lib/image/downscaleImage";
import OrchestratorActionCard, { type OrchestratorAction } from "@/components/chat/OrchestratorActionCard";
import { useCreditCosts } from "@/components/ui/CreditCost";

interface PromptBoxData {
  name: string;
  type: string;
  targetAI: string;
  language: string;
  category: string;
  content: string;
}

/** A generated-media turn (image/video/music), rendered in place of markdown. */
interface MediaTurn {
  images?: string[];
  videoUrl?: string;
  audioUrl?: string;
  error?: string;
  pending?: boolean;
  pendingLabel?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  displayContent: string;
  suggestions: string[];
  promptBox: PromptBoxData | null;
  timestamp: Date;
  /** Set on assistant turns produced by the image/video/music tabs. */
  media?: MediaTurn;
  /** Reference photo(s) attached to a user turn (e.g. two people for a "couple" prompt). */
  attachments?: string[];
  /** COMMIT actions the orchestrator staged for this answer — each renders a confirmation card. */
  actions?: OrchestratorAction[];
  /** Registry capability keys whose real data backed this answer, for the "based on your own data" label. */
  dataSources?: string[];
}

/**
 * The "where these figures came from" label. Capability keys are mapped to the
 * user's own words rather than shown raw, and several sources collapse into one
 * phrase so the line stays a quiet footnote instead of a list.
 */
function dataSourceLabel(capabilityKeys: string[], lang: Lang): string {
  const names: Record<string, [string, string, string]> = {
    crm: ["CRM شما", "your CRM", "Ihrem CRM"],
    accounting: ["حسابداری شما", "your accounting", "Ihrer Buchhaltung"],
    social: ["شبکه‌های اجتماعی شما", "your social media", "Ihren Social-Media-Daten"],
    ceo: ["داده‌های کل کسب‌وکار شما", "your whole-business data", "Ihren gesamten Unternehmensdaten"],
  };

  const labels = capabilityKeys
    .map((k) => names[k])
    .filter(Boolean)
    .map((triple) => tri(lang, triple[0], triple[1], triple[2]));

  if (labels.length === 0) return tri(lang, "داده‌های واقعی شما", "your own real data", "Ihren echten Daten", "kendi gerçek verileriniz");

  const joined =
    labels.length === 1
      ? labels[0]
      : labels.slice(0, -1).join(tri(lang, "، ", ", ", ", ", ", ")) + tri(lang, " و ", " and ", " und ", " ve ") + labels[labels.length - 1];

  return tri(lang, `بر اساس ${joined}`, `Based on ${joined}`, `Basierend auf ${joined}`, `${joined} temel alınarak`);
}

const EXPERT_MODES = [
  { id: "default",   labelFa: "دستیار هوشمند",     labelEn: "Smart Assistant", labelDe: "Intelligenter Assistent", icon: Sparkles,     color: "#ea580c" },
  { id: "business",  labelFa: "دکتر کسب‌وکار",     labelEn: "Business Doctor", labelDe: "Geschäftsberater", icon: Briefcase,    color: "#3b82f6" },
  { id: "marketing", labelFa: "بازاریابی",          labelEn: "Marketing",       labelDe: "Marketing", icon: TrendingUp,   color: "#10b981" },
  { id: "financial", labelFa: "مالی و سرمایه",      labelEn: "Financial",       labelDe: "Finanzen", icon: DollarSign,   color: "#f59e0b" },
  { id: "sales",     labelFa: "فروش",               labelEn: "Sales",           labelDe: "Vertrieb", icon: ShoppingCart, color: "#8b5cf6" },
  { id: "startup",   labelFa: "استارتاپ",           labelEn: "Startup",         labelDe: "Startup", icon: Rocket,       color: "#ef4444" },
  { id: "legal",     labelFa: "حقوقی",              labelEn: "Legal",           labelDe: "Recht", icon: Scale,        color: "#06b6d4" },
  { id: "hr",        labelFa: "منابع انسانی",       labelEn: "HR & People",     labelDe: "HR & Personal", icon: Users,        color: "#d97706" },
];

const MODEL_IDS = [
  { id: "auto", key: "auto" as const, plan: "FREE" },
];

interface ChatProvider {
  id: string;
  name: string;
  model: string;
  /** Credits one message costs on this model (shown next to the name). */
  creditCost?: number;
}

// ── Media generation ────────────────────────────────────────────────────────
// Image/video/music used to live on a separate "Creative Studio" page, which
// meant a second composer, a second history panel and a second chat thread
// duplicating what this component already does. They are tabs on this
// composer now: one thread, one history, one set of controls.

type MediaType = "chat" | "image" | "video" | "music";

/** Fired by Sidebar's history list to switch conversations without a full
 *  Next.js navigation -- see the listener in ChatInterface for why. */
export const OPEN_CONVERSATION_EVENT = "aifekr:open-conversation";

const MEDIA_TABS: { id: MediaType; icon: typeof ImageIcon; fa: string; en: string; de: string }[] = [
  { id: "chat",  icon: MessageSquare, fa: "همه",   en: "All",   de: "Alle" },
  { id: "image", icon: ImageIcon,     fa: "عکس",   en: "Image", de: "Bild" },
  { id: "video", icon: Video,         fa: "ویدیو", en: "Video", de: "Video" },
  { id: "music", icon: Music,         fa: "موزیک", en: "Music", de: "Musik" },
];

const RATIOS = ["1:1", "16:9", "9:16", "4:3"];
const RATIO_LABEL: Record<string, Record<Lang, string>> = {
  "1:1":  { fa: "مربع", en: "Square", de: "Quadrat", tr: "Square" },
  "16:9": { fa: "افقی", en: "Landscape", de: "Querformat", tr: "Landscape" },
  "9:16": { fa: "عمودی", en: "Portrait", de: "Hochformat", tr: "Portrait" },
  "4:3":  { fa: "کلاسیک", en: "Classic", de: "Klassisch", tr: "Classic" },
};
const IMAGE_STYLES = ["realistic", "anime", "painting", "minimal", "fantasy", "3d"];
const IMAGE_STYLE_LABEL: Record<string, Record<Lang, string>> = {
  realistic: { fa: "واقعی", en: "Realistic", de: "Realistisch", tr: "Realistic" },
  anime: { fa: "انیمه", en: "Anime", de: "Anime", tr: "Anime" },
  painting: { fa: "نقاشی", en: "Painting", de: "Gemälde", tr: "Painting" },
  minimal: { fa: "مینیمال", en: "Minimal", de: "Minimalistisch", tr: "Minimal" },
  fantasy: { fa: "فانتزی", en: "Fantasy", de: "Fantasy", tr: "Fantasy" },
  "3d": { fa: "سه‌بعدی", en: "3D", de: "3D", tr: "3D" },
};

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
  id: string; title: string; titleEn: string | null; titleDe?: string | null; content: string; contentEn: string | null; contentDe?: string | null; category: string; thumbnailUrl: string | null;
  guideFa: string | null; guideEn: string | null; guideDe?: string | null;
}
const IMAGE_CATEGORIES = [
  { id: "all", fa: "همه", en: "All", de: "Alle" },
  { id: "portrait", fa: "پرتره", en: "Portrait", de: "Porträt" },
  { id: "product", fa: "محصول", en: "Product", de: "Produkt" },
  { id: "landscape", fa: "منظره و طبیعت", en: "Landscape", de: "Landschaft" },
  { id: "art", fa: "هنری و نقاشی", en: "Art", de: "Kunst" },
  { id: "corporate", fa: "کسب‌وکار", en: "Corporate", de: "Unternehmen" },
  { id: "fantasy", fa: "فانتزی و سینمایی", en: "Fantasy", de: "Fantasie" },
  { id: "1980s", fa: "دهه ۸۰ میلادی", en: "1980s", de: "1980er" },
];
const REFERENCE_REQUIRED_CATEGORIES = new Set(["1980s"]);

declare global {
  interface Window {
    puter?: { ai: { chat: (p: string, o?: { model?: string }) => Promise<string>; txt2img: (p: string, o?: { model?: string }) => Promise<HTMLImageElement> } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition: new () => any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition: new () => any;
  }
}

function parseSuggestions(rawContent: string): { displayContent: string; suggestions: string[]; promptBox: PromptBoxData | null } {
  let content = rawContent;
  let suggestions: string[] = [];
  let promptBox: PromptBoxData | null = null;

  const sMatch = content.match(/<SUGGESTIONS>([\s\S]*?)<\/SUGGESTIONS>/);
  if (sMatch) {
    content = content.replace(/<SUGGESTIONS>[\s\S]*?<\/SUGGESTIONS>/g, "").trimEnd();
    try {
      const parsed = JSON.parse(sMatch[1]);
      suggestions = Array.isArray(parsed) ? parsed.slice(0, 5) : [];
    } catch {}
  }

  const pMatch = content.match(/<PROMPTBOX>([\s\S]*?)<\/PROMPTBOX>/);
  if (pMatch) {
    content = content.replace(/<PROMPTBOX>[\s\S]*?<\/PROMPTBOX>/g, "").trim();
    try {
      const parsed = JSON.parse(pMatch[1]);
      if (parsed && typeof parsed.content === "string") {
        promptBox = {
          name: parsed.name || "",
          type: parsed.type || "",
          targetAI: parsed.targetAI || "",
          language: parsed.language || "",
          category: parsed.category || "",
          content: parsed.content,
        };
      }
    } catch {}
  }

  return { displayContent: content, suggestions, promptBox };
}

/**
 * Media turns are persisted as JSON in the same Message.content column as
 * plain chat text. The `__media` marker is what tells them apart on reload —
 * without it, an ordinary message that happens to be valid JSON would be
 * mistaken for a generated image.
 */
function parseStoredMedia(raw: string): { text: string; media?: MediaTurn; attachments?: string[] } | null {
  try {
    const p = JSON.parse(raw);
    if (!p || typeof p !== "object" || !p.__media) return null;
    if (p.__media === "user") {
      // sourceImageUrls (plural) is the current shape; sourceImageUrl
      // (singular) is what older saved turns still have on disk.
      const attachments: string[] = Array.isArray(p.sourceImageUrls) ? p.sourceImageUrls : p.sourceImageUrl ? [p.sourceImageUrl] : [];
      return { text: typeof p.text === "string" ? p.text : "", attachments };
    }
    return { text: "", media: { images: p.images, videoUrl: p.videoUrl, audioUrl: p.audioUrl, error: p.error } };
  } catch {
    return null;
  }
}

function PromptBoxCard({ data, lang }: { data: PromptBoxData; lang: Lang }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const wordCount = data.content.trim().split(/\s+/).filter(Boolean).length;
  const tokenEstimate = Math.round(wordCount * 1.3);

  function download(ext: "txt" | "md", mime: string) {
    const filename = `${(data.name || "prompt").replace(/[^a-zA-Z0-9؀-ۿ_-]+/g, "_")}.${ext}`;
    const body = ext === "md" ? `# ${data.name}\n\n${data.content}` : data.content;
    const blob = new Blob([body], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    await navigator.clipboard.writeText(data.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const meta = [data.type, data.targetAI, data.language, data.category].filter(Boolean);

  return (
    <div className="mt-2 rounded-2xl overflow-hidden" style={{ background: "#0d0d12", border: "1px solid var(--border)" }} dir="ltr">
      <div className="px-4 pt-3 pb-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 flex-shrink-0" style={{ color: "var(--primary)" }} />
          <span className="text-sm font-semibold text-white truncate">{data.name || tri(lang, "پرامپت", "Prompt", "Prompt", "Komut")}</span>
        </div>
        {meta.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {meta.map((m, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(234,88,12,0.15)", color: "#fb923c" }}>
                {m}
              </span>
            ))}
          </div>
        )}
      </div>

      {expanded && (
        <pre
          className="px-4 py-3 text-xs leading-6 whitespace-pre-wrap break-words overflow-x-auto"
          style={{ color: "#e4e4e7", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", maxHeight: "420px", overflowY: "auto" }}
        >
          {data.content}
        </pre>
      )}

      <div className="flex items-center justify-between px-3 py-2 flex-wrap gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "#a1a1aa" }}>
          <Hash className="w-3 h-3" />
          <span>{wordCount} {tri(lang, "کلمه", "words", "Wörter", "kelime")} · ~{tokenEstimate} tokens</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setExpanded((v) => !v)} className="p-1.5 rounded-lg transition-colors" style={{ color: "#a1a1aa" }} title={expanded ? tri(lang, "بستن", "Collapse", "Schließen", "Daralt") : tri(lang, "باز کردن", "Expand", "Erweitern", "Genişlet")}>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => download("txt", "text/plain")} className="p-1.5 rounded-lg transition-colors" style={{ color: "#a1a1aa" }} title="TXT">
            <FileDown className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => download("md", "text/markdown")} className="p-1.5 rounded-lg transition-colors" style={{ color: "#a1a1aa" }} title="Markdown">
            <FileText className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={copy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: copied ? "rgba(34,197,94,0.15)" : "var(--primary)", color: copied ? "#22c55e" : "white" }}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? tri(lang, "کپی شد", "Copied", "Kopiert", "Kopyalandı") : tri(lang, "کپی", "Copy", "Kopieren", "Kopyala")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChatInterface({
  conversationId,
  systemPrompt,
  title,
}: {
  conversationId?: string;
  systemPrompt?: string;
  title?: string;
}) {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODEL_IDS[0].id);
  const [chatProviders, setChatProviders] = useState<ChatProvider[]>([]);
  // Cost per message in credits, from the same admin-editable Credit Rules the chat route charges from.
  const chatBaseCost = useCreditCosts()?.chat ?? null;
  const [currentConvId, setCurrentConvId] = useState(conversationId);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [expertMode, setExpertMode] = useState("default");
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [modeMenuPos, setModeMenuPos] = useState<{ top: number; left: number } | null>(null);
  const modeMenuBtnRef = useRef<HTMLButtonElement>(null);

  // Media tabs
  const [mediaType, setMediaType] = useState<MediaType>("chat");
  const [generating, setGenerating] = useState(false);
  const [imageStyle, setImageStyle] = useState("realistic");
  const [imageRatio, setImageRatio] = useState("1:1");
  const [imageQuality, setImageQuality] = useState<"standard" | "hd">("standard");
  const [imageCount, setImageCount] = useState(1);
  const [videoStyle, setVideoStyle] = useState(VIDEO_STYLES[0].value);
  const [videoDuration, setVideoDuration] = useState(5);
  const [videoRatio, setVideoRatio] = useState("16:9");
  const [musicGenre, setMusicGenre] = useState(MUSIC_GENRES[0]);
  const [musicDuration, setMusicDuration] = useState(30);
  const [imageProviders, setImageProviders] = useState<{ id: string; name: string }[]>([]);
  const [imageProvider, setImageProvider] = useState("");
  const [videoProviders, setVideoProviders] = useState<{ id: string; name: string }[]>([]);
  const [videoProvider, setVideoProvider] = useState("");
  const [mode, setMode] = useState<"credits" | "puter">("credits");
  const [puterReady, setPuterReady] = useState(false);
  const [sourceImages, setSourceImages] = useState<string[]>([]);
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [playingId, setPlayingId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const isRtl = lang === "fa";
  const isMedia = mediaType !== "chat";
  const currentMode = EXPERT_MODES.find((m) => m.id === expertMode) || EXPERT_MODES[0];
  const busy = streaming || generating;

  useEffect(() => {
    fetch("/api/ai/chat-providers", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setChatProviders(data.providers ?? []))
      .catch(() => {});
  }, []);

  // Drives the reference-photo upload cap ("2/2" for free, "x/7" for paid) --
  // fetched once, not passed down as a prop, since ChatInterface is mounted
  // with no props on the main /chat route.
  useEffect(() => {
    fetch("/api/user/profile", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setUserPlan(data?.user?.plan ?? null))
      .catch(() => {});
  }, []);

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

  useEffect(() => { if (typeof window !== "undefined" && window.puter) setPuterReady(true); }, []);

  useEffect(() => {
    if (mediaType === "chat" || mediaType === "music") { setTemplates([]); return; }
    fetch(`/api/prompts?toolType=${mediaType}`).then((r) => r.json()).then((d) => setTemplates(d.prompts || [])).catch(() => {});
  }, [mediaType]);

  useEffect(() => {
    // Skip on the initial empty-conversation mount — scrolling here eats the
    // scroll container's own padding-top (nothing below the sentinel to
    // reveal yet), which shoves the header flush against the viewport top
    // and collides with the floating command-palette search box.
    if (messages.length === 0) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  useEffect(() => {
    return () => { window.speechSynthesis?.cancel(); };
  }, []);

  const loadConversation = useCallback((id: string) => {
    setCurrentConvId(id);
    setMessages([]);
    fetch(`/api/chat/history?conversationId=${id}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.messages?.length) {
          const restored: Message[] = data.messages.map((m: { id: string; role: "user" | "assistant"; content: string; timestamp: string }) => {
            const stored = parseStoredMedia(m.content);
            if (stored) {
              return {
                id: m.id, role: m.role, content: stored.text, displayContent: stored.text,
                suggestions: [], promptBox: null, timestamp: new Date(m.timestamp),
                media: stored.media, attachments: stored.attachments,
              };
            }
            const { displayContent, suggestions, promptBox } = parseSuggestions(m.content);
            return { id: m.id, role: m.role, content: m.content, displayContent, suggestions, promptBox, timestamp: new Date(m.timestamp) };
          });

          // Re-attach any orchestrator action still awaiting confirmation to
          // the last assistant turn, so reloading mid-decision doesn't leave
          // the user with an answer asking them to confirm and no button to
          // do it (the action stays PENDING server-side for ten minutes).
          const pending: OrchestratorAction[] = Array.isArray(data.pendingActions) ? data.pendingActions : [];
          if (pending.length > 0) {
            for (let i = restored.length - 1; i >= 0; i--) {
              if (restored[i].role === "assistant") {
                restored[i] = { ...restored[i], actions: pending };
                break;
              }
            }
          }

          setMessages(restored);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    loadConversation(conversationId);
  }, [conversationId, loadConversation]);

  // Sidebar history clicks used to be a plain <Link href="/chat/[id]">, which
  // forces a full Next.js navigation -- and because the dashboard layout is
  // `force-dynamic`, that re-runs its user/team/conversations-list DB queries
  // on every single click, even though none of that data actually changed.
  // That round trip is what made history feel slow to open. The sidebar now
  // fires this event instead when already inside /chat, so switching
  // conversations is just a client-side fetch, same as sending a message.
  useEffect(() => {
    function onOpenConversation(e: Event) {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      if (!id) return;
      window.history.replaceState(null, "", `/chat/${id}`);
      loadConversation(id);
    }
    window.addEventListener(OPEN_CONVERSATION_EVENT, onOpenConversation);
    return () => window.removeEventListener(OPEN_CONVERSATION_EVENT, onOpenConversation);
  }, [loadConversation]);

  async function sendMessage(text: string) {
    if (!text.trim() || busy) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      displayContent: text,
      suggestions: [],
      promptBox: null,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setStreaming(true);
    setShowModeMenu(false);

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", displayContent: "", suggestions: [], promptBox: null, timestamp: new Date() },
    ]);

    abortRef.current = new AbortController();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId: currentConvId,
          model: selectedModel,
          systemPrompt,
          expertMode,
          history: messages.slice(-10).filter((m) => !m.media).map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || t.common.error);
      }

      const convId = response.headers.get("X-Conversation-Id");
      const isNewConversation = !!convId && !currentConvId;
      if (isNewConversation) {
        setCurrentConvId(convId);
        window.history.replaceState(null, "", `/chat/${convId}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error(t.common.error);

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.provider) setActiveProvider(parsed.provider);
              if (parsed.reset) {
                accumulated = "";
                setMessages((prev) =>
                  prev.map((m) => m.id === assistantId ? { ...m, content: "", displayContent: "", suggestions: [], promptBox: null } : m)
                );
              }
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.text) {
                accumulated += parsed.text;
                const { displayContent, suggestions, promptBox } = parseSuggestions(accumulated);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: accumulated, displayContent, suggestions, promptBox } : m
                  )
                );
              }
              // Orchestrator extras, sent once after the answer completes.
              // The card text comes from the server's stored, validated
              // arguments -- see OrchestratorActionCard.
              if (parsed.actions || parsed.dataSources) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, actions: parsed.actions ?? [], dataSources: parsed.dataSources ?? [] }
                      : m
                  )
                );
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        // cancelled
      } else {
        const errMsg = err instanceof Error ? err.message : t.common.error;
        toast.error(errMsg);
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      router.refresh();
    }
  }

  // ── Media generation ──────────────────────────────────────────────────────

  async function ensureConversation(titleText: string): Promise<string | null> {
    if (currentConvId) return currentConvId;
    try {
      const res = await fetch("/api/create/chat/conversations", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ type: mediaType, title: titleText.slice(0, 50) }),
      });
      const data = await res.json();
      const id = data?.conversation?.id as string | undefined;
      if (!id) return null;
      setCurrentConvId(id);
      window.history.replaceState(null, "", `/chat/${id}`);
      return id;
    } catch {
      return null;
    }
  }

  function saveTurn(convId: string, role: "user" | "assistant", payload: Record<string, unknown>) {
    fetch("/api/create/chat/messages", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ conversationId: convId, role, content: JSON.stringify({ __media: role, ...payload }) }),
    }).catch(() => {});
  }

  function setMedia(msgId: string, media: MediaTurn) {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, media } : m)));
  }

  function pollVideo(predictionId: string, videoId: string, msgId: string, convId: string | null) {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/video/status?predictionId=${predictionId}&videoId=${videoId}`);
        const data = await res.json();
        if (data.status === "succeeded") {
          clearInterval(interval);
          setMedia(msgId, { videoUrl: data.output });
          if (convId) saveTurn(convId, "assistant", { videoUrl: data.output });
          router.refresh();
        } else if (data.status === "failed") {
          clearInterval(interval);
          const error = tri(lang, "تولید ویدیو ناموفق بود", "Video generation failed", "Videogenerierung fehlgeschlagen", "Video oluşturma başarısız");
          setMedia(msgId, { error });
          if (convId) saveTurn(convId, "assistant", { error });
        }
      } catch { /* keep polling */ }
    }, 6000);
  }

  function pollMusic(predictionId: string, musicId: string, msgId: string, convId: string | null) {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/music/status?predictionId=${predictionId}&musicId=${musicId}`);
        const data = await res.json();
        if (data.status === "succeeded") {
          clearInterval(interval);
          setMedia(msgId, { audioUrl: data.output });
          if (convId) saveTurn(convId, "assistant", { audioUrl: data.output });
          router.refresh();
        } else if (data.status === "failed") {
          clearInterval(interval);
          const error = tri(lang, "تولید موزیک ناموفق بود", "Music generation failed", "Musikgenerierung fehlgeschlagen", "Müzik oluşturma başarısız");
          setMedia(msgId, { error });
          if (convId) saveTurn(convId, "assistant", { error });
        }
      } catch { /* keep polling */ }
    }, 6000);
  }

  async function generateMedia() {
    const text = input.trim();
    if (!text || busy) return;
    if (mediaType === "image" && mode === "puter" && !window.puter) {
      toast.error(tri(lang, "اتصال به Puter برقرار نشد", "Could not connect to Puter", "Verbindung zu Puter fehlgeschlagen", "Puter'a bağlanılamadı"));
      return;
    }

    const settings = mediaType === "image" ? { style: imageStyle, ratio: imageRatio, quality: imageQuality, count: imageCount }
      : mediaType === "video" ? { style: videoStyle, duration: videoDuration, ratio: videoRatio }
      : { genre: musicGenre, duration: musicDuration };

    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    const attachments = mediaType !== "music" ? sourceImages : [];

    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: text, displayContent: text, suggestions: [], promptBox: null, timestamp: new Date(), attachments },
      { id: assistantId, role: "assistant", content: "", displayContent: "", suggestions: [], promptBox: null, timestamp: new Date(), media: { pending: true } },
    ]);
    setInput("");
    setSourceImages([]);
    setGenerating(true);

    let convId: string | null = null;
    try {
      convId = await ensureConversation(text);
      if (convId) saveTurn(convId, "user", { text, sourceImageUrls: attachments, settings, mediaType });

      if (mediaType === "image") {
        let images: string[] = [];
        if (mode === "puter") {
          const styledPrompt = imageStyle && imageStyle !== "realistic" ? `${text}, ${imageStyle} style` : text;
          images = await Promise.all(
            Array.from({ length: imageCount }, () => window.puter!.ai.txt2img(styledPrompt, { model: "gpt-image-1-mini" }).then((img) => img.src))
          );
        } else {
          const res = await fetch("/api/image/generate", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: text, style: imageStyle, ratio: imageRatio, quality: imageQuality, count: imageCount, sourceImageUrls: attachments, provider: imageProvider }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          images = (data.images || []).map((img: { url: string }) => img.url);
        }
        setMedia(assistantId, { images });
        if (convId) saveTurn(convId, "assistant", { images });
        router.refresh();
      } else if (mediaType === "video") {
        // Video generation only supports a single reference photo -- if more
        // than one was attached (e.g. left over from an image-tab upload),
        // only the first is sent.
        const res = await fetch("/api/video/generate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text, style: videoStyle, duration: videoDuration, ratio: videoRatio, sourceImageUrl: attachments[0] || null, provider: videoProvider }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setMedia(assistantId, { pending: true, pendingLabel: tri(lang, "در حال پردازش ویدیو... (۲ تا ۵ دقیقه)", "Processing video... (2-5 min)", "Video wird verarbeitet... (2-5 Min)", "Video işleniyor... (2-5 dk)") });
        pollVideo(data.predictionId, data.videoId, assistantId, convId);
      } else {
        const res = await fetch("/api/music/generate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text, genre: musicGenre, duration: musicDuration }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (data.status === "succeeded" && data.output) {
          setMedia(assistantId, { audioUrl: data.output });
          if (convId) saveTurn(convId, "assistant", { audioUrl: data.output });
          router.refresh();
        } else {
          setMedia(assistantId, { pending: true, pendingLabel: tri(lang, "در حال ساخت موزیک...", "Generating music...", "Musik wird erstellt...", "Müzik oluşturuluyor...") });
          pollMusic(data.predictionId, data.musicId, assistantId, convId);
        }
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : tri(lang, "خطا در تولید", "Generation failed", "Generierung fehlgeschlagen", "Oluşturma başarısız");
      setMedia(assistantId, { error });
      if (convId) saveTurn(convId, "assistant", { error });
    } finally {
      setGenerating(false);
    }
  }

  function submit() {
    if (isMedia) generateMedia();
    else sendMessage(input);
  }

  function mediaCost(): number {
    if (mediaType === "image") return (imageQuality === "hd" ? 10 : 5) * imageCount;
    if (mediaType === "video") return VIDEO_DURATIONS.find((d) => d.value === videoDuration)?.credits ?? 20;
    if (mediaType === "music") return MUSIC_DURATIONS.find((d) => d.value === musicDuration)?.credits ?? 10;
    return 0;
  }

  const refLimit = maxReferenceImages(userPlan);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (sourceImages.length >= refLimit) {
      toast.error(
        userPlan && userPlan !== "FREE"
          ? tri(lang, `حداکثر ${refLimit} عکس مرجع مجاز است`, `Up to ${refLimit} reference photos allowed`, `Bis zu ${refLimit} Referenzfotos erlaubt`, `En fazla ${refLimit} referans fotoğrafına izin verilir`)
          : tri(lang, "برای آپلود عکس بیشتر، پلن خود را ارتقا دهید", "Upgrade your plan to upload more photos", "Aktualisieren Sie Ihren Plan, um mehr Fotos hochzuladen", "Daha fazla fotoğraf yüklemek için planınızı yükseltin")
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const compressed = await downscaleImage(file);
      const form = new FormData();
      form.append("file", compressed);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSourceImages((prev) => [...prev, data.url]);
      toast.success(tri(lang, "عکس آپلود شد", "Photo uploaded", "Foto hochgeladen", "Fotoğraf yüklendi"));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tri(lang, "خطا در آپلود", "Upload failed", "Upload fehlgeschlagen", "Yükleme başarısız"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeSourceImage(idx: number) {
    setSourceImages((prev) => prev.filter((_, i) => i !== idx));
  }

  async function translatePrompt() {
    if (!input.trim()) return;
    setTranslating(true);
    try {
      const res = await fetch("/api/image/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: input }) });
      const data = await res.json();
      setInput(data.translated || input);
    } catch {
      toast.error(tri(lang, "خطا در ترجمه", "Translation failed", "Übersetzung fehlgeschlagen", "Çeviri başarısız"));
    } finally {
      setTranslating(false);
    }
  }

  // German used to take the English text unconditionally; now it prefers the
  // German field and only falls back to English, then Persian.
  function templateText(tpl: PromptTemplate) {
    if (lang === "de" && tpl.contentDe) return tpl.contentDe;
    return lang !== "fa" && tpl.contentEn ? tpl.contentEn : tpl.content;
  }
  function pickTemplate(tpl: PromptTemplate) {
    setInput(templateText(tpl));
    if (mediaType === "image" && REFERENCE_REQUIRED_CATEGORIES.has(tpl.category)) {
      setMode("credits");
      if (sourceImages.length === 0) toast(tri(lang, "این پرامپت روی عکس خودتان اعمال می‌شود — یک عکس مرجع آپلود کنید", "This prompt applies to your own photo — upload a reference photo", "Dieser Prompt wird auf Ihr eigenes Foto angewendet — laden Sie ein Referenzfoto hoch", "Bu komut kendi fotoğrafınıza uygulanır — bir referans fotoğraf yükleyin"), { icon: "📷" });
    }
    setShowTemplates(false);
    fetch("/api/prompts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: tpl.id }) }).catch(() => {});
  }

  function stopGeneration() {
    abortRef.current?.abort();
  }

  function copyMessage(content: string) {
    navigator.clipboard.writeText(content);
    toast.success(t.chat.copied);
  }

  const toggleVoiceInput = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast.error(tri(lang, "مرورگر شما از تشخیص صدا پشتیبانی نمی‌کند", "Your browser doesn't support voice input", "Ihr Browser unterstützt keine Spracheingabe", "Tarayıcınız sesli girişi desteklemiyor"));
      return;
    }
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const recognition = new SR();
    recognition.lang = tri(lang, "fa-IR", "en-US", "de-DE", "tr-TR");
    recognition.interimResults = true;
    recognition.continuous = false;
    recognitionRef.current = recognition;
    let finalTranscript = "";
    recognition.onstart = () => setListening(true);
    recognition.onend = () => { setListening(false); recognitionRef.current = null; };
    recognition.onerror = () => { setListening(false); recognitionRef.current = null; };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const txt = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTranscript += txt;
        else interim += txt;
      }
      setInput(finalTranscript + interim);
    };
    recognition.start();
  }, [listening, lang]);

  const toggleSpeak = useCallback((msgId: string, text: string) => {
    if (speakingId === msgId) { window.speechSynthesis.cancel(); setSpeakingId(null); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = tri(lang, "fa-IR", "en-US", "de-DE", "tr-TR");
    utterance.rate = 1;
    const voices = window.speechSynthesis.getVoices();
    const langCode = tri(lang, "fa", "en", "de", "tr");
    const match = voices.find((v) => v.lang.startsWith(langCode));
    if (match) utterance.voice = match;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(msgId);
    window.speechSynthesis.speak(utterance);
  }, [speakingId, lang]);

  const STARTER_PROMPTS_FA = [
    "یک ایمیل رسمی برای من بنویس",
    "این متن رو خلاصه کن",
    "برای سفرم به یک شهر جدید برنامه بریز",
    "چطور برای استارتاپم یک مدل کسب‌وکار بسازم؟",
  ];
  const STARTER_PROMPTS_EN = [
    "Write a formal email for me",
    "Summarize this text",
    "Plan a trip to a new city",
    "How do I build a business model for my startup?",
  ];
  const STARTER_PROMPTS_DE = [
    "Schreiben Sie ein formelles E-Mail für mich",
    "Fassen Sie diesen Text zusammen",
    "Planen Sie eine Reise in eine neue Stadt",
    "Wie erstelle ich ein Geschäftsmodell für mein Startup?",
  ];
  const starterPrompts = tri(lang, STARTER_PROMPTS_FA, STARTER_PROMPTS_EN, STARTER_PROMPTS_DE);

  const pill = { background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" } as const;
  const activeTab = MEDIA_TABS.find((tab) => tab.id === mediaType)!;

  const placeholder = mediaType === "image" ? tri(lang, "چه عکسی بسازم؟ صحنه، سبک و نور را توصیف کن...", "What image should I create? Describe the scene, style and light...", "Welches Bild soll ich erstellen? Szene, Stil und Licht beschreiben...", "Hangi görseli oluşturayım? Sahneyi, stili ve ışığı tarif edin...")
    : mediaType === "video" ? tri(lang, "چه ویدیویی بسازم؟ توصیف کن...", "What video should I create? Describe it...", "Welches Video soll ich erstellen? Beschreiben Sie es...", "Hangi videoyu oluşturayım? Tarif edin...")
    : mediaType === "music" ? tri(lang, "چه موزیکی بسازم؟ توصیف کن...", "What music should I create? Describe it...", "Welche Musik soll ich erstellen? Beschreiben Sie es...", "Hangi müziği oluşturayım? Tarif edin...")
    : (listening ? t.chat.listening : t.chat.placeholder);

  return (
    <div className="flex flex-col h-full" dir={isRtl ? "rtl" : "ltr"} style={{ background: "var(--surface-0)" }}>
      {/* The Puter script backs the free image mode only — loading it on every
          chat page would cost every visitor a third-party script they never use. */}
      {mediaType === "image" && <Script src="https://js.puter.com/v2/" strategy="afterInteractive" onReady={() => setPuterReady(true)} />}

      {/* Top bar — one compact scrollable row. It used to wrap onto a second
          row on narrow screens, which stole height from the thread below; the
          model picker lives here (not in the composer) for the same reason. */}
      <div
        className="flex items-center gap-2 px-3 md:px-4 py-2 flex-shrink-0 overflow-x-auto"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <h1 className="font-semibold text-sm truncate hidden sm:block" style={{ color: "var(--text-primary)" }}>
          {title || t.chat.title}
        </h1>
        {activeProvider && (
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-medium animate-pulse flex-shrink-0 hidden md:inline"
            style={{ background: "rgba(234,88,12,0.15)", color: "var(--primary)", border: "1px solid rgba(234,88,12,0.3)" }}
          >
            ✦ {activeProvider}
          </span>
        )}

        <div className="flex-1 min-w-0" />

        <Link
          href="/plans"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex-shrink-0"
          style={{ background: "var(--primary)", color: "white" }}
        >
          <Zap className="w-3.5 h-3.5" />
          {tri(lang, "افزایش اعتبار", "Add Credits", "Guthaben aufladen", "Kredi Ekle")}
        </Link>

        <button
          onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))}
          aria-label={tri(lang, "جستجو", "Search", "Suche", "Ara")}
          title={tri(lang, "جستجو (⌘K)", "Search (⌘K)", "Suche (⌘K)", "Ara (⌘K)")}
          className="flex items-center justify-center w-8 h-8 rounded-xl flex-shrink-0"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
        >
          <Search className="w-3.5 h-3.5" />
        </button>

        {/* Expert mode — chat only; it has no effect on image/video/music.
            The menu is positioned with `fixed` + a measured button rect
            instead of `absolute` inside this row: the row scrolls
            horizontally (overflow-x-auto), and per the CSS spec that forces
            overflow-y to auto too, so an absolutely-positioned dropdown here
            got silently clipped to the row's own height — it opened but was
            invisible, cut off behind the chat background below it. */}
        {!isMedia && (
          <div className="flex-shrink-0">
            <button
              ref={modeMenuBtnRef}
              onClick={() => {
                if (!showModeMenu && modeMenuBtnRef.current) {
                  const r = modeMenuBtnRef.current.getBoundingClientRect();
                  setModeMenuPos({ top: r.bottom + 4, left: isRtl ? r.right - 256 : r.left });
                }
                setShowModeMenu(!showModeMenu);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap"
              style={{
                background: "var(--surface-2)",
                border: `1px solid ${showModeMenu ? currentMode.color : "var(--border)"}`,
                color: currentMode.color,
              }}
            >
              <currentMode.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tri(lang, currentMode.labelFa, currentMode.labelEn, currentMode.labelDe)}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {showModeMenu && modeMenuPos && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowModeMenu(false)} />
                <div
                  className="fixed p-1.5 rounded-2xl shadow-2xl grid grid-cols-2 gap-1 w-64 z-50"
                  style={{ top: modeMenuPos.top, left: modeMenuPos.left, background: "var(--surface-1)", border: "1px solid var(--border)" }}
                >
                  {EXPERT_MODES.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setExpertMode(m.id); setShowModeMenu(false); }}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                      style={{
                        background: expertMode === m.id ? `${m.color}20` : "transparent",
                        color: expertMode === m.id ? m.color : "var(--text-secondary)",
                        border: expertMode === m.id ? `1px solid ${m.color}40` : "1px solid transparent",
                        textAlign: isRtl ? "right" : "left",
                      }}
                    >
                      <m.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: m.color }} />
                      <span>{tri(lang, m.labelFa, m.labelEn, m.labelDe)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Model — whichever model the active tab actually uses. */}
        {!isMedia && (
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl text-xs outline-none flex-shrink-0 max-w-[9rem]"
            style={pill}
          >
            {MODEL_IDS.map((m) => <option key={m.id} value={m.id}>{t.chat.models[m.key]}{chatBaseCost != null ? ` · ${chatBaseCost}+` : ""}</option>)}
            {chatProviders.map((p) => <option key={p.id} value={p.model}>{p.name}{p.creditCost != null ? ` · ${p.creditCost}` : ""}</option>)}
          </select>
        )}
        {mediaType === "image" && mode === "credits" && imageProviders.length > 0 && (
          <select value={imageProvider} onChange={(e) => setImageProvider(e.target.value)} className="px-2.5 py-1.5 rounded-xl text-xs outline-none flex-shrink-0 max-w-[9rem]" style={pill}>
            {imageProviders.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {mediaType === "video" && videoProviders.length > 0 && (
          <select value={videoProvider} onChange={(e) => setVideoProvider(e.target.value)} className="px-2.5 py-1.5 rounded-xl text-xs outline-none flex-shrink-0 max-w-[9rem]" style={pill}>
            {videoProviders.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}

        {/* Free (Puter) vs credits — image only. */}
        {mediaType === "image" && (
          <div className="flex rounded-xl overflow-hidden flex-shrink-0" style={{ border: "1px solid var(--border)" }}>
            <button onClick={() => setMode("credits")} className="px-2.5 py-1.5 text-xs font-medium flex items-center gap-1" style={{ background: mode === "credits" ? "var(--primary)" : "var(--surface-2)", color: mode === "credits" ? "white" : "var(--text-secondary)" }}>
              <Coins className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setMode("puter")} className="px-2.5 py-1.5 text-xs font-medium flex items-center gap-1" style={{ background: mode === "puter" ? "var(--primary)" : "var(--surface-2)", color: mode === "puter" ? "white" : "var(--text-secondary)" }}>
              <Gift className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: isMedia ? "rgba(234,88,12,0.12)" : `${currentMode.color}20`, border: `1px solid ${isMedia ? "rgba(234,88,12,0.3)" : `${currentMode.color}30`}` }}
            >
              {isMedia
                ? <activeTab.icon className="w-8 h-8" style={{ color: "var(--primary)" }} />
                : <currentMode.icon className="w-8 h-8" style={{ color: currentMode.color }} />}
            </div>
            <h2 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              {isMedia
                ? tri(lang, activeTab.fa, activeTab.en, activeTab.de)
                : tri(lang, currentMode.labelFa, currentMode.labelEn, currentMode.labelDe)}
            </h2>
            {isMedia ? (
              <p className="text-sm mb-8 max-w-sm" style={{ color: "var(--text-secondary)" }}>
                {mediaType === "image" ? tri(lang, "با نوشتن یک پیام، اولین عکستان را بسازید", "Write a message to create your first image", "Schreiben Sie eine Nachricht für Ihr erstes Bild", "İlk görselinizi oluşturmak için bir mesaj yazın")
                  : mediaType === "video" ? tri(lang, "با نوشتن یک پیام، اولین ویدیوتان را بسازید", "Write a message to create your first video", "Schreiben Sie eine Nachricht für Ihr erstes Video", "İlk videonuzu oluşturmak için bir mesaj yazın")
                  : tri(lang, "با نوشتن یک پیام، اولین موزیکتان را بسازید", "Write a message to create your first track", "Schreiben Sie eine Nachricht für Ihren ersten Track", "İlk parçanızı oluşturmak için bir mesaj yazın")}
              </p>
            ) : (
              <>
                <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>{t.chat.greeting}</p>
                <p className="text-xs mb-8 max-w-sm" style={{ color: "var(--text-muted)" }}>{t.chat.greetingSubtitle}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
                  {starterPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className={`px-4 py-3 rounded-xl text-sm transition-all hover:border-orange-500 ${isRtl ? "text-right" : "text-left"}`}
                      style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-secondary)", lineHeight: "1.5" }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1"
              style={{
                background: msg.role === "user" ? "var(--primary)" : msg.media ? "rgba(234,88,12,0.12)" : `${currentMode.color}20`,
                border: msg.role === "assistant" ? `1px solid ${msg.media ? "rgba(234,88,12,0.3)" : `${currentMode.color}30`}` : "none",
              }}
            >
              {msg.role === "user"
                ? <User className="w-4 h-4 text-white" />
                : msg.media
                  ? <Sparkles className="w-4 h-4" style={{ color: "var(--primary)" }} />
                  : <currentMode.icon className="w-4 h-4" style={{ color: currentMode.color }} />}
            </div>

            <div className={`max-w-[78%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
              <div
                className="px-4 py-3 rounded-2xl text-sm leading-relaxed"
                style={{
                  // A full bright-orange fill read fine for a short line but
                  // became hard to read once a user turn held a long prompt
                  // (e.g. a whole image-generation prompt echoed back) --
                  // white text on solid --primary loses contrast over that
                  // much area. A dark surface with an orange border/accent
                  // keeps the user turn visually distinct without the
                  // readability problem.
                  background: msg.role === "user" ? "var(--surface-2)" : "var(--surface-1)",
                  color: "var(--text-primary)",
                  border: msg.role === "user" ? "1px solid rgba(234,88,12,0.35)" : "1px solid var(--border)",
                }}
              >
                {msg.role === "assistant" ? (
                  msg.media ? (
                    <MediaBubble media={msg.media} lang={lang} msgId={msg.id} playingId={playingId} setPlayingId={setPlayingId} />
                  ) : (
                    <div className="prose prose-sm max-w-none" style={{ color: "var(--text-primary)" }}>
                      {msg.displayContent ? (
                        <ReactMarkdown>{msg.displayContent}</ReactMarkdown>
                      ) : !msg.promptBox ? (
                        <span className="cursor-blink" />
                      ) : null}
                      {msg.promptBox && <PromptBoxCard data={msg.promptBox} lang={lang} />}
                    </div>
                  )
                ) : (
                  <>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {!!msg.attachments?.length && (
                      <div className="flex gap-1.5 mt-2">
                        {msg.attachments.map((url, i) => (
                          <img key={i} src={url} alt="" className="w-16 h-16 object-cover rounded-lg opacity-90" />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {msg.role === "assistant" && msg.displayContent && !msg.media && !streaming && (
                <div className="flex items-center gap-1 px-2">
                  <ActionBtn icon={Copy} onClick={() => copyMessage(msg.displayContent)} title={t.chat.copy} />
                  <ActionBtn icon={RotateCcw} onClick={() => sendMessage(messages[messages.indexOf(msg) - 1]?.content || "")} title={t.chat.regenerate} />
                  <ActionBtn icon={ThumbsUp} onClick={() => toast.success(t.chat.thanks)} title={t.chat.good} />
                  <ActionBtn icon={ThumbsDown} onClick={() => toast.success(t.chat.thanks)} title={t.chat.improve} />
                  <ActionBtn
                    icon={speakingId === msg.id ? VolumeX : Volume2}
                    onClick={() => toggleSpeak(msg.id, msg.displayContent)}
                    title={speakingId === msg.id ? t.chat.stopSpeaking : t.chat.readAloud}
                    active={speakingId === msg.id}
                  />
                </div>
              )}

              {/* Real-data attribution: a quiet label, not a badge, so the
                  answer still reads as one voice while the user can see where
                  the figures came from (master prompt 3.3). */}
              {msg.role === "assistant" && !!msg.dataSources?.length && (
                <div className="flex items-center gap-1.5 px-2 mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  <Database className="w-3 h-3 flex-shrink-0" />
                  <span>{dataSourceLabel(msg.dataSources, lang)}</span>
                </div>
              )}

              {msg.role === "assistant" &&
                msg.actions?.map((action) => <OrchestratorActionCard key={action.id} action={action} lang={lang} />)}

              {msg.role === "assistant" && msg.suggestions.length > 0 && !streaming && (
                <div className={`flex flex-wrap gap-2 px-1 mt-1 ${isRtl ? "justify-end" : "justify-start"}`}>
                  {msg.suggestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      className="px-3 py-1.5 rounded-xl text-xs transition-all hover:border-orange-500"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-secondary)", textAlign: isRtl ? "right" : "left", maxWidth: "280px", lineHeight: "1.4" }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Composer — the media tabs sit on its top edge, as in the reference
          design, so switching to عکس/ویدیو/موزیک never leaves the chat. */}
      <div className="px-3 md:px-4 pb-3 pt-1 flex-shrink-0">
        <div className="flex items-center gap-1 px-2 overflow-x-auto">
          {MEDIA_TABS.map((tab) => {
            const active = mediaType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setMediaType(tab.id)}
                className="relative flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium whitespace-nowrap flex-shrink-0"
                style={{
                  background: active ? "var(--surface-1)" : "transparent",
                  color: active ? "var(--text-primary)" : "var(--text-muted)",
                  border: active ? "1px solid var(--border)" : "1px solid transparent",
                  borderBottom: active ? "1px solid var(--surface-1)" : "1px solid transparent",
                  borderRadius: "12px 12px 0 0",
                  marginBottom: "-1px",
                  zIndex: active ? 1 : 0,
                }}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tri(lang, tab.fa, tab.en, tab.de)}
              </button>
            );
          })}
        </div>

        <div
          className="rounded-2xl px-3 py-2.5"
          style={{
            background: "var(--surface-1)",
            border: `1px solid ${listening ? "rgba(234,88,12,0.6)" : "var(--border)"}`,
            transition: "border-color 0.2s",
          }}
        >
          {sourceImages.length > 0 && mediaType !== "music" && (
            <div className="flex items-center gap-2 mb-2 px-1 flex-wrap">
              {sourceImages.map((url, i) => (
                <div key={i} className="relative">
                  <img src={url} alt="" className="w-10 h-10 object-cover rounded-lg" style={{ border: "1px solid var(--border)" }} />
                  <button onClick={() => removeSourceImage(i)} className="absolute -top-1.5 -left-1.5 p-0.5 rounded-full bg-black/70 text-white">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {tri(lang, "عکس مرجع پیوست شد", "Reference photo attached", "Referenzfoto angehängt", "Referans fotoğraf eklendi")}
              </span>
            </div>
          )}

          <div className="flex items-end gap-2">
            {isMedia && mediaType !== "music" ? (
              <div className="flex flex-col items-center gap-0.5 flex-shrink-0 mb-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || (mediaType === "image" && mode !== "credits") || sourceImages.length >= refLimit}
                  className="disabled:opacity-30"
                  style={{ color: "var(--text-muted)" }}
                  title={tri(lang, "عکس مرجع", "Reference photo", "Referenzfoto", "Referans fotoğraf")}
                >
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                </button>
                {/* Reference-photo cap: 2 for free accounts, 7 for paid --
                    e.g. a "couple" prompt needs 2 uploads, so this has to be
                    visible before the user hits the limit, not just after. */}
                {mediaType === "image" && (
                  <span className="text-[9px] font-mono leading-none" style={{ color: sourceImages.length >= refLimit ? "var(--primary)" : "var(--text-muted)" }}>
                    {sourceImages.length}/{refLimit}
                  </span>
                )}
              </div>
            ) : !isMedia ? (
              <button className="flex-shrink-0 mb-1" style={{ color: "var(--text-muted)" }} title={t.chat.attach}>
                <Paperclip className="w-5 h-5" />
              </button>
            ) : null}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUpload} className="hidden" />

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
              }}
              placeholder={placeholder}
              rows={1}
              className="flex-1 resize-none outline-none bg-transparent text-sm leading-relaxed"
              style={{ color: "var(--text-primary)", minHeight: "24px", maxHeight: "160px", direction: isRtl ? "rtl" : "ltr" }}
            />

            {isMedia && (
              <button
                onClick={translatePrompt}
                disabled={translating || !input.trim()}
                className="flex-shrink-0 mb-1 disabled:opacity-30"
                style={{ color: "var(--text-muted)" }}
                title={tri(lang, "ترجمه به انگلیسی", "Translate to English", "Ins Englische übersetzen", "İngilizceye çevir")}
              >
                {translating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
              </button>
            )}

            <button
              onClick={toggleVoiceInput}
              className="flex-shrink-0 mb-1 w-8 h-8 rounded-xl flex items-center justify-center"
              title={listening ? t.chat.listening : t.chat.voiceInput}
              style={{ background: listening ? "rgba(234,88,12,0.2)" : "transparent", color: listening ? "var(--primary)" : "var(--text-muted)" }}
            >
              {listening ? <MicOff className="w-4 h-4 animate-pulse" /> : <Mic className="w-4 h-4" />}
            </button>

            {streaming ? (
              <button onClick={stopGeneration} className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--danger)" }}>
                <Square className="w-4 h-4 text-white" />
              </button>
            ) : isMedia ? (
              <button
                onClick={submit}
                disabled={generating || !input.trim() || (mediaType === "image" && mode === "puter" && !puterReady)}
                className="flex-shrink-0 flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-semibold text-white disabled:opacity-40"
                style={{ background: "var(--primary)" }}
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {tri(lang, "ساخت", "Create", "Erstellen", "Oluştur")}
                {mode === "credits" && <span className="opacity-80">· {mediaCost()}</span>}
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!input.trim()}
                className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-40"
                style={{ background: "var(--primary)" }}
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            )}
          </div>

          {/* Per-tab settings — one scrollable row so they never push the
              thread off screen. */}
          {isMedia && (
            <div className="flex items-center gap-1.5 mt-2 pt-2 overflow-x-auto" style={{ borderTop: "1px solid var(--border)" }}>
              {mediaType === "image" && (
                <>
                  <select value={imageStyle} onChange={(e) => setImageStyle(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-[11px] outline-none flex-shrink-0" style={pill}>
                    {IMAGE_STYLES.map((s) => <option key={s} value={s}>{IMAGE_STYLE_LABEL[s][lang]}</option>)}
                  </select>
                  <select value={imageRatio} onChange={(e) => setImageRatio(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-[11px] outline-none flex-shrink-0" style={pill}>
                    {RATIOS.map((r) => <option key={r} value={r}>{RATIO_LABEL[r][lang]} · {r}</option>)}
                  </select>
                  {mode === "credits" && (
                    <select value={imageQuality} onChange={(e) => setImageQuality(e.target.value as "standard" | "hd")} className="px-2.5 py-1.5 rounded-lg text-[11px] outline-none flex-shrink-0" style={pill}>
                      <option value="standard">{tri(lang, "اقتصادی · سریع", "Economy · Fast", "Sparsam · Schnell", "Ekonomik · Hızlı")}</option>
                      <option value="hd">{tri(lang, "کیفیت بالا", "High quality", "Hohe Qualität", "Yüksek kalite")}</option>
                    </select>
                  )}
                  <select value={imageCount} onChange={(e) => setImageCount(parseInt(e.target.value))} className="px-2.5 py-1.5 rounded-lg text-[11px] outline-none flex-shrink-0" style={pill}>
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n === 1 ? tri(lang, "یک خروجی", "1 output", "1 Ergebnis", "1 çıktı") : tri(lang, `${n} خروجی`, `${n} outputs`, `${n} Ergebnisse`, `${n} çıktı`)}
                      </option>
                    ))}
                  </select>
                  {templates.length > 0 && (
                    <button onClick={() => setShowTemplates(true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium flex-shrink-0" style={pill}>
                      <Sparkles className="w-3 h-3" style={{ color: "var(--primary)" }} />
                      {tri(lang, "پرامپت آماده", "Ready prompts", "Fertige Prompts", "Hazır komutlar")}
                    </button>
                  )}
                  <Link href="/image/generate?tab=character" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium flex-shrink-0" style={pill}>
                    <UserSquare2 className="w-3 h-3" />
                    {tri(lang, "ساخت کاراکتر", "Character", "Charakter", "Karakter")}
                  </Link>
                </>
              )}

              {mediaType === "video" && (
                <>
                  <select value={videoStyle} onChange={(e) => setVideoStyle(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-[11px] outline-none flex-shrink-0" style={pill}>
                    {VIDEO_STYLES.map((s) => <option key={s.value} value={s.value}>{lang === "fa" ? s.fa : lang === "de" ? s.de : s.en}</option>)}
                  </select>
                  <select value={videoRatio} onChange={(e) => setVideoRatio(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-[11px] outline-none flex-shrink-0" style={pill}>
                    {VIDEO_RATIOS.map((r) => <option key={r} value={r}>{RATIO_LABEL[r]?.[lang] ?? r} · {r}</option>)}
                  </select>
                  <select value={videoDuration} onChange={(e) => setVideoDuration(parseInt(e.target.value))} className="px-2.5 py-1.5 rounded-lg text-[11px] outline-none flex-shrink-0" style={pill}>
                    {VIDEO_DURATIONS.map((d) => <option key={d.value} value={d.value}>{d.value}s · {d.credits}</option>)}
                  </select>
                  {templates.length > 0 && (
                    <button onClick={() => setShowTemplates(true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium flex-shrink-0" style={pill}>
                      <Sparkles className="w-3 h-3" style={{ color: "var(--primary)" }} />
                      {tri(lang, "پرامپت آماده", "Ready prompts", "Fertige Prompts", "Hazır komutlar")}
                    </button>
                  )}
                </>
              )}

              {mediaType === "music" && (
                <>
                  <select value={musicGenre} onChange={(e) => setMusicGenre(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-[11px] outline-none flex-shrink-0" style={pill}>
                    {MUSIC_GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <select value={musicDuration} onChange={(e) => setMusicDuration(parseInt(e.target.value))} className="px-2.5 py-1.5 rounded-lg text-[11px] outline-none flex-shrink-0" style={pill}>
                    {MUSIC_DURATIONS.map((d) => <option key={d.value} value={d.value}>{d.value}s · {d.credits}</option>)}
                  </select>
                </>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          {t.chat.disclaimer}
        </p>
      </div>

      {showTemplates && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowTemplates(false)}>
          <div className="w-full max-w-4xl max-h-[85vh] rounded-2xl overflow-hidden flex flex-col" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="text-base font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                <Sparkles className="w-4 h-4" style={{ color: "var(--primary)" }} />
                {tri(lang, "گالری پرامپت‌های آماده", "Prompt Gallery", "Prompt-Galerie", "Komut Galerisi")}
              </h2>
              <button onClick={() => setShowTemplates(false)} className="p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }}><X className="w-5 h-5" /></button>
            </div>
            {mediaType === "image" && (
              <div className="flex items-center gap-2 px-5 py-3 overflow-x-auto flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
                {IMAGE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap flex-shrink-0"
                    style={{
                      background: activeCategory === cat.id ? "var(--primary)" : "var(--surface-1)",
                      color: activeCategory === cat.id ? "white" : "var(--text-secondary)",
                      border: `1px solid ${activeCategory === cat.id ? "var(--primary)" : "var(--border)"}`,
                    }}
                  >
                    {lang === "fa" ? cat.fa : lang === "de" ? cat.de : cat.en}
                  </button>
                ))}
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-5">
              {templates.length === 0 ? (
                <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>{tri(lang, "هنوز پرامپتی اضافه نشده", "No prompts added yet", "Noch keine Prompts hinzugefügt", "Henüz komut eklenmedi")}</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates
                    .filter((tpl) => mediaType !== "image" || activeCategory === "all" || tpl.category === activeCategory)
                    .map((tpl) => {
                      const displayTitle = (lang === "de" && tpl.titleDe) || (lang !== "fa" && tpl.titleEn) || tpl.title;
                      const guide = (lang === "de" && tpl.guideDe) || (lang !== "fa" && tpl.guideEn) || tpl.guideFa;
                      return (
                        <div key={tpl.id} className="rounded-2xl overflow-hidden flex flex-col" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                          {tpl.thumbnailUrl && <img src={tpl.thumbnailUrl} alt={displayTitle} className="w-full h-32 object-cover" />}
                          <div className="p-3.5 flex flex-col gap-2 flex-1">
                            <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{displayTitle}</div>
                            {/* How-to-use tip for this specific prompt (e.g. "upload a
                                clear front-facing photo", or for a couple prompt
                                "upload a photo of the two of you") -- separate from the
                                raw model instructions below, which most users never
                                need to read. */}
                            {/* The raw model prompt used to be shown here too (a 3-line
                                preview under the guide) -- it's implementation detail
                                the model reads, not something a user needs to see before
                                clicking "Try it"; the guide box is the only user-facing
                                copy a card needs. */}
                            <div className="rounded-xl px-3 py-2 flex-1" style={{ background: "rgba(234,88,12,0.08)", border: "1px solid rgba(234,88,12,0.2)" }}>
                              <p className="text-[10px] font-semibold mb-0.5" style={{ color: "var(--primary)" }}>
                                {tri(lang, "راهنما", "Guide", "Anleitung", "Rehber")}
                              </p>
                              <p className="text-[11px] leading-5" style={{ color: "var(--text-secondary)" }}>
                                {guide || tri(lang, "روی «امتحان کن» بزنید تا این پرامپت در چت قرار بگیرد.", "Tap \"Try it\" to load this prompt into the chat.", "Tippen Sie auf „Ausprobieren“, um diesen Prompt in den Chat zu laden.", "Bu komutu sohbete yüklemek için \"Dene\"ye dokunun.")}
                              </p>
                            </div>
                            <button onClick={() => pickTemplate(tpl)} className="py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: "var(--primary)" }}>
                              {tri(lang, "امتحان کن", "Try it", "Ausprobieren", "Dene")}
                            </button>
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

function MediaBubble({
  media, lang, msgId, playingId, setPlayingId,
}: {
  media: MediaTurn; lang: Lang; msgId: string;
  playingId: string | null; setPlayingId: (id: string | null) => void;
}) {
  if (media.pending) {
    return (
      <div className="flex items-center gap-2 py-1">
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--primary)" }} />
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {media.pendingLabel || tri(lang, "در حال ساخت...", "Generating...", "Wird erstellt...", "Oluşturuluyor...")}
        </span>
      </div>
    );
  }
  if (media.error) return <p className="text-sm" style={{ color: "#ef4444" }}>{media.error}</p>;

  if (media.images?.length) {
    return (
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(media.images.length, 2)}, 1fr)` }}>
        {media.images.map((url, i) => (
          <div key={i} className="relative group rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <img src={url} alt={`${i + 1}`} className="w-full h-auto max-w-[240px]" />
            <a href={url} download target="_blank" rel="noreferrer" className="absolute bottom-1.5 right-1.5 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(0,0,0,0.6)" }}>
              <Download className="w-3.5 h-3.5 text-white" />
            </a>
          </div>
        ))}
      </div>
    );
  }

  if (media.videoUrl) {
    return (
      <div className="rounded-xl overflow-hidden max-w-[300px]" style={{ border: "1px solid var(--border)" }}>
        <video src={media.videoUrl} controls className="w-full" />
        <a href={media.videoUrl} download className="flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
          <Download className="w-3 h-3" />{tri(lang, "دانلود", "Download", "Herunterladen", "İndir")}
        </a>
      </div>
    );
  }

  if (media.audioUrl) {
    return (
      <div className="rounded-xl p-3 min-w-[220px]" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        <button
          onClick={() => {
            const el = document.getElementById(`audio-${msgId}`) as HTMLAudioElement | null;
            if (!el) return;
            if (playingId === msgId) { el.pause(); setPlayingId(null); } else { el.play(); setPlayingId(msgId); }
          }}
          className="w-9 h-9 rounded-full flex items-center justify-center mb-2"
          style={{ background: "var(--primary)" }}
        >
          {playingId === msgId ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
        </button>
        <audio id={`audio-${msgId}`} src={media.audioUrl} onEnded={() => setPlayingId(null)} />
        <a href={media.audioUrl} download className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
          <Download className="w-3 h-3" />{tri(lang, "دانلود MP3", "Download MP3", "MP3 herunterladen", "MP3 İndir")}
        </a>
      </div>
    );
  }

  return null;
}

function ActionBtn({
  icon: Icon, onClick, title, active = false,
}: { icon: React.ElementType; onClick: () => void; title: string; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded-lg transition-all hover:bg-white/5"
      style={{ color: active ? "var(--primary)" : "var(--text-muted)" }}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}
