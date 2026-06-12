"use client";

/* Eventful - toast notifications.
   Stacked bottom-right, single-layer hard shadow, auto-dismiss.
   Usage: const toast = useToast(); toast({ tone: "success", title: "...", message: "..." }); */

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import Icon from "@/components/Icon";

type Tone = "success" | "danger" | "warning" | "info";

interface ToastInput {
  tone?: Tone;
  title: string;
  message?: string;
  actionLabel?: string;
  actionHref?: string;
}

interface ToastItem extends ToastInput {
  id: number;
}

const ToastCtx = createContext<(t: ToastInput) => void>(() => {});

const TONE_ICON: Record<Tone, string> = {
  success: "check-circle",
  danger: "exclamation-triangle",
  warning: "exclamation-triangle",
  info: "information-circle",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback((t: ToastInput) => {
    const id = nextId.current++;
    setToasts(prev => [...prev, { id, tone: "info", ...t }]);
    setTimeout(() => dismiss(id), 5000);
  }, [dismiss]);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: "fixed",
          right: 20,
          bottom: 20,
          zIndex: 500,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          maxWidth: 380,
          width: "calc(100vw - 40px)",
        }}
      >
        {toasts.map(t => {
          const tone = t.tone ?? "info";
          return (
            <div
              key={t.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                background: "var(--surface)",
                border: "2px solid var(--border-strong)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--stack-1-lg)",
                padding: "14px 16px",
                animation: "ev-toast-in var(--dur-base) var(--ease-out)",
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  display: "grid",
                  placeItems: "center",
                  background: `var(--${tone}-bg)`,
                  border: `1px solid var(--${tone}-bd)`,
                  color: `var(--${tone})`,
                }}
              >
                <Icon name={TONE_ICON[tone]} size={18} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, color: "var(--text-strong)", fontSize: "var(--fs-sm)", margin: 0 }}>
                  {t.title}
                </p>
                {t.message && (
                  <p style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)", margin: "2px 0 0", lineHeight: 1.45 }}>
                    {t.message}
                  </p>
                )}
                {t.actionLabel && t.actionHref && (
                  <Link
                    href={t.actionHref}
                    onClick={() => dismiss(t.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      marginTop: 6,
                      fontSize: "var(--fs-sm)",
                      fontWeight: 600,
                      color: "var(--brand)",
                      borderBottom: "1.5px dashed currentColor",
                      paddingBottom: 1,
                    }}
                  >
                    {t.actionLabel} <Icon name="arrow-right" size={13} />
                  </Link>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                style={{
                  flexShrink: 0,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-subtle)",
                  padding: 2,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Icon name="x-mark" size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
