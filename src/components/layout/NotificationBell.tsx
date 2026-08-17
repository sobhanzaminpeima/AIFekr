"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

const POLL_MS = 30000;

function relativeTime(iso: string, t: { minutesAgo: string; hoursAgo: string; daysAgo: string; justNow: string }): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return t.justNow;
  if (minutes < 60) return t.minutesAgo.replace("{n}", String(minutes));
  if (hours < 24) return t.hoursAgo.replace("{n}", String(hours));
  return t.daysAgo.replace("{n}", String(days));
}

export default function NotificationBell({ iconOnly = true }: { iconOnly?: boolean }) {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // silent — this is a background poll, not a user-initiated action
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id }),
      });
    } catch {
      // best-effort — next poll reconciles state
    }
  }

  async function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ all: true }),
      });
    } catch {
      // best-effort — next poll reconciles state
    }
  }

  function handleItemClick(n: NotificationItem) {
    if (!n.isRead) markRead(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  const dir = lang === "en" || lang === "de" ? "ltr" : "rtl";

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={t.notifications.bellTooltip}
        aria-label={t.notifications.bellTooltip}
        className={`relative flex items-center justify-center transition-all ${iconOnly ? "w-8 h-8 rounded-lg" : "gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"}`}
        style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
      >
        <Bell className="w-3.5 h-3.5" />
        {!iconOnly && <span>{t.notifications.bellTooltip}</span>}
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-[3px] flex items-center justify-center rounded-full text-[10px] font-bold"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          dir={dir}
          className="absolute bottom-full z-50 mb-2 w-80 max-h-96 overflow-y-auto rounded-xl shadow-lg"
          style={{
            [dir === "rtl" ? "right" : "left"]: 0,
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-2 sticky top-0"
            style={{ background: "var(--surface-1)", borderBottom: "1px solid var(--border)" }}
          >
            <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
              {t.notifications.bellTooltip}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-medium"
                style={{ color: "var(--primary)" }}
              >
                {t.notifications.markAllRead}
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs" style={{ color: "var(--text-muted)" }}>
              {t.notifications.empty}
            </div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => handleItemClick(n)}
                className="w-full text-start px-3 py-2.5 flex flex-col gap-0.5 transition-colors"
                style={{
                  background: n.isRead ? "transparent" : "rgba(234,88,12,0.08)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div className="flex items-center gap-1.5">
                  {!n.isRead && (
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--primary)" }} />
                  )}
                  <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                    {n.title}
                  </span>
                </div>
                {n.body && (
                  <span className="text-xs line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                    {n.body}
                  </span>
                )}
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {relativeTime(n.createdAt, t.notifications)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
