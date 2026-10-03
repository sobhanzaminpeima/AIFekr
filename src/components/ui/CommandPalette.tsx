"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useTranslation, tri } from "@/lib/i18n";
import { destinations, destinationLabel } from "@/lib/navigation/destinations";

// Custom event name pages can dispatch to open the palette from their own
// header (e.g. a compact icon button next to page-specific controls)
// without duplicating the modal or its keyboard-shortcut listener.
export const OPEN_COMMAND_PALETTE_EVENT = "aifekr:open-command-palette";

export default function CommandPalette({ hideTrigger = false }: { hideTrigger?: boolean }) {
  const router = useRouter();
  const { lang } = useTranslation();
  const isFa = lang === "fa";
  const ITEMS = destinations.map(item => ({ href: item[0], label: destinationLabel(item, lang), search: item.join(" ") }));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
      inputRef.current?.focus();
      setSelected(0);
    } else {
      dialogRef.current?.close();
      setQuery("");
    }
  }, [open]);
  useEffect(() => { setSelected(0); }, [query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    function onExternalOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onExternalOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onExternalOpen);
    };
  }, []);

  const filtered = ITEMS.filter((i) => i.search.toLowerCase().includes(query.toLowerCase()));

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <>
      {!hideTrigger && (
        <button
          ref={triggerRef}
          aria-haspopup="dialog"
          aria-label={tri(lang, "جستجوی بخش‌های پلتفرم", "Search platform", "Plattform durchsuchen", "Platformda ara")}
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm transition-colors min-w-[160px]"
          style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
        >
          <Search className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1 text-start truncate">{tri(lang, "جستجو...", "Search...", "Suchen...", "Ara...")}</span>
          <kbd className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "var(--surface-2)" }}>Ctrl K</kbd>
        </button>
      )}

        <dialog
          ref={dialogRef}
          className="command-dialog"
          aria-label={tri(lang, "جستجوی بخش‌های پلتفرم", "Search platform", "Plattform durchsuchen", "Platformda ara")}
          onCancel={() => setOpen(false)}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
          dir={isFa ? "rtl" : "ltr"}
        >
          <div
            className="w-full rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <Search className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <input
                ref={inputRef}
                aria-label={tri(lang, "نام بخش یا ابزار", "Section or tool name", "Bereich oder Werkzeug", "Bölüm veya araç adı")}
                aria-controls="command-results"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    const next = filtered.length ? (selected + (e.key === "ArrowDown" ? 1 : -1) + filtered.length) % filtered.length : 0;
                    setSelected(next);
                    document.getElementById(`command-result-${next}`)?.scrollIntoView({ block: "nearest" });
                  }
                  if (e.key === "Enter" && filtered[selected]) { e.preventDefault(); go(filtered[selected].href); }
                }}
                placeholder={tri(lang, "کجا می‌خواهید بروید؟", "Where do you want to go?", "Wohin möchten Sie gehen?", "Nereye gitmek istiyorsunuz?")}
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: "var(--text-primary)" }}
              />
            </div>
            <div id="command-results" className="max-h-80 overflow-y-auto py-1.5">
              {filtered.map(({ href, label }, index) => (
                <button
                  id={`command-result-${index}`}
                  key={href}
                  onClick={() => go(href)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:opacity-80"
                  style={{ color: index === selected ? "var(--text-primary)" : "var(--text-secondary)", background: index === selected ? "var(--surface-2)" : "transparent" }}
                >
                  <Search className="w-4 h-4 flex-shrink-0" style={{ color: "var(--primary)" }} />
                  {label}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-4 py-6 text-sm text-center" style={{ color: "var(--text-muted)" }}>
                  {tri(lang, "چیزی یافت نشد.", "No matches.", "Keine Treffer.", "Eşleşme yok.")}
                </p>
              )}
            </div>
          </div>
        </dialog>
    </>
  );
}
