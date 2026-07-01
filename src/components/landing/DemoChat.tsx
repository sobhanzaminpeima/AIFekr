"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface Message {
  role: "user" | "ai";
  text: string;
  delay: number; // ms after previous message finishes
}

const DEMO_FA: Message[] = [
  { role: "user", text: "سلام! می‌تونی یه استراتژی بازاریابی برای کافه جدیدم بنویسی؟", delay: 600 },
  { role: "ai", text: "سلام! حتماً 😊 برای کافه جدیدت پیشنهاد می‌کنم از ۳ محور اصلی شروع کنی:\n\n**۱. اینستاگرام** — روزانه ۱ پست از پشت‌صحنه، منو و فضای کافه\n**۲. گوگل مپ** — پروفایل کامل با عکس‌های باکیفیت و دعوت از اولین مشتری‌ها برای نظر\n**۳. تخفیف افتتاحیه** — ۲۰٪ تخفیف برای هفته اول + یه چالش اشتراک‌گذاری در شبکه‌های اجتماعی\n\nمی‌خوای هر کدوم رو بیشتر توضیح بدم؟", delay: 800 },
  { role: "user", text: "عالیه! محتوای اینستاگرام رو بیشتر توضیح بده", delay: 700 },
  { role: "ai", text: "برای اینستاگرام کافه‌ات این تقویم محتوایی رو پیشنهاد می‌دم:\n\n🟠 **شنبه** — پشت صحنه: آماده‌سازی قهوه\n🔵 **یکشنبه** — معرفی منو با عکس حرفه‌ای\n🟢 **دوشنبه** — نظر مشتری (user-generated content)\n🟡 **سه‌شنبه** — تیپس قهوه (آموزشی)\n🔴 **چهارشنبه** — پیشنهاد ویژه روز\n\nهر پست باید حداقل ۵ هشتگ مرتبط داشته باشه. می‌خوای لیست هشتگ‌ها رو هم بهت بدم؟", delay: 800 },
  { role: "user", text: "آره لطفاً! و یه اسم جذاب هم برای کافه پیشنهاد بده", delay: 600 },
  { role: "ai", text: "🏷️ **هشتگ‌های پیشنهادی:**\n#کافه #قهوه #کافه_تهران #صبحانه #کافی‌شاپ #coffee #cafe #coffeelover #barista #espresso\n\n☕ **پیشنهاد اسم:**\n• **کاج کافه** — طبیعی و ماندگار\n• **لحظه** — احساسی و مدرن  \n• **آذین** — شیک و ایرانی\n• **دِم** — مختصر، یادماندنی، مرتبط به دم کردن\n• **روژه** — اروپایی، جذاب برای نسل جوان\n\nاگه فضا مدرن و مینیمال داری، «دِم» یا «لحظه» بهترینه! 🎯", delay: 900 },
];

const DEMO_EN: Message[] = [
  { role: "user", text: "Hi! Can you write a marketing strategy for my new café?", delay: 600 },
  { role: "ai", text: "Hey! Absolutely 😊 I'd recommend starting with 3 key pillars:\n\n**1. Instagram** — Post 1 piece of daily content: behind-the-scenes, menu items & café ambiance\n**2. Google Maps** — Complete your profile with high-quality photos and invite early customers to leave reviews\n**3. Launch Offer** — 20% discount for week one + a social sharing challenge\n\nWant me to go deeper on any of these?", delay: 800 },
  { role: "user", text: "Great! Tell me more about the Instagram content strategy", delay: 700 },
  { role: "ai", text: "Here's a weekly content calendar for your café:\n\n🟠 **Monday** — Behind-the-scenes: coffee preparation\n🔵 **Tuesday** — Menu spotlight with professional photo\n🟢 **Wednesday** — Customer review (user-generated content)\n🟡 **Thursday** — Coffee tips (educational)\n🔴 **Friday** — Weekend special offer\n\nEach post should have at least 5 relevant hashtags. Want me to generate your hashtag list too?", delay: 800 },
  { role: "user", text: "Yes please! And suggest a catchy name for the café", delay: 600 },
  { role: "ai", text: "🏷️ **Suggested Hashtags:**\n#cafe #coffee #coffeeshop #barista #espresso #coffeelovers #caffeinefix #morningcoffee #specialty coffee #latteart\n\n☕ **Name Ideas:**\n• **The Grind** — Simple, memorable, on-brand\n• **Ember Café** — Warm, modern, unique\n• **Brew & Co.** — Trendy, professional\n• **First Light** — Evokes morning energy\n• **Common Ground** — Community feel, double meaning\n\nIf your vibe is modern & minimal, **Ember** or **First Light** are your best bets! 🎯", delay: 900 },
];

function parseMarkdown(text: string) {
  return text
    .split("\n")
    .map((line, i) => {
      const boldReplaced = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      return <span key={i} dangerouslySetInnerHTML={{ __html: boldReplaced + (i < text.split("\n").length - 1 ? "<br/>" : "") }} />;
    });
}

const TYPING_SPEED = 18; // ms per character

export default function DemoChat({ lang = "fa" }: { lang?: "fa" | "en" }) {
  const DEMO = lang === "en" ? DEMO_EN : DEMO_FA;
  const [visibleMessages, setVisibleMessages] = useState<{ role: "user" | "ai"; text: string; typing: boolean }[]>([]);
  const [currentTyped, setCurrentTyped] = useState("");
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [msgIndex, setMsgIndex] = useState(0);
  const chatRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && phase === "idle") {
          setPhase("running");
        }
      },
      { threshold: 0.3 }
    );
    if (containerRef.current) observerRef.current.observe(containerRef.current);
    return () => observerRef.current?.disconnect();
  }, [phase]);

  useEffect(() => {
    if (phase !== "running") return;
    if (msgIndex >= DEMO.length) { setPhase("done"); return; }

    const msg = DEMO[msgIndex];

    const delayTimer = setTimeout(() => {
      if (msg.role === "user") {
        setVisibleMessages(prev => [...prev, { role: "user", text: msg.text, typing: false }]);
        setMsgIndex(i => i + 1);
      } else {
        // Show typing indicator first
        setVisibleMessages(prev => [...prev, { role: "ai", text: "", typing: true }]);
        let charIndex = 0;
        setCurrentTyped("");

        const typeInterval = setInterval(() => {
          charIndex++;
          setCurrentTyped(msg.text.slice(0, charIndex));
          if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
          if (charIndex >= msg.text.length) {
            clearInterval(typeInterval);
            setCurrentTyped("");
            setVisibleMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: "ai", text: msg.text, typing: false };
              return updated;
            });
            setMsgIndex(i => i + 1);
          }
        }, TYPING_SPEED);
      }
    }, msg.delay);

    return () => clearTimeout(delayTimer);
  }, [phase, msgIndex]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [visibleMessages, currentTyped]);

  const isRtl = lang === "fa";
  const label = lang === "fa"
    ? { title: "همین الان امتحان کن", subtitle: "چت هوش مصنوعی — مثل ChatGPT", cta: "شروع رایگان", typing: "AiFekr در حال تایپ..." }
    : { title: "Try it now", subtitle: "AI Chat — just like ChatGPT", cta: "Get Started Free", typing: "AiFekr is typing..." };

  return (
    <section ref={containerRef} className="py-16 px-6 relative" dir={isRtl ? "rtl" : "ltr"}>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-4" style={{ background: "rgba(234,88,12,0.15)", color: "#ea580c", border: "1px solid rgba(234,88,12,0.3)" }}>
            {label.subtitle}
          </span>
          <h2 className="text-3xl font-bold text-white">{label.title}</h2>
        </div>

        {/* Chat window */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 24px 80px rgba(234,88,12,0.15)" }}>
          {/* Window chrome */}
          <div className="flex items-center justify-between px-4 py-3" style={{ background: "#0e0e14", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ background: "#ff5f57" }} />
              <span className="w-3 h-3 rounded-full" style={{ background: "#febc2e" }} />
              <span className="w-3 h-3 rounded-full" style={{ background: "#28c840" }} />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#ea580c" }} />
              <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>AiFekr AI Chat</span>
            </div>
            <div className="w-16" />
          </div>

          {/* Messages */}
          <div ref={chatRef} className="p-5 space-y-4 overflow-y-auto" style={{ minHeight: "340px", maxHeight: "420px" }}>
            {visibleMessages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === "user" ? (isRtl ? "flex-row-reverse" : "flex-row-reverse") : "flex-row"}`}
                style={{ animation: "fadeSlideIn 0.3s ease" }}>
                {/* Avatar */}
                <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-sm"
                  style={{
                    background: msg.role === "ai" ? "linear-gradient(135deg, #ea580c, #f97316)" : "rgba(255,255,255,0.1)",
                    border: msg.role === "ai" ? "none" : "1px solid rgba(255,255,255,0.15)",
                  }}>
                  {msg.role === "ai" ? "✦" : "👤"}
                </div>

                {/* Bubble */}
                <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === "user" ? (isRtl ? "rounded-tr-sm" : "rounded-tl-sm") : (isRtl ? "rounded-tl-sm" : "rounded-tr-sm")}`}
                  style={{
                    background: msg.role === "user" ? "rgba(234,88,12,0.18)" : "rgba(255,255,255,0.06)",
                    border: msg.role === "user" ? "1px solid rgba(234,88,12,0.3)" : "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.9)",
                    direction: isRtl ? "rtl" : "ltr",
                  }}>
                  {msg.typing ? (
                    currentTyped ? (
                      <span style={{ whiteSpace: "pre-wrap" }}>{parseMarkdown(currentTyped)}</span>
                    ) : (
                      <span className="flex gap-1 items-center py-1">
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#ea580c", animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#ea580c", animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#ea580c", animationDelay: "300ms" }} />
                      </span>
                    )
                  ) : (
                    <span style={{ whiteSpace: "pre-wrap" }}>{parseMarkdown(msg.text)}</span>
                  )}
                </div>
              </div>
            ))}

            {/* Waiting indicator */}
            {phase === "idle" && (
              <div className="flex items-center justify-center py-10" style={{ color: "rgba(255,255,255,0.3)" }}>
                <span className="text-sm">{isRtl ? "اسکرول کن تا ببینی..." : "Scroll to see the demo..."}</span>
              </div>
            )}
          </div>

          {/* Fake input bar */}
          <div className="px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "#0e0e14" }}>
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="flex-1 text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>
                {isRtl ? "پیام خود را بنویسید..." : "Type your message..."}
              </span>
              <Link href="/register"
                className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #ea580c, #f97316)" }}>
                {label.cta} →
              </Link>
            </div>
          </div>
        </div>

        {/* Restart */}
        {phase === "done" && (
          <div className="text-center mt-4">
            <button onClick={() => { setVisibleMessages([]); setMsgIndex(0); setCurrentTyped(""); setPhase("idle"); setTimeout(() => setPhase("running"), 100); }}
              className="text-xs px-4 py-2 rounded-xl transition-all"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {isRtl ? "▶ پخش مجدد دمو" : "▶ Replay Demo"}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
