"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { useAuth } from "@/lib/auth";

export default function NavBar() {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Sync React state with whatever the blocking inline script already applied
  useEffect(() => {
    const applied = document.documentElement.getAttribute("data-theme") as "light" | "dark" | null;
    if (applied === "dark") setTheme("dark");
  }, []);

  useEffect(() => {
    // Works across all browsers including mobile Safari: sets a data attribute on <html>
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ev_theme", theme);
  }, [theme]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initial = user ? (user.email[0] ?? "?").toUpperCase() : "?";

  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 100,
      background: "var(--bg-page)",
      borderBottom: "1px solid var(--border)",
    }}>
      <div className="ev-container" style={{ display: "flex", alignItems: "center", gap: 24, height: 60 }}>
        {/* Brand */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, textDecoration: "none" }}>
          {/* Avatar-style tile: paper bg + ink border + lilac/ink stack-2 shadow */}
          <div style={{
            width: 40, height: 40,
            background: "var(--paper)",
            border: "2px solid var(--border-strong)",
            boxShadow: "3px 3px 0 var(--lilac), 6px 6px 0 var(--shadow-edge)",
            borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            transition: "box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out)",
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Eventful logo" style={{ width: 26, height: 26, objectFit: "contain" }} />
          </div>
          <span style={{
            fontFamily: "var(--font-display)", fontWeight: 700,
            fontSize: "1.05rem", letterSpacing: "-0.02em",
            color: "var(--text-strong)",
          }}>Eventful</span>
        </Link>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!user && (
            <>
              <Link href="/auth/login" style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontFamily: "var(--font-body)", fontWeight: 600,
                fontSize: "var(--fs-sm)", color: "var(--text-body)",
                padding: "7px 16px", borderRadius: 999,
                border: "none", background: "transparent",
                cursor: "pointer", textDecoration: "none",
                transition: "background var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out)",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--brand-soft)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >Log in</Link>
              <Link href="/auth/register" style={{
                display: "inline-flex", alignItems: "center",
                fontFamily: "var(--font-body)", fontWeight: 600,
                fontSize: "var(--fs-sm)", color: "var(--surface)",
                padding: "7px 16px", borderRadius: 999,
                border: "2px solid var(--border-strong)",
                background: "var(--brand)",
                cursor: "pointer", textDecoration: "none",
                boxShadow: "2px 2px 0 var(--lilac), 4px 4px 0 var(--shadow-edge)",
                transition: "box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out), background var(--dur-base) var(--ease-out)",
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "3px 3px 0 var(--lilac), 6px 6px 0 var(--shadow-edge)"; e.currentTarget.style.transform = "translate(-1px,-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "2px 2px 0 var(--lilac), 4px 4px 0 var(--shadow-edge)"; e.currentTarget.style.transform = "none"; }}
              >Sign up</Link>
            </>
          )}

          {user?.role === "eventee" && (
            <>
              <NavLink href="/" icon={<Icon name="magnifying-glass" size={14} />}>Discover</NavLink>
              <NavLink href="/dashboard" icon={<Icon name="sparkles" size={14} />}>Dashboard</NavLink>
              <NavLink href="/tickets" icon={<Icon name="ticket" size={14} />}>My tickets</NavLink>
            </>
          )}

          {user?.role === "creator" && (
            <>
              <NavLink href="/dashboard" icon={<Icon name="layout-dashboard" size={14} />}>Dashboard</NavLink>
              <NavLink href="/dashboard?create=1" icon={<Icon name="calendar-plus" size={14} />}>Create event</NavLink>
            </>
          )}

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(t => t === "light" ? "dark" : "light")}
            aria-label="Toggle theme"
            style={{
              background: "none", border: "1px solid var(--border)",
              borderRadius: 999, width: 32, height: 32,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--text-muted)", flexShrink: 0,
              transition: "background var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out)",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-sunken)")}
            onMouseLeave={e => (e.currentTarget.style.background = "none")}
          >
            {theme === "light" ? <Icon name="moon" size={15} /> : <Icon name="sun" size={15} />}
          </button>

          {/* User avatar + dropdown */}
          {user && (
            <div ref={menuRef} style={{ position: "relative" }}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "var(--plum)", border: "2px solid var(--border-strong)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "var(--paper)",
                  fontWeight: 700, fontSize: "0.75rem",
                  fontFamily: "var(--font-display)",
                }}
              >
                {initial}
              </button>
              {menuOpen && (
                <div style={{
                  position: "absolute", right: 0, top: "calc(100% + 8px)",
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: 14, boxShadow: "var(--shadow-md)",
                  minWidth: 200, overflow: "hidden", zIndex: 200,
                  animation: "ev-fade-in 0.15s ease",
                }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--text-strong)" }}>{user.email}</div>
                    <div style={{
                      fontFamily: "var(--font-mono)", fontWeight: 500,
                      fontSize: "var(--fs-xs)", letterSpacing: "0.08em",
                      textTransform: "uppercase", color: "var(--text-muted)", marginTop: 2,
                    }}>{user.role}</div>
                  </div>
                  <button
                    onClick={() => { logout(); setMenuOpen(false); }}
                    style={{
                      width: "100%", textAlign: "left",
                      padding: "10px 16px", background: "none", border: "none",
                      cursor: "pointer", color: "var(--danger)",
                      fontSize: "var(--fs-sm)", fontFamily: "var(--font-body)",
                      display: "flex", alignItems: "center", gap: 8,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--danger-bg)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                  >
                    <Icon name="arrow-right-on-rectangle" size={15} />
                    Log out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link href={href} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontFamily: "var(--font-body)", fontWeight: 600,
      fontSize: "var(--fs-sm)", color: "var(--text-body)",
      padding: "7px 14px", borderRadius: 999,
      textDecoration: "none",
      transition: "background var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out)",
    }}
    onMouseEnter={e => { e.currentTarget.style.background = "var(--brand-soft)"; e.currentTarget.style.color = "var(--brand)"; }}
    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-body)"; }}
    >
      {icon}{children}
    </Link>
  );
}
