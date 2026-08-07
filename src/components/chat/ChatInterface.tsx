"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Send, Square, Paperclip, RotateCcw, Copy, ThumbsUp, ThumbsDown,
  Bot, User, Sparkles, Mic, MicOff, Volume2, VolumeX,
  ChevronDown, ChevronUp, Briefcase, TrendingUp, DollarSign, ShoppingCart,
  Rocket, Scale, Users, Search, Check, FileText, FileDown, Hash,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import toast from "react-hot-toast";
import { useTranslation } from "@/lib/i18n";
import { OPEN_COMMAND_PALETTE_EVENT } from "@/components/ui/CommandPalette";

interface PromptBoxData {
  name: string;
  type: string;
  targetAI: string;
  language: string;
  category: string;
  content: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  displayContent: string;
  suggestions: string[];
  promptBox: PromptBoxData | null;
  timestamp: Date;
}

const EXPERT_MODES = [
  { id: "default",   labelFa: "دستیار هوشمند",     labelEn: "Smart Assistant", icon: Sparkles,     color: "#ea580c" },
  { id: "business",  labelFa: "دکتر کسب‌وکار",     labelEn: "Business Doctor", icon: Briefcase,    color: "#3b82f6" },
  { id: "marketing", labelFa: "بازاریابی",          labelEn: "Marketing",       icon: TrendingUp,   color: "#10b981" },
  { id: "financial", labelFa: "مالی و سرمایه",      labelEn: "Financial",       icon: DollarSign,   color: "#f59e0b" },
  { id: "sales",     labelFa: "فروش",               labelEn: "Sales",           icon: ShoppingCart, color: "#8b5cf6" },
  { id: "startup",   labelFa: "استارتاپ",           labelEn: "Startup",         icon: Rocket,       color: "#ef4444" },
  { id: "legal",     labelFa: "حقوقی",              labelEn: "Legal",           icon: Scale,        color: "#06b6d4" },
  { id: "hr",        labelFa: "منابع انسانی",       labelEn: "HR & People",     icon: Users,        color: "#d97706" },
];

const MODEL_IDS = [
  { id: "auto", key: "auto" as const, plan: "FREE" },
];

declare global {
  interface Window {
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

function PromptBoxCard({ data, isFa }: { data: PromptBoxData; isFa: boolean }) {
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
      {/* Header */}
      <div className="px-4 pt-3 pb-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 flex-shrink-0" style={{ color: "var(--primary)" }} />
          <span className="text-sm font-semibold text-white truncate">{data.name || (isFa ? "پرامپت" : "Prompt")}</span>
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

      {/* Body */}
      {expanded && (
        <pre
          className="px-4 py-3 text-xs leading-6 whitespace-pre-wrap break-words overflow-x-auto"
          style={{ color: "#e4e4e7", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", maxHeight: "420px", overflowY: "auto" }}
        >
          {data.content}
        </pre>
      )}

      {/* Footer toolbar */}
      <div className="flex items-center justify-between px-3 py-2 flex-wrap gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "#a1a1aa" }}>
          <Hash className="w-3 h-3" />
          <span>{wordCount} {isFa ? "کلمه" : "words"} · ~{tokenEstimate} tokens</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setExpanded((v) => !v)} className="p-1.5 rounded-lg transition-colors" style={{ color: "#a1a1aa" }} title={expanded ? (isFa ? "بستن" : "Collapse") : (isFa ? "باز کردن" : "Expand")}>
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
            {copied ? (isFa ? "کپی شد" : "Copied") : (isFa ? "کپی" : "Copy")}
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
  const [currentConvId, setCurrentConvId] = useState(conversationId);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [expertMode, setExpertMode] = useState("default");
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const isRtl = lang === "fa";
  const currentMode = EXPERT_MODES.find((m) => m.id === expertMode) || EXPERT_MODES[0];

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
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  useEffect(() => {
    return () => { window.speechSynthesis?.cancel(); };
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    setCurrentConvId(conversationId);
    setMessages([]);
    fetch(`/api/chat/history?conversationId=${conversationId}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.messages?.length) {
          setMessages(
            data.messages.map((m: { id: string; role: "user" | "assistant"; content: string; timestamp: string }) => {
              const { displayContent, suggestions, promptBox } = parseSuggestions(m.content);
              return { id: m.id, role: m.role, content: m.content, displayContent, suggestions, promptBox, timestamp: new Date(m.timestamp) };
            })
          );
        }
      })
      .catch(() => {});
  }, [conversationId]);

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return;

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
          history: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
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
      toast.error(lang === "fa" ? "مرورگر شما از تشخیص صدا پشتیبانی نمی‌کند" : "Your browser doesn't support voice input");
      return;
    }
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const recognition = new SR();
    recognition.lang = lang === "fa" ? "fa-IR" : "en-US";
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
    utterance.lang = lang === "fa" ? "fa-IR" : "en-US";
    utterance.rate = 1;
    const voices = window.speechSynthesis.getVoices();
    const langCode = lang === "fa" ? "fa" : "en";
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
  const starterPrompts = lang === "fa" ? STARTER_PROMPTS_FA : STARTER_PROMPTS_EN;

  return (
    <div className="flex flex-col h-screen" dir={isRtl ? "rtl" : "ltr"} style={{ background: "var(--surface-0)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="font-semibold truncate" style={{ color: "var(--text-primary)" }}>{title || t.chat.title}</h1>
          {activeProvider && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium animate-pulse flex-shrink-0"
              style={{ background: "rgba(234,88,12,0.15)", color: "var(--primary)", border: "1px solid rgba(234,88,12,0.3)" }}
            >
              ✦ {activeProvider}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Global search — opens the shared command palette (Cmd/Ctrl+K) */}
          <button
            onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))}
            aria-label={isRtl ? "جستجو" : "Search"}
            title={isRtl ? "جستجو (⌘K)" : "Search (⌘K)"}
            className="hidden md:flex items-center justify-center w-8 h-8 rounded-xl transition-all"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          {/* Expert Mode Selector */}
          <div className="relative">
            <button
              onClick={() => setShowModeMenu(!showModeMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={{
                background: "var(--surface-2)",
                border: `1px solid ${showModeMenu ? currentMode.color : "var(--border)"}`,
                color: currentMode.color,
              }}
            >
              <currentMode.icon className="w-3.5 h-3.5" />
              <span>{lang === "fa" ? currentMode.labelFa : currentMode.labelEn}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {showModeMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowModeMenu(false)} />
                <div
                  className="absolute top-full mt-1 z-20 p-1.5 rounded-2xl shadow-2xl grid grid-cols-2 gap-1 w-64"
                  style={{
                    background: "var(--surface-1)",
                    border: "1px solid var(--border)",
                    [isRtl ? "right" : "left"]: 0,
                  }}
                >
                  {EXPERT_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => { setExpertMode(mode.id); setShowModeMenu(false); }}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all"
                      style={{
                        background: expertMode === mode.id ? `${mode.color}20` : "transparent",
                        color: expertMode === mode.id ? mode.color : "var(--text-secondary)",
                        border: expertMode === mode.id ? `1px solid ${mode.color}40` : "1px solid transparent",
                        textAlign: isRtl ? "right" : "left",
                      }}
                    >
                      <mode.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: mode.color }} />
                      <span>{lang === "fa" ? mode.labelFa : mode.labelEn}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="px-3 py-1.5 rounded-xl text-xs outline-none"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          >
            {MODEL_IDS.map((m) => (
              <option key={m.id} value={m.id}>{t.chat.models[m.key]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: `${currentMode.color}20`, border: `1px solid ${currentMode.color}30` }}
            >
              <currentMode.icon className="w-8 h-8" style={{ color: currentMode.color }} />
            </div>
            <h2 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              {lang === "fa" ? currentMode.labelFa : currentMode.labelEn}
            </h2>
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
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1"
              style={{
                background: msg.role === "user" ? "var(--primary)" : `${currentMode.color}20`,
                border: msg.role === "assistant" ? `1px solid ${currentMode.color}30` : "none",
              }}
            >
              {msg.role === "user"
                ? <User className="w-4 h-4 text-white" />
                : <currentMode.icon className="w-4 h-4" style={{ color: currentMode.color }} />}
            </div>

            {/* Bubble + suggestions */}
            <div className={`max-w-[78%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
              <div
                className="px-4 py-3 rounded-2xl text-sm leading-relaxed"
                style={{
                  background: msg.role === "user" ? "var(--primary)" : "var(--surface-1)",
                  color: msg.role === "user" ? "white" : "var(--text-primary)",
                  border: msg.role === "assistant" ? "1px solid var(--border)" : "none",
                }}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none" style={{ color: "var(--text-primary)" }}>
                    {msg.displayContent ? (
                      <ReactMarkdown>{msg.displayContent}</ReactMarkdown>
                    ) : !msg.promptBox ? (
                      <span className="cursor-blink" />
                    ) : null}
                    {msg.promptBox && <PromptBoxCard data={msg.promptBox} isFa={lang === "fa"} />}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>

              {/* Action buttons */}
              {msg.role === "assistant" && msg.displayContent && !streaming && (
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

              {/* Suggested follow-up questions */}
              {msg.role === "assistant" && msg.suggestions.length > 0 && !streaming && (
                <div className={`flex flex-wrap gap-2 px-1 mt-1 ${isRtl ? "justify-end" : "justify-start"}`}>
                  {msg.suggestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      className="px-3 py-1.5 rounded-xl text-xs transition-all hover:border-orange-500"
                      style={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        color: "var(--text-secondary)",
                        textAlign: isRtl ? "right" : "left",
                        maxWidth: "280px",
                        lineHeight: "1.4",
                      }}
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

      {/* Input */}
      <div className="px-4 py-4" style={{ borderTop: "1px solid var(--border)" }}>
        <div
          className="flex items-end gap-3 px-4 py-3 rounded-2xl"
          style={{
            background: "var(--surface-1)",
            border: `1px solid ${listening ? "rgba(234,88,12,0.6)" : "var(--border)"}`,
            transition: "border-color 0.2s",
          }}
        >
          <button className="flex-shrink-0 mb-1" style={{ color: "var(--text-muted)" }} title={t.chat.attach}>
            <Paperclip className="w-5 h-5" />
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
            }}
            placeholder={listening ? t.chat.listening : t.chat.placeholder}
            rows={1}
            className="flex-1 resize-none outline-none bg-transparent text-sm leading-relaxed"
            style={{ color: "var(--text-primary)", minHeight: "24px", maxHeight: "200px", direction: isRtl ? "rtl" : "ltr" }}
          />

          <button
            onClick={toggleVoiceInput}
            className="flex-shrink-0 mb-1 w-8 h-8 rounded-xl flex items-center justify-center transition-all"
            title={listening ? t.chat.listening : t.chat.voiceInput}
            style={{ background: listening ? "rgba(234,88,12,0.2)" : "transparent", color: listening ? "var(--primary)" : "var(--text-muted)" }}
          >
            {listening ? <MicOff className="w-4 h-4 animate-pulse" /> : <Mic className="w-4 h-4" />}
          </button>

          {streaming ? (
            <button
              onClick={stopGeneration}
              className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "var(--danger)" }}
            >
              <Square className="w-4 h-4 text-white" />
            </button>
          ) : (
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim()}
              className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
              style={{ background: "var(--primary)" }}
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
        <p className="text-center text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          {t.chat.disclaimer}
        </p>
      </div>
    </div>
  );
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
