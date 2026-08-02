"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Send, Square, Paperclip, RotateCcw, Copy, ThumbsUp, ThumbsDown,
  Bot, User, Sparkles, Mic, MicOff, Volume2, VolumeX,
  ChevronDown, Briefcase, TrendingUp, DollarSign, ShoppingCart,
  Rocket, Scale, Users,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import toast from "react-hot-toast";
import { useTranslation } from "@/lib/i18n";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  displayContent: string;
  suggestions: string[];
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

function parseSuggestions(content: string): { displayContent: string; suggestions: string[] } {
  const match = content.match(/<SUGGESTIONS>([\s\S]*?)<\/SUGGESTIONS>/);
  if (!match) return { displayContent: content, suggestions: [] };
  const displayContent = content.replace(/<SUGGESTIONS>[\s\S]*?<\/SUGGESTIONS>/g, "").trimEnd();
  try {
    const suggestions = JSON.parse(match[1]);
    return { displayContent, suggestions: Array.isArray(suggestions) ? suggestions.slice(0, 5) : [] };
  } catch {
    return { displayContent, suggestions: [] };
  }
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
              const { displayContent, suggestions } = parseSuggestions(m.content);
              return { id: m.id, role: m.role, content: m.content, displayContent, suggestions, timestamp: new Date(m.timestamp) };
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
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setStreaming(true);
    setShowModeMenu(false);

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", displayContent: "", suggestions: [], timestamp: new Date() },
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
                  prev.map((m) => m.id === assistantId ? { ...m, content: "", displayContent: "", suggestions: [] } : m)
                );
              }
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.text) {
                accumulated += parsed.text;
                const { displayContent, suggestions } = parseSuggestions(accumulated);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: accumulated, displayContent, suggestions } : m
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
                    ) : (
                      <span className="cursor-blink" />
                    )}
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
