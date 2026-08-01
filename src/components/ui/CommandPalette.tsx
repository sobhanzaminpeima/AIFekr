"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare, Image as ImageIcon, Video, Music, GalleryHorizontal,
  Stethoscope, Users as UsersIcon, Globe2, Share2, Rocket, Settings,
  Crown, Gift, Search, TrendingUp,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const ITEMS_FA = [
  { href: "/chat", label: "چت هوش مصنوعی", icon: MessageSquare },
  { href: "/business-doctor", label: "دکتر کسب‌وکار", icon: Stethoscope },
  { href: "/ceo", label: "مشاور مدیرعامل", icon: TrendingUp },
  { href: "/seo", label: "سئو", icon: Globe2 },
  { href: "/social", label: "شبکه‌های اجتماعی", icon: Share2 },
  { href: "/website-designer", label: "طراح وبسایت", icon: Globe2 },
  { href: "/startup/builder", label: "سازنده استارتاپ", icon: Rocket },
  { href: "/image/generate", label: "ساخت تصویر", icon: ImageIcon },
  { href: "/video/generate", label: "ساخت ویدیو", icon: Video },
  { href: "/music/generate", label: "ساخت موزیک", icon: Music },
  { href: "/image/gallery", label: "گالری من", icon: GalleryHorizontal },
  { href: "/meeting", label: "اتاق جلسه", icon: UsersIcon },
  { href: "/industry", label: "بسته‌های کسب‌وکار", icon: Crown },
  { href: "/referral", label: "دعوت و اعتبار", icon: Gift },
  { href: "/plans", label: "پلن‌ها", icon: Crown },
  { href: "/settings", label: "تنظیمات", icon: Settings },
];

const ITEMS_EN = [
  { href: "/chat", label: "AI Chat", icon: MessageSquare },
  { href: "/business-doctor", label: "Business Doctor", icon: Stethoscope },
  { href: "/ceo", label: "CEO Advisor", icon: TrendingUp },
  { href: "/seo", label: "SEO", icon: Globe2 },
  { href: "/social", label: "Social Media", icon: Share2 },
  { href: "/website-designer", label: "Website Designer", icon: Globe2 },
  { href: "/startup/builder", label: "Startup Builder", icon: Rocket },
  { href: "/image/generate", label: "Generate Image", icon: ImageIcon },
  { href: "/video/generate", label: "Generate Video", icon: Video },
  { href: "/music/generate", label: "Generate Music", icon: Music },
  { href: "/image/gallery", label: "My Gallery", icon: GalleryHorizontal },
  { href: "/meeting", label: "Meeting Room", icon: UsersIcon },
  { href: "/industry", label: "Business Plans", icon: Crown },
  { href: "/referral", label: "Invite & Earn", icon: Gift },
  { href: "/plans", label: "Plans", icon: Crown },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function CommandPalette() {
  const router = useRouter();
  const { lang } = useTranslation();
  const isFa = lang !== "en";
  const ITEMS = isFa ? ITEMS_FA : ITEMS_EN;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = ITEMS.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()));

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm transition-colors min-w-[160px]"
        style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
      >
        <Search className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="flex-1 text-right truncate">{isFa ? "جستجو..." : "Search..."}</span>
        <kbd className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "var(--surface-2)" }}>⌘K</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-32 px-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setOpen(false)}
          dir={isFa ? "rtl" : "ltr"}
        >
          <div
            className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <Search className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && filtered[0] && go(filtered[0].href)}
                placeholder={isFa ? "کجا می‌خواهید بروید؟" : "Where do you want to go?"}
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: "var(--text-primary)" }}
              />
            </div>
            <div className="max-h-80 overflow-y-auto py-1.5">
              {filtered.map(({ href, label, icon: Icon }) => (
                <button
                  key={href}
                  onClick={() => go(href)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:opacity-80"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" style={{ color: "var(--primary)" }} />
                  {label}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-4 py-6 text-sm text-center" style={{ color: "var(--text-muted)" }}>
                  {isFa ? "چیزی یافت نشد." : "No matches."}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
