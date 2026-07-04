"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Square, Paperclip, RotateCcw, Copy, ThumbsUp, ThumbsDown, Bot, User, Sparkles, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import ReactMarkdown from "react-markdown";
import toast from "react-hot-toast";
import { useTranslation } from "@/lib/i18n";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const MODEL_IDS = [
  { id: "auto", key: "auto" as const, plan: "FREE" },
];

// Extend Window type for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export default function ChatInterface({ conversationId, systemPrompt, title }: { conversationId?: string; systemPrompt?: string; title?: string }) {
  const { t, lang } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODEL_IDS[0].id);
  const [currentConvId, setCurrentConvId] = useState(conversationId);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  // Voice input state
  const [listening, setListening] = useState(false);
  // Voice output state — which message id is currently being spoken
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const isRtl = lang === "fa";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  // Stop speech synthesis on unmount or lang change
  useEffect(() => {
    return () => { window.speechSynthesis?.cancel(); };
  }, []);

  // Load previous messages when opening an existing conversation
  useEffect(() => {
    if (!conversationId) return;
    setCurrentConvId(conversationId);
    setMessages([]);
    fetch(`/api/chat/history?conversationId=${conversationId}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.messages?.length) {
          setMessages(
            data.messages.map((m: { id: string; role: "user" | "assistant"; content: string; timestamp: string }) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: new Date(m.timestamp),
            }))
          );
        }
      })
      .catch(() => {});
  }, [conversationId]);

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setStreaming(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", timestamp: new Date() }]);

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
          history: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || t.common.error);
      }

      const convId = response.headers.get("X-Conversation-Id");
      if (convId && !currentConvId) setCurrentConvId(convId);

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
                // Previous provider failed mid-response; server already
                // discarded the partial text — clear it here too so the
                // next provider's answer doesn't append onto a half one.
                accumulated = "";
                setMessages((prev) =>
                  prev.map((m) => m.id === assistantId ? { ...m, content: "" } : m)
                );
              }
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.text) {
                accumulated += parsed.text;
                setMessages((prev) =>
                  prev.map((m) => m.id === assistantId ? { ...m, content: accumulated } : m)
                );
              }
            } catch (e) {
              // Re-throw real errors (parsed.error), ignore JSON parse failures
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        // cancelled by user
      } else {
        const errMsg = err instanceof Error ? err.message : t.common.error;
        toast.error(errMsg);
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function stopGeneration() {
    abortRef.current?.abort();
  }

  function copyMessage(content: string) {
    navigator.clipboard.writeText(content);
    toast.success(t.chat.copied);
  }

  // ── Voice Input ──────────────────────────────────────────────────
  const toggleVoiceInput = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast.error(lang === "fa" ? "مرورگر شما از تشخیص صدا پشتیبانی نمی‌کند" : "Your browser doesn't support voice input");
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SR();
    recognition.lang = lang === "fa" ? "fa-IR" : "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    let finalTranscript = "";

    recognition.onstart = () => setListening(true);
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTranscript += t;
        else interim += t;
      }
      setInput(finalTranscript + interim);
    };

    recognition.start();
  }, [listening, lang]);

  // ── Voice Output ─────────────────────────────────────────────────
  const toggleSpeak = useCallback((msgId: string, text: string) => {
    if (speakingId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === "fa" ? "fa-IR" : "en-US";
    utterance.rate = 1;

    // Prefer a voice that matches the language
    const voices = window.speechSynthesis.getVoices();
    const langCode = lang === "fa" ? "fa" : "en";
    const match = voices.find((v) => v.lang.startsWith(langCode));
    if (match) utterance.voice = match;

    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(msgId);
    window.speechSynthesis.speak(utterance);
  }, [speakingId, lang]);

  return (
    <div className="flex flex-col h-screen" dir={isRtl ? "rtl" : "ltr"} style={{ background: "var(--surface-0)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <h1 className="font-semibold" style={{ color: "var(--text-primary)" }}>{title || t.chat.title}</h1>
          {activeProvider && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium animate-pulse"
              style={{ background: "rgba(234,88,12,0.15)", color: "var(--primary)", border: "1px solid rgba(234,88,12,0.3)" }}>
              ✦ {activeProvider}
            </span>
          )}
        </div>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="px-3 py-1.5 rounded-xl text-sm outline-none"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        >
          {MODEL_IDS.map((m) => (
            <option key={m.id} value={m.id}>{t.chat.models[m.key]}</option>
          ))}
        </select>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(234,88,12,0.15)" }}>
              <Sparkles className="w-8 h-8" style={{ color: "var(--primary)" }} />
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>{t.chat.greeting}</h2>
            <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>{t.chat.greetingSubtitle}</p>
            <div className="grid grid-cols-2 gap-3 max-w-lg">
              {t.chat.suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className={`px-4 py-3 rounded-xl text-sm transition-all hover:border-orange-500 ${isRtl ? "text-right" : "text-left"}`}
                  style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
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
                background: msg.role === "user" ? "var(--primary)" : "var(--surface-2)",
                border: msg.role === "assistant" ? "1px solid var(--border)" : "none",
              }}
            >
              {msg.role === "user" ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4" style={{ color: "var(--primary)" }} />}
            </div>

            {/* Bubble */}
            <div className={`max-w-[75%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
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
                    {msg.content ? (
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    ) : (
                      <span className="cursor-blink" />
                    )}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>

              {/* Actions */}
              {msg.role === "assistant" && msg.content && !streaming && (
                <div className="flex items-center gap-1 px-2">
                  <ActionBtn icon={Copy} onClick={() => copyMessage(msg.content)} title={t.chat.copy} />
                  <ActionBtn icon={RotateCcw} onClick={() => sendMessage(messages[messages.indexOf(msg) - 1]?.content || "")} title={t.chat.regenerate} />
                  <ActionBtn icon={ThumbsUp} onClick={() => toast.success(t.chat.thanks)} title={t.chat.good} />
                  <ActionBtn icon={ThumbsDown} onClick={() => toast.success(t.chat.thanks)} title={t.chat.improve} />
                  {/* TTS button */}
                  <ActionBtn
                    icon={speakingId === msg.id ? VolumeX : Volume2}
                    onClick={() => toggleSpeak(msg.id, msg.content)}
                    title={speakingId === msg.id ? t.chat.stopSpeaking : t.chat.readAloud}
                    active={speakingId === msg.id}
                  />
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
          style={{ background: "var(--surface-1)", border: `1px solid ${listening ? "rgba(234,88,12,0.6)" : "var(--border)"}`, transition: "border-color 0.2s" }}
        >
          {/* Attach */}
          <button className="flex-shrink-0 mb-1" style={{ color: "var(--text-muted)" }} title={t.chat.attach}>
            <Paperclip className="w-5 h-5" />
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder={listening ? t.chat.listening : t.chat.placeholder}
            rows={1}
            className="flex-1 resize-none outline-none bg-transparent text-sm leading-relaxed"
            style={{ color: "var(--text-primary)", minHeight: "24px", maxHeight: "200px", direction: isRtl ? "rtl" : "ltr" }}
          />

          {/* Mic button */}
          <button
            onClick={toggleVoiceInput}
            className="flex-shrink-0 mb-1 w-8 h-8 rounded-xl flex items-center justify-center transition-all"
            title={listening ? t.chat.listening : t.chat.voiceInput}
            style={{
              background: listening ? "rgba(234,88,12,0.2)" : "transparent",
              color: listening ? "var(--primary)" : "var(--text-muted)",
            }}
          >
            {listening
              ? <MicOff className="w-4 h-4 animate-pulse" />
              : <Mic className="w-4 h-4" />}
          </button>

          {/* Send / Stop */}
          {streaming ? (
            <button
              onClick={stopGeneration}
              className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all"
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
