"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import Icon from "@/components/Icon";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helper?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, helper, icon, trailing, id, style, ...props },
  ref,
) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
      <label
        htmlFor={inputId}
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--fw-medium)",
          fontSize: "var(--fs-xs)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        {label}
      </label>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderRadius: 14,
          border: `2px solid ${error ? "var(--danger)" : "var(--border)"}`,
          background: "var(--surface)",
          padding: "0 12px",
          transition: "border-color var(--dur-base), box-shadow var(--dur-base)",
        }}
        onFocusCapture={e => {
          const wrap = e.currentTarget as HTMLDivElement;
          wrap.style.borderColor = error ? "var(--danger)" : "var(--brand)";
          wrap.style.boxShadow = error ? "3px 3px 0 var(--danger)" : "3px 3px 0 var(--shadow-edge)";
        }}
        onBlurCapture={e => {
          const wrap = e.currentTarget as HTMLDivElement;
          wrap.style.borderColor = error ? "var(--danger)" : "var(--border)";
          wrap.style.boxShadow = "none";
        }}
      >
        {icon && (
          <span style={{ flexShrink: 0, color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          style={{
            flex: 1,
            padding: "10px 0",
            background: "transparent",
            border: "none",
            outline: "none",
            fontFamily: "var(--font-body)",
            fontSize: "var(--fs-body)",
            color: "var(--text-strong)",
            width: "100%",
            ...style,
          }}
          {...props}
        />
        {trailing && (
          <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
            {trailing}
          </span>
        )}
      </div>

      {error && (
        <p role="alert" style={{ fontSize: "var(--fs-sm)", color: "var(--danger)", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="exclamation-triangle" size={13} /> {error}
        </p>
      )}
      {!error && helper && (
        <p style={{ fontSize: "var(--fs-sm)", color: "var(--text-subtle)", margin: 0 }}>{helper}</p>
      )}
    </div>
  );
});

export default Input;
