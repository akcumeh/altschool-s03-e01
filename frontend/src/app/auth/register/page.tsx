"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";
import { useAuth } from "@/lib/auth";
import { validateEmail, validateName, validatePassword } from "@/lib/validators";
import Button from "@/components/Button";
import Input from "@/components/Input";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [role, setRole] = useState<"eventee" | "creator">("eventee");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const nErr = validateName(name);
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setNameErr(nErr);
    setEmailErr(eErr);
    setPwErr(pErr);
    if (nErr || eErr || pErr) return;
    setLoading(true);
    try {
      const userData = await register(name.trim(), email, password, role);
      router.push(userData.role === "creator" ? "/dashboard" : "/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create your account. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      data-auth-split=""
      style={{
        minHeight: "calc(100dvh - 60px)",
        display: "grid", gridTemplateColumns: "1fr 1fr",
        background: "var(--bg-page)",
      }}
    >
      {/* Left panel - brand */}
      <div
        data-auth-brand=""
        className="ev-stagelight"
        style={{
          background: "var(--plum)", position: "relative",
          display: "flex", flexDirection: "column",
          justifyContent: "space-between",
          padding: "clamp(40px,6vw,64px) clamp(40px,5vw,56px)",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "relative", zIndex: 1 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
            <div style={{
              width: 44, height: 44,
              background: "var(--paper)", border: "2px solid var(--paper)",
              boxShadow: "3px 3px 0 rgba(33,23,51,0.4)",
              borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden",
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Eventful" style={{ width: 28, height: 28, objectFit: "contain" }} />
            </div>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.25rem", color: "var(--paper)", letterSpacing: "-0.02em" }}>Eventful</span>
          </Link>
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ width: 14, height: 2, background: "var(--blush)", flexShrink: 0 }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(242,217,201,0.7)" }}>Your passport to</span>
          </div>
          <h2 style={{
            fontFamily: "var(--font-display)", fontWeight: 800,
            fontSize: "clamp(2rem,3.5vw,2.8rem)",
            color: "var(--paper)", letterSpacing: "-0.035em",
            lineHeight: 1.1, margin: "0 0 16px", textWrap: "balance",
          }}>
            Unforgettable <span style={{ color: "var(--blush)" }}>moments</span>
          </h2>
          <p style={{ color: "rgba(251,245,239,0.65)", fontSize: "var(--fs-body-lg)", lineHeight: "var(--lh-relaxed)", margin: 0, maxWidth: 380, textWrap: "pretty" }}>
            Join thousands of event-goers and creators. Discover, register, and go.
          </p>
        </div>

        <div style={{ position: "relative", zIndex: 1, display: "flex", gap: 12, flexWrap: "wrap" }}>
          {["5,000+ events", "200K+ attendees", "QR-pass entry"].map(s => (
            <div key={s} style={{
              background: "rgba(251,245,239,0.1)", border: "1px solid rgba(251,245,239,0.2)",
              borderRadius: 8, padding: "8px 14px",
              fontSize: "var(--fs-xs)", fontFamily: "var(--font-mono)",
              color: "rgba(251,245,239,0.8)", letterSpacing: "0.04em", textTransform: "uppercase",
            }}>{s}</div>
          ))}
        </div>
      </div>

      {/* Right panel - form */}
      <div
        data-auth-form=""
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "clamp(40px,6vw,64px) clamp(40px,5vw,56px)",
          overflowY: "auto",
        }}
      >
        <div data-auth-inner="" style={{ width: "100%", maxWidth: 400 }}>
          {/* Tab toggle */}
          <div style={{
            display: "flex", background: "var(--bg-sunken)",
            borderRadius: 999, padding: 4, marginBottom: 32,
            border: "1px solid var(--border)",
          }}>
            {(["Log in", "Sign up"] as const).map((label, i) => {
              const active = i === 1;
              return (
                <button
                  key={label}
                  onClick={() => i === 0 && router.push("/auth/login")}
                  style={{
                    flex: 1, padding: "9px 0", borderRadius: 999, border: "none", cursor: "pointer",
                    fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "var(--fs-sm)",
                    background: active ? "var(--surface)" : "transparent",
                    color: active ? "var(--text-strong)" : "var(--text-muted)",
                    boxShadow: active ? "var(--stack-1)" : "none",
                    transition: "background var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out)",
                  }}
                >{label}</button>
              );
            })}
          </div>

          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--fs-h2)", color: "var(--text-strong)", margin: "0 0 8px", letterSpacing: "-0.02em" }}>Create an account</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "var(--fs-body)", margin: "0 0 24px" }}>
            Join thousands of event-goers and creators.
          </p>

          {error && (
            <div style={{
              background: "var(--danger-bg)", border: "1px solid var(--danger-bd)",
              borderRadius: 10, padding: "10px 14px", marginBottom: 16,
              fontSize: "var(--fs-sm)", color: "var(--danger)",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <Icon name="exclamation-triangle" size={14} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Full name */}
            <Input
              label="Full name"
              value={name}
              onChange={e => { setName(e.target.value); if (nameErr) setNameErr(validateName(e.target.value)); }}
              onBlur={() => setNameErr(name ? validateName(name) : null)}
              error={nameErr ?? undefined}
              icon={<Icon name="user" size={16} />}
              placeholder="Your full name"
              autoComplete="name"
            />

            {/* Role cards */}
            <div>
              <label style={{ display: "block", fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--text-strong)", marginBottom: 8 }}>I want to</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {([
                  { val: "eventee" as const, label: "Attend events", desc: "Discover, register and buy tickets", icon: <Icon name="ticket" size={20} /> },
                  { val: "creator" as const, label: "Host events",   desc: "Create, manage and sell tickets",  icon: <Icon name="users" size={20} /> },
                ]).map(({ val, label, desc, icon }) => (
                  <button
                    type="button" key={val} onClick={() => setRole(val)}
                    style={{
                      padding: "14px 12px",
                      border: role === val ? "2px solid var(--brand)" : "2px solid var(--border)",
                      borderRadius: 14,
                      background: role === val ? "var(--brand-soft)" : "var(--surface)",
                      cursor: "pointer", textAlign: "left",
                      boxShadow: role === val ? "var(--stack-1)" : "none",
                      transition: "border-color var(--dur-base) var(--ease-out), background var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out)",
                    }}
                  >
                    <div style={{ color: role === val ? "var(--brand)" : "var(--text-muted)", marginBottom: 6 }}>{icon}</div>
                    <div style={{ fontWeight: 600, fontSize: "var(--fs-sm)", color: "var(--text-strong)", marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Email */}
            <Input
              label="Email address"
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); if (emailErr) setEmailErr(validateEmail(e.target.value)); }}
              onBlur={() => setEmailErr(email ? validateEmail(email) : null)}
              error={emailErr ?? undefined}
              icon={<Icon name="envelope" size={16} />}
              placeholder="you@email.com"
              autoComplete="email"
            />

            {/* Password */}
            <Input
              label="Password"
              type={showPw ? "text" : "password"}
              value={password}
              onChange={e => { setPassword(e.target.value); if (pwErr) setPwErr(validatePassword(e.target.value)); }}
              onBlur={() => setPwErr(password ? validatePassword(password) : null)}
              error={pwErr ?? undefined}
              icon={<Icon name="lock-closed" size={16} />}
              placeholder="Minimum 6 characters"
              autoComplete="new-password"
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2, display: "flex" }}
                >
                  <Icon name={showPw ? "eye-slash" : "eye"} size={16} />
                </button>
              }
            />

            <Button
              type="submit" disabled={loading}
              variant="secondary" size="lg" fullWidth
              style={{ marginTop: 8 }}
            >
              {loading && (
                <div style={{ width: 16, height: 16, flexShrink: 0, border: "2px solid var(--brand-soft)", borderTopColor: "var(--brand)", borderRadius: "50%", animation: "ev-spin 0.7s linear infinite" }} />
              )}
              {loading ? "Creating account…" : `Create ${role} account`}
            </Button>
          </form>

          <p style={{ textAlign: "center", marginTop: 20, fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
            Already have an account?{" "}
            <Link href="/auth/login" style={{ color: "var(--brand)", fontWeight: 600, borderBottom: "1px dashed var(--brand)" }}>Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
