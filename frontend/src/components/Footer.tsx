"use client";

/* Site footer, on every page. Auth pages get a minimal single-row version;
   everywhere else shows the full brand footer (mark + catchphrase + credit),
   in the spirit of the Guessing Game / Birthday Reminder footers. */

import { usePathname } from "next/navigation";
import Link from "next/link";

const GITHUB_URL = "https://github.com/akcumeh/altschool-s03-e01";
const SITE_URL = "https://angelumeh.dev";
const TWITTER_URL = "https://twitter.com/akcumeh";

const X_PATH = "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z";
const GITHUB_PATH = "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12";

function CreditLinks({ muted }: { muted: string }) {
  const linkStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    color: muted,
    padding: 4,
    borderRadius: 8,
    transition: "color var(--dur-base) var(--ease-out)",
  };
  return (
    <nav style={{ display: "flex", gap: 6, alignItems: "center" }} aria-label="Angel Umeh's links">
      <a
        href={SITE_URL} target="_blank" rel="noreferrer" aria-label="angelumeh.dev" title="angelumeh.dev"
        style={linkStyle}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/favicon-32x32.png"
          alt=""
          style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover", display: "block" }}
        />
      </a>
      <a
        href={GITHUB_URL} target="_blank" rel="noreferrer" aria-label="GitHub" title="GitHub"
        style={linkStyle}
        onMouseEnter={e => (e.currentTarget.style.color = "var(--blush)")}
        onMouseLeave={e => (e.currentTarget.style.color = muted)}
      >
        <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden style={{ display: "block" }}>
          <path d={GITHUB_PATH} />
        </svg>
      </a>
      <a
        href={TWITTER_URL} target="_blank" rel="noreferrer" aria-label="X / Twitter" title="X / Twitter"
        style={linkStyle}
        onMouseEnter={e => (e.currentTarget.style.color = "var(--blush)")}
        onMouseLeave={e => (e.currentTarget.style.color = muted)}
      >
        <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden style={{ display: "block" }}>
          <path d={X_PATH} />
        </svg>
      </a>
    </nav>
  );
}

export default function Footer() {
  const pathname = usePathname();
  const isAuth = pathname?.startsWith("/auth");

  if (isAuth) {
    // Minimal footer: just the credit line and links
    return (
      <footer style={{ borderTop: "1px solid var(--border)", background: "var(--bg-page)" }}>
        <div
          className="ev-container"
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 10, padding: "14px var(--gutter)",
            fontSize: "var(--fs-sm)", color: "var(--text-muted)",
          }}
        >
          <span style={{ fontWeight: 500 }}>
            Designed &amp; built by Angel Umeh (ALT-SOE-025-3527)
          </span>
          <CreditLinks muted="var(--text-muted)" />
        </div>
      </footer>
    );
  }

  const onDarkMuted = "rgba(251,245,239,0.55)";

  return (
    <footer style={{ background: "var(--ink)", color: "var(--paper)", marginTop: "auto" }}>
      <div
        className="ev-container"
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 18, padding: "32px var(--gutter) 28px",
        }}
      >
        {/* Brand */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
          <div style={{
            width: 32, height: 32, background: "var(--paper)",
            border: "2px solid var(--paper)", boxShadow: "2px 2px 0 rgba(33,23,51,0.4)",
            borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" style={{ width: 20, height: 20, objectFit: "contain" }} />
          </div>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1rem", letterSpacing: "-0.02em", color: "var(--paper)" }}>
            Eventful
          </span>
        </Link>

        <p style={{ color: onDarkMuted, fontSize: "var(--fs-xs)", fontFamily: "var(--font-mono)", margin: 0 }}>
          Your passport to unforgettable moments
        </p>

        {/* Credit: links on top, byline underneath */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <CreditLinks muted={onDarkMuted} />
          <span style={{ color: onDarkMuted, fontSize: "var(--fs-sm)", fontWeight: 500 }}>
            Designed &amp; built by Angel Umeh (ALT-SOE-025-3527)
          </span>
        </div>
      </div>
    </footer>
  );
}
