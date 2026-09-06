"use client";

import { useState, useRef, useEffect, type CSSProperties } from "react";
import { Calendar } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { tri } from "@/lib/i18n/tri";

// This component used to render a Jalali calendar with Persian month names to
// every user regardless of language, so an English or German user scheduling
// an Instagram post was asked to pick a date like "۱۵ مهر ۱۴۰۵" — unreadable,
// and not a date they could map to their own calendar. The calendar system now
// follows the UI language: Jalali for Persian, Gregorian for English/German.

const JMONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const JWEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
// Gregorian weeks start Monday in both en-GB-style and German usage here; the
// grid below computes its lead offset from `weekStart` so the two calendars
// share one layout.
const GWEEKDAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const GWEEKDAYS_DE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const pad = (n: number) => String(n).padStart(2, "0");

// datetime-local inputs use a plain "YYYY-MM-DDTHH:mm" local string (no timezone) — keep the
// same wire format so the rest of the app (API payloads, native-input fallback) stays untouched.
function toLocalInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function jalaliParts(d: Date): { y: number; m: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-persian", { year: "numeric", month: "numeric", day: "numeric" }).formatToParts(d);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value || "0", 10);
  return { y: get("year"), m: get("month"), day: get("day") };
}

function gregorianParts(d: Date): { y: number; m: number; day: number } {
  return { y: d.getFullYear(), m: d.getMonth() + 1, day: d.getDate() };
}

export default function JalaliDateTimePicker({
  value,
  onChange,
  className,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  style?: CSSProperties;
}) {
  const { lang } = useTranslation();
  const isFa = lang === "fa";
  const rtl = isFa;

  const parts = isFa ? jalaliParts : gregorianParts;
  const monthName = (m: number, y: number) =>
    isFa ? `${JMONTHS[m - 1]} ${y}` : new Date(y, m - 1, 1).toLocaleDateString(lang === "de" ? "de-DE" : "en-US", { month: "long", year: "numeric" });
  const weekdays = tri(lang, JWEEKDAYS, GWEEKDAYS_EN, GWEEKDAYS_DE);

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = value ? new Date(value) : null;
  const [anchor, setAnchor] = useState<Date>(selected || new Date());
  const [hour, setHour] = useState((selected || new Date()).getHours());
  const [minute, setMinute] = useState((selected || new Date()).getMinutes());

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // First day of the displayed month, in whichever calendar is active.
  const first = (() => {
    const { day } = parts(anchor);
    const d = new Date(anchor);
    d.setDate(d.getDate() - (day - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  const { y, m } = parts(anchor);

  const numDays = (() => {
    const target = parts(first).m;
    let count = 0;
    const d = new Date(first);
    while (parts(d).m === target) {
      count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  })();

  // Persian weeks start Saturday (getDay 6), Gregorian ones Monday (getDay 1).
  const leadOffset = isFa ? (first.getDay() + 1) % 7 : (first.getDay() + 6) % 7;

  function changeMonth(delta: number) {
    const d = new Date(first);
    d.setDate(d.getDate() + (delta > 0 ? numDays : -1));
    setAnchor(d);
  }

  function selectDay(dayNum: number) {
    const d = new Date(first);
    d.setDate(d.getDate() + (dayNum - 1));
    d.setHours(hour, minute, 0, 0);
    onChange(toLocalInputValue(d));
  }

  const selectedParts = selected ? parts(selected) : null;
  const displayLabel = selectedParts
    ? `${selectedParts.y}/${pad(selectedParts.m)}/${pad(selectedParts.day)} ${pad(selected!.getHours())}:${pad(selected!.getMinutes())}`
    : tri(lang, "انتخاب تاریخ و ساعت", "Pick date and time", "Datum und Uhrzeit wählen");

  return (
    <div ref={containerRef} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={className} style={style}>
        <Calendar className={`w-3.5 h-3.5 inline-block -mt-0.5 ${rtl ? "ml-1.5" : "mr-1.5"}`} />
        {displayLabel}
      </button>
      {open && (
        <div
          className="absolute z-50 mt-1 p-3 rounded-xl shadow-lg"
          style={{ background: "var(--surface-1)", border: "1px solid var(--border)", minWidth: 260, [rtl ? "right" : "left"]: 0 }}
        >
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => changeMonth(-1)} className="w-6 h-6 rounded-md" style={{ color: "var(--text-secondary)" }} aria-label={tri(lang, "ماه قبل", "Previous month", "Vorheriger Monat")}>‹</button>
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{monthName(m, y)}</span>
            <button type="button" onClick={() => changeMonth(1)} className="w-6 h-6 rounded-md" style={{ color: "var(--text-secondary)" }} aria-label={tri(lang, "ماه بعد", "Next month", "Nächster Monat")}>›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-[10px] text-center mb-1" style={{ color: "var(--text-muted)" }}>
            {weekdays.map((w, i) => <div key={i}>{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: leadOffset }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: numDays }).map((_, i) => {
              const dayNum = i + 1;
              const isSelected = selectedParts && selectedParts.y === y && selectedParts.m === m && selectedParts.day === dayNum;
              return (
                <button
                  type="button"
                  key={dayNum}
                  onClick={() => selectDay(dayNum)}
                  className="w-7 h-7 rounded-md text-xs"
                  style={{ background: isSelected ? "var(--primary)" : "transparent", color: isSelected ? "white" : "var(--text-primary)" }}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <select
              value={hour}
              onChange={(e) => {
                const h = parseInt(e.target.value, 10);
                setHour(h);
                if (selected) { const d = new Date(selected); d.setHours(h, minute, 0, 0); onChange(toLocalInputValue(d)); }
              }}
              className="text-xs px-1 py-1 rounded"
              style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}
              aria-label={tri(lang, "ساعت", "Hour", "Stunde")}
            >
              {Array.from({ length: 24 }).map((_, h) => <option key={h} value={h}>{pad(h)}</option>)}
            </select>
            :
            <select
              value={minute}
              onChange={(e) => {
                const m2 = parseInt(e.target.value, 10);
                setMinute(m2);
                if (selected) { const d = new Date(selected); d.setHours(hour, m2, 0, 0); onChange(toLocalInputValue(d)); }
              }}
              className="text-xs px-1 py-1 rounded"
              style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}
              aria-label={tri(lang, "دقیقه", "Minute", "Minute")}
            >
              {Array.from({ length: 60 }).map((_, m2) => <option key={m2} value={m2}>{pad(m2)}</option>)}
            </select>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={`text-xs px-2.5 py-1 rounded-md text-white ${rtl ? "mr-auto" : "ml-auto"}`}
              style={{ background: "var(--primary)" }}
            >
              {tri(lang, "تایید", "Done", "Fertig")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
