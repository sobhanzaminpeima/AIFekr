"use client";

import { useState, useRef, useEffect, type CSSProperties } from "react";
import { Calendar } from "lucide-react";

const JMONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const JWEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

const pad = (n: number) => String(n).padStart(2, "0");

// datetime-local inputs use a plain "YYYY-MM-DDTHH:mm" local string (no timezone) — keep the
// same wire format so the rest of the app (API payloads, native-input fallback) stays untouched.
function toLocalInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function jalaliParts(d: Date): { jy: number; jm: number; jd: number } {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-persian", { year: "numeric", month: "numeric", day: "numeric" }).formatToParts(d);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value || "0", 10);
  return { jy: get("year"), jm: get("month"), jd: get("day") };
}

function firstOfJalaliMonth(anchor: Date): Date {
  const { jd } = jalaliParts(anchor);
  const d = new Date(anchor);
  d.setDate(d.getDate() - (jd - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysInJalaliMonth(firstDay: Date): number {
  const { jm } = jalaliParts(firstDay);
  let count = 0;
  const d = new Date(firstDay);
  while (jalaliParts(d).jm === jm) {
    count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/** Persian-calendar (Jalali) date+time picker, wire-compatible with `<input type="datetime-local">`. */
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

  const first = firstOfJalaliMonth(anchor);
  const { jy, jm } = jalaliParts(anchor);
  const numDays = daysInJalaliMonth(first);
  const leadOffset = (first.getDay() + 1) % 7;

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

  const selectedParts = selected ? jalaliParts(selected) : null;
  const displayLabel = selectedParts
    ? `${selectedParts.jy}/${pad(selectedParts.jm)}/${pad(selectedParts.jd)} ${pad(selected!.getHours())}:${pad(selected!.getMinutes())}`
    : "انتخاب تاریخ و ساعت";

  return (
    <div ref={containerRef} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={className} style={style}>
        <Calendar className="w-3.5 h-3.5 inline-block ml-1.5 -mt-0.5" />
        {displayLabel}
      </button>
      {open && (
        <div
          className="absolute z-50 mt-1 p-3 rounded-xl shadow-lg"
          style={{ background: "var(--surface-1)", border: "1px solid var(--border)", minWidth: 260 }}
        >
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => changeMonth(-1)} className="w-6 h-6 rounded-md" style={{ color: "var(--text-secondary)" }}>‹</button>
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{JMONTHS[jm - 1]} {jy}</span>
            <button type="button" onClick={() => changeMonth(1)} className="w-6 h-6 rounded-md" style={{ color: "var(--text-secondary)" }}>›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-[10px] text-center mb-1" style={{ color: "var(--text-muted)" }}>
            {JWEEKDAYS.map((w, i) => <div key={i}>{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: leadOffset }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: numDays }).map((_, i) => {
              const dayNum = i + 1;
              const isSelected = selectedParts && selectedParts.jy === jy && selectedParts.jm === jm && selectedParts.jd === dayNum;
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
            >
              {Array.from({ length: 24 }).map((_, h) => <option key={h} value={h}>{pad(h)}</option>)}
            </select>
            :
            <select
              value={minute}
              onChange={(e) => {
                const m = parseInt(e.target.value, 10);
                setMinute(m);
                if (selected) { const d = new Date(selected); d.setHours(hour, m, 0, 0); onChange(toLocalInputValue(d)); }
              }}
              className="text-xs px-1 py-1 rounded"
              style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}
            >
              {Array.from({ length: 60 }).map((_, m) => <option key={m} value={m}>{pad(m)}</option>)}
            </select>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mr-auto text-xs px-2.5 py-1 rounded-md text-white"
              style={{ background: "var(--primary)" }}
            >
              تایید
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
