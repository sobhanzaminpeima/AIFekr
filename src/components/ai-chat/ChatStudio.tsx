"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import "katex/dist/katex.min.css";
import { useTranslation, tri } from "@/lib/i18n";
import {
  Send,
  Square,
  Plus,
  Copy,
  RotateCcw,
  Pencil,
  Trash2,
  Archive,
  Download,
  Menu,
  X,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
} from "lucide-react";
import "./chat-studio.css";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import DiscoveryCard from "./DiscoveryCard";
type Message = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  requestId?: string;
};
type Session = {
  authenticated: boolean;
  name?: string;
  chatOnly?: boolean;
  remaining: number;
  credits: number;
  creditsPerTurn: number;
  messages: Message[];
  mergedConversationId: string | null;
  retentionHours: number;
  discoveryEnabled: boolean;
};
async function call(url: string, body?: unknown) {
  const r = await fetch(
    url,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : { cache: "no-store" },
  );
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "REQUEST_FAILED");
  return d;
}
export default function ChatStudio() {
  const { lang } = useTranslation(),
    t = (fa: string, en: string, de: string, tr: string) =>
      tri(lang, fa, en, de, tr),
    [session, setSession] = useState<Session | null>(null),
    [messages, setMessages] = useState<Message[]>([]),
    [draft, setDraft] = useState(""),
    [conversationId, setConversationId] = useState<string>(),
    [history, setHistory] = useState<{ id: string; title: string }[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [auth, setAuth] = useState(false),
    [menu, setMenu] = useState(false),
    [search, setSearch] = useState("");
  const abort = useRef<AbortController | null>(null),
    bottom = useRef<HTMLDivElement>(null),
    composer = useRef<HTMLTextAreaElement>(null),
    initialized = useRef(false);
  const loadHistory = useCallback(async () => {
    try {
      setHistory(
        (
          await call(
            `/api/ai-chat/v1/conversations?search=${encodeURIComponent(search)}`,
          )
        ).conversations,
      );
    } catch {
      /* Guests have no account history. */
    }
  }, [search]);
  const openConversation = useCallback(async (id: string) => {
    const d = await call(
      `/api/ai-chat/v1/conversations?id=${encodeURIComponent(id)}`,
    );
    setConversationId(id);
    setMessages(d.conversation.messages);
    setMenu(false);
  }, []);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    try {
      setDraft(sessionStorage.getItem("aifekr-chat-draft") || "");
    } catch {}
    call("/api/ai-chat/v1/session", {})
      .then(async (s) => {
        setSession(s);
        if (s.mergedConversationId)
          await openConversation(s.mergedConversationId);
        else setMessages(s.messages);
        if (s.authenticated) await loadHistory();
      })
      .catch((e) => setError(e.message));
  }, [loadHistory, openConversation]);
  useEffect(() => {
    if (session?.authenticated) void loadHistory();
  }, [search, session?.authenticated, loadHistory]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end", behavior: "auto" });
  }, [messages]);
  useEffect(() => () => abort.current?.abort(), []);
  async function send(text = draft) {
    if (busy || !text.trim() || !session) return;
    if (!session.authenticated && session.remaining === 0) {
      setAuth(true);
      return;
    }
    setBusy(true);
    setError("");
    const id = crypto.randomUUID(),
      userMessage: Message = { role: "user", content: text },
      assistant: Message = { role: "assistant", content: "", requestId: id };
    setMessages((m) => [...m, userMessage, assistant]);
    setDraft("");
    try {
      sessionStorage.setItem("aifekr-chat-draft", text);
    } catch {}
    const controller = new AbortController();
    abort.current = controller;
    let completed = false,
      resolvedConversation = conversationId;
    try {
      const r = await fetch("/api/ai-chat/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          message: text,
          language: lang,
          conversationId,
        }),
        signal: controller.signal,
      });
      if (!r.ok) {
        const d = await r.json();
        if (d.error === "SIGNUP_REQUIRED") {
          setAuth(true);
          setDraft(text);
          setMessages((m) => m.slice(0, -2));
        }
        throw Error(d.error);
      }
      const reader = r.body!.getReader(),
        decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const e = JSON.parse(line.slice(6));
          if (e.conversationId) {
            resolvedConversation = e.conversationId;
            setConversationId(e.conversationId);
          }
          if (e.error) throw Error(e.error);
          if (e.text) {
            assistant.content += e.text;
            setMessages((m) =>
              m.map((v, n) => (n === m.length - 1 ? { ...assistant } : v)),
            );
          }
          if (e.done) completed = true;
        }
      }
      if (!completed) throw Error("INTERRUPTED");
      try {
        sessionStorage.removeItem("aifekr-chat-draft");
      } catch {}
      const s = await call("/api/ai-chat/v1/session", {});
      setSession(s);
      if (s.authenticated) {
        await loadHistory();
        if (resolvedConversation) await openConversation(resolvedConversation);
      }
    } catch (e) {
      setError(controller.signal.aborted ? "CANCELLED" : (e as Error).message);
      if (!completed) setDraft(text);
    } finally {
      setBusy(false);
      abort.current = null;
      composer.current?.focus();
    }
  }
  async function action(
    action: string,
    id: string,
    extra: Record<string, unknown> = {},
  ) {
    try {
      await call("/api/ai-chat/v1/conversations", { action, id, ...extra });
      await loadHistory();
      if (action === "delete" || action === "archive") {
        setMessages([]);
        setConversationId(undefined);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function edit(index: number, regenerate = false) {
    if (!session?.authenticated || !conversationId) return;
    let m = messages[index];
    if (m.role === "assistant") m = messages[index - 1];
    if (!m?.id) return;
    const text = regenerate
      ? m.content
      : window.prompt(
          t(
            "ویرایش پیام",
            "Edit message",
            "Nachricht bearbeiten",
            "Mesajı düzenle",
          ),
          m.content,
        );
    if (!text) return;
    await action("truncate", conversationId, { messageId: m.id });
    await openConversation(conversationId);
    setDraft(text);
    composer.current?.focus();
  }
  async function exportConversation() {
    const data = messages
        .map((m) => `## ${m.role}\n\n${m.content}`)
        .join("\n\n"),
      url = URL.createObjectURL(
        new Blob([data], { type: "text/markdown;charset=utf-8" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = "aifekr-chat.md";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const genericError =
    error === "CANCELLED"
      ? t(
          "پاسخ متوقف شد؛ برای درخواست ناتمام هزینه‌ای کسر نمی‌شود.",
          "Response stopped. Unfulfilled requests are not charged.",
          "Antwort gestoppt. Unvollständige Anfragen werden nicht berechnet.",
          "Yanıt durduruldu. Tamamlanmayan isteklerden ücret alınmaz.",
        )
      : error === "INSUFFICIENT_CREDITS"
        ? t(
            "اعتبار کافی نیست. از بخش اعتبار، حساب را شارژ کنید.",
            "Not enough credits. Top up your balance.",
            "Nicht genügend Credits. Bitte Guthaben aufladen.",
            "Yeterli kredi yok. Bakiyenizi yükleyin.",
          )
        : t(
            "درخواست انجام نشد. متن شما حفظ شده؛ دوباره تلاش کنید.",
            "The request could not finish. Your draft is saved; please try again.",
            "Die Anfrage konnte nicht abgeschlossen werden. Ihr Entwurf ist gespeichert.",
            "İstek tamamlanamadı. Taslağınız kaydedildi; tekrar deneyin.",
          );
  return (
    <div className="ai-chat-studio" dir={lang === "fa" ? "rtl" : "ltr"}>
      <aside className={menu ? "is-open" : ""}>
        <Link href="/" className="chat-brand">
          AIFekr <span>AI Chat</span>
        </Link>
        <button
          onClick={() => {
            setMessages([]);
            setConversationId(undefined);
            setMenu(false);
            composer.current?.focus();
          }}
        >
          <Plus size={18} />
          {t("گفتگوی جدید", "New chat", "Neuer Chat", "Yeni sohbet")}
        </button>
        {session?.authenticated && (
          <details>
            <summary>
              {t(
                "تاریخچه گفتگوها",
                "Conversation history",
                "Chatverlauf",
                "Sohbet geçmişi",
              )}
            </summary>
            <input
              aria-label={t("جستجو", "Search", "Suchen", "Ara")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {history.map((c) => (
              <div className="chat-history-row" key={c.id}>
                <button
                  disabled={busy}
                  onClick={() => void openConversation(c.id)}
                >
                  {c.title}
                </button>
                <button
                  aria-label={t("حذف", "Delete", "Löschen", "Sil")}
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        t(
                          "گفتگو حذف شود؟",
                          "Delete conversation?",
                          "Chat löschen?",
                          "Sohbet silinsin mi?",
                        ),
                      )
                    )
                      void action("delete", c.id);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </details>
        )}
        <footer>
          <Link href="/pricing">
            {t(
              "بررسی امکانات آی‌فکر",
              "Explore AIFekr modules",
              "AIFekr-Module entdecken",
              "AIFekr modüllerini keşfet",
            )}
          </Link>
          {session?.authenticated ? (
            <>
              <Link href="/settings">
                {t(
                  "تنظیمات و پروفایل",
                  "Settings & profile",
                  "Einstellungen und Profil",
                  "Ayarlar ve profil",
                )}
              </Link>
              {!session.chatOnly && (
                <Link href="/home">
                  {t(
                    "پلتفرم من",
                    "My workspace",
                    "Mein Arbeitsbereich",
                    "Çalışma alanım",
                  )}
                </Link>
              )}
            </>
          ) : (
            <Link href="/login?redirect=%2Fchat">
              {t("ورود", "Log in", "Anmelden", "Giriş yap")}
            </Link>
          )}
          <small>
            {t(
              "محصول مستقل AIFekr با مدل‌های هوش مصنوعی",
              "Independent AIFekr service powered by AI models",
              "Unabhängiger AIFekr-Dienst mit KI-Modellen",
              "AI modelleriyle çalışan bağımsız AIFekr hizmeti",
            )}
          </small>
        </footer>
      </aside>
      <section className="chat-main">
        <header>
          <button
            aria-label={t("منو", "Menu", "Menü", "Menü")}
            onClick={() => setMenu(!menu)}
          >
            <Menu size={20} />
          </button>
          <strong>AIFekr AI Chat</strong>
          <LanguageSwitcher />
          <span>
            {session
              ? `${session.remaining} ${t("پیام رایگان باقی مانده", "free messages left", "kostenlose Nachrichten übrig", "ücretsiz mesaj kaldı")}`
              : "…"}
          </span>
          {conversationId && (
            <>
              <button
                aria-label={t(
                  "خروجی گفتگو",
                  "Export chat",
                  "Chat exportieren",
                  "Sohbeti dışa aktar",
                )}
                onClick={() => void exportConversation()}
              >
                <Download size={16} />
              </button>
              <button
                aria-label={t("آرشیو", "Archive", "Archivieren", "Arşivle")}
                disabled={busy}
                onClick={() => void action("archive", conversationId)}
              >
                <Archive size={16} />
              </button>
            </>
          )}
        </header>
        <div className="chat-scroll">
          {!messages.length && (
            <div className="chat-welcome">
              <Sparkles size={40} />
              <h1>
                {t(
                  "چه کمکی از من برمی‌آید؟",
                  "How can I help?",
                  "Wie kann ich helfen?",
                  "Nasıl yardımcı olabilirim?",
                )}
              </h1>
              <p>
                {t(
                  "بپرس، بنویس، یاد بگیر. برای شروع نیازی به خرید ماژول نیست.",
                  "Ask, write and learn. No module purchase is needed to begin.",
                  "Fragen, schreiben, lernen. Zum Start ist kein Modulkauf nötig.",
                  "Sor, yaz ve öğren. Başlamak için modül satın alman gerekmez.",
                )}
              </p>
              <div className="chat-suggestions">
                {[
                  t(
                    "این مفهوم را ساده توضیح بده",
                    "Explain a concept simply",
                    "Erkläre einen Begriff einfach",
                    "Bir kavramı basitçe açıkla",
                  ),
                  t(
                    "برای نوشتن یک ایمیل کمکم کن",
                    "Help me write an email",
                    "Hilf mir bei einer E-Mail",
                    "E-posta yazmama yardım et",
                  ),
                  t(
                    "برای یادگیری برنامه‌ریزی کنیم",
                    "Help me plan my learning",
                    "Plane mit mir mein Lernen",
                    "Öğrenme planı hazırlayalım",
                  ),
                ].map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setDraft(p);
                      composer.current?.focus();
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, index) => (
            <article className={`chat-message ${m.role}`} key={m.id || index}>
              <small>
                {m.role === "user" ? t("شما", "You", "Sie", "Sen") : "AIFekr"}
              </small>
              <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex, rehypeHighlight]}
              >
                {m.content}
              </ReactMarkdown>
              {m.role === "assistant" && m.content && !busy && (
                <nav>
                  <button
                    aria-label={t("کپی", "Copy", "Kopieren", "Kopyala")}
                    onClick={() =>
                      void navigator.clipboard.writeText(m.content)
                    }
                  >
                    <Copy size={15} />
                  </button>
                  {session?.authenticated && (
                    <>
                      <button
                        aria-label={t(
                          "تولید مجدد",
                          "Regenerate",
                          "Neu generieren",
                          "Yeniden oluştur",
                        )}
                        onClick={() => void edit(index, true)}
                      >
                        <RotateCcw size={15} />
                      </button>
                      {m.requestId &&
                        [1, -1].map((v) => (
                          <button
                            key={v}
                            aria-label={v === 1 ? "Helpful" : "Not helpful"}
                            onClick={() =>
                              void action("feedback", m.requestId!, {
                                value: v,
                              })
                            }
                          >
                            {v === 1 ? (
                              <ThumbsUp size={15} />
                            ) : (
                              <ThumbsDown size={15} />
                            )}
                          </button>
                        ))}
                    </>
                  )}
                </nav>
              )}
              {m.role === "user" && m.id && session?.authenticated && !busy && (
                <button
                  aria-label={t("ویرایش", "Edit", "Bearbeiten", "Düzenle")}
                  onClick={() => void edit(index)}
                >
                  <Pencil size={14} />
                </button>
              )}
              {m.role === "assistant" &&
                m.requestId &&
                index === messages.length - 1 &&
                !busy &&
                session?.discoveryEnabled && (
                  <DiscoveryCard requestId={m.requestId} />
                )}
            </article>
          ))}
          {busy && (
            <p role="status" aria-live="polite">
              {t(
                "در حال پاسخ…",
                "Responding…",
                "Antwort wird erstellt…",
                "Yanıtlanıyor…",
              )}
            </p>
          )}
          {error && (
            <p role="alert" className="chat-error">
              {genericError}
            </p>
          )}
          <div ref={bottom} />
        </div>
        <form
          className="chat-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <textarea
            ref={composer}
            aria-label={t(
              "پیام شما",
              "Your message",
              "Ihre Nachricht",
              "Mesajınız",
            )}
            placeholder={t(
              "هر سؤالی داری بپرس…",
              "Ask anything…",
              "Stellen Sie Ihre Frage…",
              "İstediğini sor…",
            )}
            maxLength={2000}
            rows={2}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              try {
                sessionStorage.setItem("aifekr-chat-draft", e.target.value);
              } catch {}
            }}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                void send();
              }
            }}
          />
          {busy ? (
            <button
              type="button"
              aria-label={t("توقف", "Stop", "Stoppen", "Durdur")}
              onClick={() => abort.current?.abort()}
            >
              <Square size={20} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!session || !draft.trim()}
              aria-label={t("ارسال", "Send", "Senden", "Gönder")}
            >
              <Send size={20} />
            </button>
          )}
          <small>
            {session?.authenticated
              ? session.remaining > 0
                ? t(
                    "این پیام از سهمیه رایگان روزانه است.",
                    "This message uses your daily free allowance.",
                    "Diese Nachricht nutzt Ihr tägliches Freikontingent.",
                    "Bu mesaj günlük ücretsiz hakkınızı kullanır.",
                  )
                : `${session.creditsPerTurn} ${t("کردیت برای هر پیام موفق", "credits per successful message", "Credits pro erfolgreicher Nachricht", "başarılı mesaj başına kredi")} · ${session.credits} ${t("موجودی", "balance", "Guthaben", "bakiye")}`
              : t(
                  "سه پیام مهمان. برای ادامه ثبت‌نام کنید.",
                  "Three guest messages. Sign up to continue.",
                  "Drei Gastnachrichten. Zum Fortfahren registrieren.",
                  "Üç misafir mesajı. Devam etmek için kaydolun.",
                )}{" "}
            ·{" "}
            {t(
              "AI ممکن است اشتباه کند.",
              "AI can make mistakes.",
              "KI kann Fehler machen.",
              "AI hata yapabilir.",
            )}
          </small>
        </form>
      </section>
      {auth && (
        <div className="chat-dialog-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="chat-auth-title"
            className="chat-auth-dialog"
          >
            <button
              aria-label={t("بستن", "Close", "Schließen", "Kapat")}
              onClick={() => setAuth(false)}
            >
              <X size={20} />
            </button>
            <h2 id="chat-auth-title">
              {t(
                "برای ادامه ثبت‌نام کن",
                "Sign up to continue",
                "Registrieren und fortfahren",
                "Devam etmek için kaydol",
              )}
            </h2>
            <p>
              {t(
                "گفتگو و متن آماده‌ات حفظ می‌شود؛ خرید ماژول لازم نیست.",
                "Your conversation and draft are preserved. No module purchase required.",
                "Chat und Entwurf bleiben erhalten. Kein Modulkauf erforderlich.",
                "Sohbetin ve taslağın korunur. Modül satın almak gerekmez.",
              )}
            </p>
            <Link href="/register?entry=chat">
              {t(
                "ساخت حساب رایگان",
                "Create free account",
                "Kostenloses Konto erstellen",
                "Ücretsiz hesap oluştur",
              )}
            </Link>
            <Link href="/login?redirect=%2Fchat">
              {t("ورود به حساب", "Log in", "Anmelden", "Giriş yap")}
            </Link>
          </section>
        </div>
      )}
    </div>
  );
}
