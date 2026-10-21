"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Compass, X, Send, Maximize2, Minimize2, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { MOBILE_DRAWER_EVENT } from "@/components/layout/MobileNavShell";
import type { Lang } from "@/lib/i18n";
import { SUPPORT_COLOR, SUPPORT_TINT, supportAssistantInitial, supportAssistantName } from "@/lib/orchestrator/support/identity";
import { formatSources } from "@/lib/orchestrator/support/formatSources";

/**
 * The floating support assistant widget (`support_mode`, master prompt §2).
 *
 * Mounted once in `(dashboard)/layout.tsx`, alongside every dashboard page --
 * dashboard-only is a Phase 1 decision (admin is on the orchestrator's DENY
 * list anyway; the public site has no session and a different threat model).
 *
 * Hidden in two situations, both mirroring an existing precedent in this
 * codebase rather than inventing new rules:
 *   - On /chat itself: `CommandPalette`'s own floating trigger already hides
 *     there because it would sit "directly above that row and read as a
 *     redundant, disconnected line" (see MobileNavShell.tsx) -- a second
 *     floating helper bubble over the chat page's own message composer is
 *     the same collision.
 *   - While the mobile drawer is open: listens for `MOBILE_DRAWER_EVENT`
 *     (a window event, not React context, because the server-component
 *     dashboard layout that parents both has no client tree to share state
 *     through) so the launcher never renders on top of an open drawer.
 *
 * z-index lanes (Phase 1 architecture, §9), measured against the shell's own
 * chrome: MobileNavShell's bars sit at z-40, its drawer+backdrop at z-50,
 * ChatInterface's template modal at z-[300].
 *   - closed launcher / anchored panel: z-[200] (above page content and the
 *     z-40 bars, below the z-50 mobile drawer -- so it never renders on top
 *     of an actually-open drawer even before the JS listener above runs)
 *   - expanded panel + its backdrop: z-[320] (above the z-[300] modal)
 */

type SupportRole = "user" | "assistant";

interface NavigationTarget {
  href: string;
  label: string;
  reachable: boolean;
}

interface SupportMessage {
  id: string;
  role: SupportRole;
  content: string;
  navigation?: NavigationTarget | null;
  sources?: { slug: string; title: string; heading: string }[];
  isError?: boolean;
}

const STORAGE_KEY = "aifekr-support-conversation";

const COPY: Record<Lang, {
  title: string;
  launcherLabel: string;
  placeholder: string;
  greeting: string;
  starters: string[];
  unavailable: string;
  rateLimited: string;
  genericError: string;
  sourcesLabel: string;
  send: string;
  close: string;
  expand: string;
  collapse: string;
}> = {
  fa: {
    title: supportAssistantName("fa"),
    launcherLabel: "راهنمای AIFekr",
    placeholder: "سؤال خودتون رو بپرسید…",
    greeting: "سلام! هر سؤالی دربارهٔ پیدا کردن یا استفاده از بخش‌های AIFekr دارید، بپرسید.",
    starters: ["فاکتور رو از کجا پیدا کنم؟", "چطور اینستاگرامم رو وصل کنم؟", "کجا می‌تونم عکس بسازم؟"],
    unavailable: "دستیار پشتیبانی الان موقتاً در دسترس نیست — می‌تونید از همون چت اصلی هم بپرسید.",
    rateLimited: "کمی تند رفتید! چند لحظه صبر کنید و دوباره بپرسید.",
    genericError: "یه مشکلی پیش اومد — دوباره امتحان کنید.",
    sourcesLabel: "منبع",
    send: "ارسال",
    close: "بستن",
    expand: "تمام‌صفحه",
    collapse: "خروج از تمام‌صفحه",
  },
  en: {
    title: supportAssistantName("en"),
    launcherLabel: "AIFekr Guide",
    placeholder: "Ask anything…",
    greeting: "Hi! Ask me anything about finding or using a part of AIFekr.",
    starters: ["Where do I find invoices?", "How do I connect my Instagram?", "Where can I generate an image?"],
    unavailable: "The support assistant is temporarily unavailable — you can also ask the main chat.",
    rateLimited: "A bit fast! Wait a moment and ask again.",
    genericError: "Something went wrong — please try again.",
    sourcesLabel: "Source",
    send: "Send",
    close: "Close",
    expand: "Fullscreen",
    collapse: "Exit fullscreen",
  },
  de: {
    title: supportAssistantName("de"),
    launcherLabel: "AIFekr-Guide",
    placeholder: "Fragen Sie etwas…",
    greeting: "Hallo! Fragen Sie mich alles rund um das Finden oder Nutzen eines Bereichs von AIFekr.",
    starters: ["Wo finde ich Rechnungen?", "Wie verbinde ich mein Instagram?", "Wo kann ich ein Bild erstellen?"],
    unavailable: "Der Support-Assistent ist vorübergehend nicht verfügbar — Sie können auch den Hauptchat fragen.",
    rateLimited: "Etwas zu schnell! Warten Sie einen Moment und fragen Sie erneut.",
    genericError: "Etwas ist schiefgelaufen — bitte versuchen Sie es erneut.",
    sourcesLabel: "Quelle",
    send: "Senden",
    close: "Schließen",
    expand: "Vollbild",
    collapse: "Vollbild verlassen",
  },
  // No Turkish support-widget copy yet -- English fallback.
  tr: {
    title: supportAssistantName("tr"),
    launcherLabel: "AIFekr Guide",
    placeholder: "Ask anything…",
    greeting: "Hi! Ask me anything about finding or using a part of AIFekr.",
    starters: ["Where do I find invoices?", "How do I connect my Instagram?", "Where can I generate an image?"],
    unavailable: "The support assistant is temporarily unavailable — you can also ask the main chat.",
    rateLimited: "A bit fast! Wait a moment and ask again.",
    genericError: "Something went wrong — please try again.",
    sourcesLabel: "Source",
    send: "Send",
    close: "Close",
    expand: "Fullscreen",
    collapse: "Exit fullscreen",
  },
};

function newId(): string {
  return Math.random().toString(36).slice(2);
}

export default function FloatingSupportWidget({ lang }: { lang: Lang }) {
  const pathname = usePathname();
  const router = useRouter();
  const dir = lang === "fa" ? "rtl" : "ltr";
  const copy = COPY[lang];

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  const conversationIdRef = useRef<string | null>(null);
  const historyLoadedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Same collision this page already solves for CommandPalette's own
  // floating trigger -- see the file-level comment.
  const onChatPage = pathname === "/chat" || pathname?.startsWith("/chat/");

  useEffect(() => {
    setHasMounted(true);
    try {
      conversationIdRef.current = sessionStorage.getItem(STORAGE_KEY);
    } catch {
      // Private-browsing or storage-blocked contexts -- the widget still
      // works, it just starts a fresh thread every reload.
    }
  }, []);

  useEffect(() => {
    function onDrawer(e: Event) {
      setMobileDrawerOpen(!!(e as CustomEvent<{ open: boolean }>).detail?.open);
    }
    window.addEventListener(MOBILE_DRAWER_EVENT, onDrawer);
    return () => window.removeEventListener(MOBILE_DRAWER_EVENT, onDrawer);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) setIsOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Lazily hydrate a previous thread only once the panel is actually
  // opened -- most page loads never open the widget, and there's no reason
  // to spend a request finding that out on every one of them.
  useEffect(() => {
    if (!isOpen || historyLoadedRef.current || !conversationIdRef.current) return;
    historyLoadedRef.current = true;
    const id = conversationIdRef.current;
    fetch(`/api/support/chat?conversationId=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((data: { messages?: Array<{ id: string; role: string; content: string }> }) => {
        if (data.messages?.length) {
          setMessages(data.messages.map((m) => ({ id: m.id, role: m.role as SupportRole, content: m.content })));
        }
      })
      .catch(() => {
        // Reopening history is a nicety, not a requirement -- fail silently
        // into a fresh-looking (but still live) thread.
      });
  }, [isOpen]);

  if (onChatPage) return null;

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const priorHistory = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    const userMsg: SupportMessage = { id: newId(), role: "user", content: trimmed };
    const assistantId = newId();
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    abortRef.current = new AbortController();

    try {
      const response = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, conversationId: conversationIdRef.current, history: priorHistory }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const friendly = response.status === 503 ? copy.unavailable : response.status === 429 ? copy.rateLimited : body.error || copy.genericError;
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: friendly, isError: true } : m)));
        return;
      }

      const convId = response.headers.get("X-Conversation-Id");
      if (convId) {
        conversationIdRef.current = convId;
        try {
          sessionStorage.setItem(STORAGE_KEY, convId);
        } catch {
          // Non-fatal -- the reply already streamed, only history-on-reload is lost.
        }
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error(copy.genericError);

      const decoder = new TextDecoder();
      let accumulated = "";

      // Same "data: " SSE line protocol as /api/chat, parsed the same way
      // ChatInterface.tsx already does -- see that file for the original.
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        for (const line of decoder.decode(value, { stream: true }).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;

          let parsed: { text?: string; reset?: boolean; error?: string; navigation?: NavigationTarget | null; sources?: { slug: string; title: string; heading: string }[] };
          try {
            parsed = JSON.parse(data);
          } catch {
            continue;
          }

          if (parsed.reset) {
            accumulated = "";
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: "" } : m)));
          }
          if (parsed.error) {
            const friendly = parsed.error === "support_model_unavailable" ? copy.unavailable : copy.genericError;
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: friendly, isError: true } : m)));
            continue;
          }
          if (parsed.text) {
            accumulated += parsed.text;
            const snapshot = accumulated;
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: snapshot } : m)));
          }
          if (parsed.navigation !== undefined || parsed.sources !== undefined) {
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, navigation: parsed.navigation ?? null, sources: parsed.sources ?? [] } : m)));
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: copy.genericError, isError: true } : m)));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  const NavArrow = dir === "rtl" ? ArrowLeft : ArrowRight;
  const showGreeting = messages.length === 0;

  const panelSizeClass = isExpanded
    ? "fixed inset-4 md:inset-10 max-w-3xl max-h-[900px] mx-auto my-auto"
    : "fixed bottom-24 md:bottom-6 w-[calc(100vw-32px)] max-w-[380px] h-[70vh] max-h-[560px]";

  return (
    <div dir={dir} suppressHydrationWarning>
      {/* Closed launcher */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label={copy.launcherLabel}
          title={copy.launcherLabel}
          className={`fixed z-[200] w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 ${mobileDrawerOpen ? "hidden" : ""} ${hasMounted ? "aifekr-support-launcher-in" : ""}`}
          style={{
            bottom: "max(24px, calc(env(safe-area-inset-bottom) + 24px))",
            [dir === "rtl" ? "left" : "right"]: 16,
            background: SUPPORT_COLOR,
            color: "#fff",
          }}
        >
          <Compass className="w-6 h-6" />
        </button>
      )}

      {/* Panel */}
      {isOpen && (
        <>
          {isExpanded && <div className="fixed inset-0 z-[315]" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setIsExpanded(false)} />}
          <div
            className={`${panelSizeClass} flex flex-col rounded-2xl shadow-2xl overflow-hidden ${mobileDrawerOpen ? "hidden" : ""}`}
            style={{
              // Anchored mode positions itself off the inline-end edge like the
              // launcher; expanded mode is centered purely by panelSizeClass's
              // `inset-*`/`mx-auto`/`my-auto` classes, so no left/right here.
              ...(isExpanded ? {} : { [dir === "rtl" ? "left" : "right"]: 16 }),
              // Single source of truth for stacking (see the file-level z-index
              // comment) -- anchored sits below the mobile drawer (z-50),
              // expanded sits above ChatInterface's z-[300] template modal.
              zIndex: isExpanded ? 320 : 200,
              background: "var(--surface-1)",
              border: "1px solid var(--border)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm" style={{ background: SUPPORT_TINT, color: SUPPORT_COLOR }}>
                  {supportAssistantInitial(lang)}
                </div>
                <span className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>{copy.title}</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => setIsExpanded((v) => !v)} aria-label={isExpanded ? copy.collapse : copy.expand} title={isExpanded ? copy.collapse : copy.expand}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:brightness-110" style={{ color: "var(--text-secondary)" }}>
                  {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button onClick={() => setIsOpen(false)} aria-label={copy.close} title={copy.close}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:brightness-110" style={{ color: "var(--text-secondary)" }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {showGreeting && (
                <div className="space-y-3">
                  <div className="rounded-2xl px-3.5 py-2.5 text-sm max-w-[85%]" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>
                    {copy.greeting}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {copy.starters.map((s) => (
                      <button key={s} onClick={() => send(s)}
                        className="text-xs px-2.5 py-1.5 rounded-full transition-colors hover:brightness-110"
                        style={{ background: SUPPORT_TINT, color: SUPPORT_COLOR }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[85%] space-y-1.5">
                    <div
                      className="rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap"
                      style={
                        m.role === "user"
                          ? { background: SUPPORT_COLOR, color: "#fff" }
                          : { background: "var(--surface-2)", color: m.isError ? "var(--text-secondary)" : "var(--text-primary)" }
                      }
                    >
                      {m.content || (streaming && m.role === "assistant" ? <Loader2 className="w-4 h-4 animate-spin" /> : "")}
                    </div>

                    {m.navigation && (
                      <button
                        onClick={() => router.push(m.navigation!.href)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition-colors hover:brightness-110 w-full"
                        style={{ background: SUPPORT_TINT, color: SUPPORT_COLOR }}
                      >
                        <span className="flex-1 text-start">{m.navigation.label}</span>
                        <NavArrow className="w-3.5 h-3.5 flex-shrink-0" />
                      </button>
                    )}

                    {!!m.sources?.length && (
                      <div className="text-[11px] px-1" style={{ color: "var(--text-muted)" }}>
                        {copy.sourcesLabel}: {formatSources(m.sources, lang)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            <form onSubmit={handleSubmit} className="flex items-end gap-2 px-3 py-3 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder={copy.placeholder}
                rows={1}
                disabled={streaming}
                className="flex-1 resize-none rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "var(--surface-2)", color: "var(--text-primary)", maxHeight: 96 }}
              />
              <button
                type="submit"
                disabled={streaming || !input.trim()}
                aria-label={copy.send}
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity"
                style={{ background: SUPPORT_COLOR, color: "#fff" }}
              >
                {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" style={dir === "rtl" ? { transform: "scaleX(-1)" } : undefined} />}
              </button>
            </form>
          </div>
        </>
      )}

      {/* Entrance animation for the launcher -- respects prefers-reduced-motion
          via the media query itself, not a JS check, so it's correct even if
          this component's own logic never runs (e.g. a slow hydration). */}
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes aifekrSupportLauncherIn {
            from { opacity: 0; transform: scale(0.6); }
            to   { opacity: 1; transform: scale(1); }
          }
          .aifekr-support-launcher-in { animation: aifekrSupportLauncherIn 0.35s ease-out; }
        }
      `}</style>
    </div>
  );
}
