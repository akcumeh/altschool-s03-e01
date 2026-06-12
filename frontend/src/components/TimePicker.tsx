"use client";

/* Eventful TimePicker (TypeScript port of boxy-system/components/forms/TimePicker.jsx)
   Scrollable list of time slots, plum-selected, hard stacked shadow popover.
   value / onChange use 24h 'HH:MM'. */

import { useState, useMemo, useRef, useEffect } from "react";
import Icon from "@/components/Icon";

let injected = false;
function injectStyles() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const css = `
  .ev-tp{ position:relative; display:flex; flex-direction:column; gap:6px; font-family:var(--font-body); }
  .ev-tp__label{ font-size:var(--fs-sm); font-weight:var(--fw-semibold); color:var(--text-strong); }
  .ev-tp__field{ display:flex; align-items:center; gap:10px; cursor:pointer;
    background:var(--surface); border:2px solid var(--border); border-radius:14px;
    padding:10px 14px; box-shadow:2px 2px 0 var(--shadow-edge);
    transition:border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out); }
  .ev-tp__field:hover{ border-color:var(--lilac); box-shadow:3px 3px 0 var(--lilac), 6px 6px 0 var(--shadow-edge); }
  .ev-tp.is-open .ev-tp__field{ border-color:var(--brand); box-shadow:3px 3px 0 var(--lilac), 6px 6px 0 var(--shadow-edge); }
  .ev-tp__field svg{ width:18px; height:18px; color:var(--lilac); flex-shrink:0; }
  .ev-tp__val{ flex:1; font-size:var(--fs-body); color:var(--text-body); }
  .ev-tp__val.is-empty{ color:var(--text-subtle); }
  .ev-tp__pop{ position:absolute; top:calc(100% + 8px); left:0; z-index:400;
    width:200px; max-height:240px; overflow-y:auto; background:var(--surface);
    border:2px solid var(--border-strong); border-radius:20px;
    box-shadow:4px 4px 0 var(--lilac), 8px 8px 0 var(--shadow-edge); padding:6px;
    animation:evtp-in 0.225s cubic-bezier(0.22,1,0.36,1); }
  @keyframes evtp-in{ from{ opacity:0; transform:translateY(-4px); } }
  .ev-tp__opt{ display:block; width:100%; text-align:left; cursor:pointer; border:none; background:transparent;
    font-family:var(--font-body); font-size:var(--fs-body); color:var(--text-body);
    padding:9px 12px; border-radius:10px; touch-action:manipulation;
    transition:background 0.225s var(--ease-out), color 0.225s var(--ease-out); }
  .ev-tp__opt:hover{ background:var(--brand-soft); color:var(--brand); }
  .ev-tp__opt.is-selected{ background:var(--brand); color:var(--text-on-brand); font-weight:600; }
  .ev-tp__scrim{ position:fixed; inset:0; z-index:399; }`;
  const el = document.createElement("style");
  el.id = "ev-timepicker-styles";
  el.textContent = css;
  document.head.appendChild(el);
}

function to12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

interface TimePickerProps {
  label?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (hhmm: string) => void;
  step?: number;
  placeholder?: string;
  className?: string;
}

export function TimePicker({ label, value, defaultValue, onChange, step = 30, placeholder = "Select a time", className = "" }: TimePickerProps) {
  injectStyles();
  const isControlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = isControlled ? (value ?? "") : inner;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const slots = useMemo(() => {
    const out: string[] = [];
    for (let mins = 0; mins < 24 * 60; mins += step) {
      out.push(`${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`);
    }
    return out;
  }, [step]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function pick(t: string) {
    if (!isControlled) setInner(t);
    onChange?.(t);
    setOpen(false);
  }

  return (
    <div ref={ref} className={["ev-tp", open ? "is-open" : "", className].filter(Boolean).join(" ")}>
      {label && <span className="ev-tp__label">{label}</span>}
      <div
        className="ev-tp__field" role="button" tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(o => !o); } }}
      >
        <Icon name="clock" />
        <span className={"ev-tp__val" + (current ? "" : " is-empty")}>
          {current ? to12(current) : placeholder}
        </span>
      </div>
      {open && (
        <>
          <div className="ev-tp__scrim" onClick={() => setOpen(false)} />
          <div className="ev-tp__pop" role="listbox" aria-label="Choose time">
            {slots.map(t => (
              <button
                key={t} type="button" role="option" aria-selected={t === current}
                className={"ev-tp__opt" + (t === current ? " is-selected" : "")}
                onClick={() => pick(t)}
              >{to12(t)}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default TimePicker;
