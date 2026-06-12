"use client";

/* Eventful DatePicker (TypeScript port of boxy-system/components/forms/DatePicker.jsx)
   Calendar popover, Monday-first grid, plum-filled selection, hard stacked shadow.
   value / onChange use ISO 'YYYY-MM-DD'. */

import { useState, useRef, useEffect, useMemo } from "react";
import Icon from "@/components/Icon";

let injected = false;
function injectStyles() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const css = `
  .ev-dp{ position:relative; display:flex; flex-direction:column; gap:6px; font-family:var(--font-body); }
  .ev-dp__label{ font-size:var(--fs-sm); font-weight:var(--fw-semibold); color:var(--text-strong); }
  .ev-dp__field{ display:flex; align-items:center; gap:10px; cursor:pointer;
    background:var(--surface); border:2px solid var(--border); border-radius:14px;
    padding:10px 14px; box-shadow:2px 2px 0 var(--shadow-edge);
    transition:border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out); }
  .ev-dp__field:hover{ border-color:var(--lilac); box-shadow:3px 3px 0 var(--lilac), 6px 6px 0 var(--shadow-edge); }
  .ev-dp.is-open .ev-dp__field{ border-color:var(--brand); box-shadow:3px 3px 0 var(--lilac), 6px 6px 0 var(--shadow-edge); }
  .ev-dp__field svg{ width:18px; height:18px; color:var(--lilac); flex-shrink:0; }
  .ev-dp__val{ flex:1; font-size:var(--fs-body); color:var(--text-body); }
  .ev-dp__val.is-empty{ color:var(--text-subtle); }
  .ev-dp__pop{ position:absolute; top:calc(100% + 8px); left:0; z-index:400;
    width:300px; background:var(--surface); border:2px solid var(--border-strong);
    border-radius:20px; box-shadow:4px 4px 0 var(--lilac), 8px 8px 0 var(--shadow-edge); padding:16px;
    animation:evdp-in 0.225s cubic-bezier(0.22,1,0.36,1); }
  @keyframes evdp-in{ from{ opacity:0; transform:translateY(-4px); } }
  .ev-dp__head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
  .ev-dp__mon{ font-family:var(--font-display); font-weight:700; font-size:var(--fs-title); color:var(--text-strong); cursor:default; }
  .ev-dp__nav{ display:flex; gap:6px; }
  .ev-dp__navbtn{ width:30px; height:30px; display:grid; place-items:center; cursor:pointer;
    background:var(--surface); color:var(--text-strong); border:2px solid var(--border-strong);
    border-radius:10px; box-shadow:1px 1px 0 var(--shadow-edge);
    transition:box-shadow 0.225s var(--ease-out), transform 0.225s var(--ease-out); }
  .ev-dp__navbtn:hover{ box-shadow:2px 2px 0 var(--shadow-edge); transform:translate(-1px,-1px); }
  .ev-dp__navbtn:active{ box-shadow:none; transform:translate(1px,1px); }
  .ev-dp__navbtn svg{ width:15px; height:15px; }
  .ev-dp__grid{ display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
  .ev-dp__wd{ font-family:var(--font-mono); font-size:10px; letter-spacing:.06em; text-transform:uppercase;
    color:var(--text-subtle); text-align:center; padding:4px 0 8px; }
  .ev-dp__day{ aspect-ratio:1; display:grid; place-items:center; cursor:pointer; border:none; background:transparent;
    font-family:var(--font-body); font-size:var(--fs-sm); color:var(--text-body); border-radius:10px;
    transition:background 0.225s var(--ease-out), color 0.225s var(--ease-out); }
  .ev-dp__day:hover{ background:var(--brand-soft); color:var(--brand); }
  .ev-dp__day.is-muted{ color:var(--text-subtle); opacity:.45; }
  .ev-dp__day.is-today{ box-shadow:inset 0 0 0 1.5px var(--lilac); }
  .ev-dp__day.is-selected{ background:var(--brand); color:var(--text-on-brand); font-weight:600; }
  .ev-dp__day:disabled{ opacity:.3; cursor:not-allowed; }
  .ev-dp__foot{ display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding-top:12px;
    border-top:1px solid var(--border); }
  .ev-dp__quick{ font-family:var(--font-body); font-size:var(--fs-sm); font-weight:600;
    color:var(--brand); background:none; border:none; cursor:pointer; padding:4px 8px; border-radius:6px; }
  .ev-dp__quick:hover{ background:var(--brand-soft); }
  .ev-dp__scrim{ position:fixed; inset:0; z-index:399; }`;
  const el = document.createElement("style");
  el.id = "ev-datepicker-styles";
  el.textContent = css;
  document.head.appendChild(el);
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WD = ["Mo","Tu","We","Th","Fr","Sa","Su"];
const WD_FULL = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseIso = (s: string) => { if (!s) return null; const [y, m, day] = s.split("-").map(Number); return new Date(y, m - 1, day); };
const fmtDisplay = (d: Date) => `${WD_FULL[(d.getDay() + 6) % 7]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;

interface DatePickerProps {
  label?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (iso: string) => void;
  min?: string;
  placeholder?: string;
  className?: string;
}

export function DatePicker({ label, value, defaultValue, onChange, min, placeholder = "Select a date", className = "" }: DatePickerProps) {
  injectStyles();
  const isControlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = isControlled ? (value ?? "") : inner;
  const selected = parseIso(current);
  const [open, setOpen] = useState(false);
  const init = selected ?? new Date();
  const [view, setView] = useState({ y: init.getFullYear(), m: init.getMonth() });
  const minDate = min ? parseIso(min) : null;
  const ref = useRef<HTMLDivElement>(null);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  useEffect(() => {
    if (open && selected) setView({ y: selected.getFullYear(), m: selected.getMonth() });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const startDow = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const arr: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(view.y, view.m, d));
    return arr;
  }, [view]);

  function pick(d: Date) {
    const iso = toIso(d);
    if (!isControlled) setInner(iso);
    onChange?.(iso);
    setOpen(false);
  }
  function shift(n: number) {
    setView(v => { const m = v.m + n; return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }; });
  }

  return (
    <div ref={ref} className={["ev-dp", open ? "is-open" : "", className].filter(Boolean).join(" ")}>
      {label && <span className="ev-dp__label">{label}</span>}
      <div
        className="ev-dp__field" role="button" tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(o => !o); } }}
      >
        <Icon name="calendar-days" />
        <span className={"ev-dp__val" + (selected ? "" : " is-empty")}>
          {selected ? fmtDisplay(selected) : placeholder}
        </span>
      </div>
      {open && (
        <>
          <div className="ev-dp__scrim" onClick={() => setOpen(false)} />
          <div className="ev-dp__pop" role="dialog" aria-label="Choose date">
            <div className="ev-dp__head">
              <span className="ev-dp__mon">{MONTHS[view.m]} {view.y}</span>
              <div className="ev-dp__nav">
                <button type="button" className="ev-dp__navbtn" aria-label="Previous month" onClick={() => shift(-1)}><Icon name="chevron-left" /></button>
                <button type="button" className="ev-dp__navbtn" aria-label="Next month" onClick={() => shift(1)}><Icon name="chevron-right" /></button>
              </div>
            </div>
            <div className="ev-dp__grid">
              {WD.map(w => <span key={w} className="ev-dp__wd">{w}</span>)}
              {cells.map((d, i) => {
                if (!d) return <span key={"e" + i} />;
                const dis = !!(minDate && d < minDate);
                const isSel = !!(selected && toIso(d) === toIso(selected));
                const isToday = d.getTime() === today.getTime();
                return (
                  <button
                    key={toIso(d)} type="button" disabled={dis}
                    className={["ev-dp__day", isSel ? "is-selected" : "", isToday ? "is-today" : ""].filter(Boolean).join(" ")}
                    onClick={() => pick(d)}
                  >{d.getDate()}</button>
                );
              })}
            </div>
            <div className="ev-dp__foot">
              <button type="button" className="ev-dp__quick" onClick={() => pick(new Date())}>Today</button>
              <button type="button" className="ev-dp__quick" onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default DatePicker;
