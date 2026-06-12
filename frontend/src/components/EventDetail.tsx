"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { type Event, apiCreateTicket, apiInitPayment } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { isSaved, toggleSaved } from "@/lib/saved";
import { validateEmail, validateName } from "@/lib/validators";
import Button from "@/components/Button";
import Input from "@/components/Input";

/* ---- Brand gradients (deterministic per event id) ---- */
const BRAND_GRADIENTS = [
  "linear-gradient(135deg, #3A3266 0%, #6E5A93 100%)",
  "linear-gradient(135deg, #6E5A93 0%, #DCA9C3 100%)",
  "linear-gradient(135deg, #3A3266 0%, #DCA9C3 60%, #F2D9C9 100%)",
  "linear-gradient(135deg, #211733 0%, #3A3266 50%, #6E5A93 100%)",
  "linear-gradient(135deg, #DCA9C3 0%, #A885B8 50%, #3A3266 100%)",
  "linear-gradient(135deg, #F2D9C9 0%, #DCA9C3 40%, #6E5A93 100%)",
];
function gradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return BRAND_GRADIENTS[Math.abs(hash) % BRAND_GRADIENTS.length];
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

interface Props { event: Event }

export default function EventDetail({ event }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [showBuy, setShowBuy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) setSaved(isSaved(user.id, event.id));
  }, [user, event.id]);

  const heroBg = gradient(event.id);
  const isOwner = user?.id === event.creator_id;
  const isEventee = user?.role === "eventee";

  // Capacity warning: show when 10% or fewer spots remain
  const ticketsSold = event.tickets_sold ?? 0;
  const spotsLeft = event.capacity ? Math.max(0, event.capacity - ticketsSold) : null;
  const isSoldOut = event.capacity != null && spotsLeft === 0;
  const isAlmostFull = event.capacity != null && spotsLeft != null && spotsLeft > 0
    && spotsLeft / event.capacity <= 0.1;

  function handleShare() {
    const url = `${window.location.origin}/events/share/${event.share_token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast({ tone: "info", title: "Link copied", message: "Share it anywhere - the event is public." });
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleSaveToggle() {
    if (!user) { router.push("/auth/login"); return; }
    const nowSaved = toggleSaved(user.id, event.id);
    setSaved(nowSaved);
    toast({
      tone: "info",
      title: nowSaved ? "Event saved" : "Removed from saved",
      message: nowSaved ? "Find it on your dashboard under Saved." : undefined,
    });
  }

  const duration = event.ends_at
    ? `${fmtTime(event.starts_at)} - ${fmtTime(event.ends_at)}`
    : fmtTime(event.starts_at);

  return (
    <div style={{ background: "var(--bg-page)", minHeight: "calc(100dvh - 60px)" }}>

      {/* Hero */}
      <div
        className="ev-stagelight"
        style={{ background: heroBg, position: "relative", minHeight: 340, display: "flex", alignItems: "flex-end", overflow: "hidden" }}
      >
        {/* Fade-to-dark overlay so white text reads */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(33,23,51,0.15) 0%, rgba(33,23,51,0.6) 100%)", zIndex: 0 }} />

        <div className="ev-container" style={{ position: "relative", zIndex: 1, paddingTop: 48, paddingBottom: 40 }}>
          <Link href="/" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: 999, padding: "6px 14px",
            color: "#fff", fontSize: "var(--fs-sm)", fontFamily: "var(--font-body)",
            textDecoration: "none", marginBottom: 20,
          }}>
            <Icon name="arrow-left" size={14} /> All events
          </Link>

          <div style={{
            display: "inline-block", padding: "4px 12px",
            background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: 999, fontSize: "var(--fs-xs)", fontFamily: "var(--font-mono)",
            color: "rgba(255,255,255,0.9)", letterSpacing: "0.08em", textTransform: "uppercase",
            marginBottom: 14,
          }}>
            {event.category ?? event.status}
          </div>

          <h1 style={{
            fontFamily: "var(--font-display)", fontWeight: 800,
            fontSize: "var(--fs-h1)", color: "#fff",
            letterSpacing: "-0.03em", margin: "0 0 16px",
            textWrap: "balance",
          }}>
            {event.title}
          </h1>

          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {[
              { icon: "calendar-days", text: fmtDate(event.starts_at) },
              { icon: "clock", text: duration },
              { icon: "map-pin", text: event.location },
            ].map(({ icon, text }) => (
              <span key={text} style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.88)", fontSize: "var(--fs-sm)" }}>
                <Icon name={icon} size={14} />{text}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div
        className="ev-container"
        data-event-grid=""
        style={{ paddingTop: 40, paddingBottom: 80, display: "grid", gridTemplateColumns: "1fr min(380px,42%)", gap: 40, alignItems: "start" }}
      >
        {/* Left: description + detail cards */}
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--fs-h3)", color: "var(--text-strong)", margin: "0 0 12px" }}>
            About this event
          </h2>
          <p style={{ color: "var(--text-body)", fontSize: "var(--fs-body-lg)", lineHeight: "var(--lh-relaxed)", margin: "0 0 32px", textWrap: "pretty" }}>
            {event.description || "No description provided."}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 32 }}>
            {[
              { label: "DATE",     value: fmtDate(event.starts_at), icon: "calendar-days", mono: true },
              { label: "TIME",     value: duration,                 icon: "clock",         mono: true },
              { label: "LOCATION", value: event.location,           icon: "map-pin",       mono: false },
              {
                label: "CAPACITY",
                value: event.capacity
                  ? isSoldOut ? "Sold out" : `${spotsLeft} of ${event.capacity} left`
                  : "Unlimited",
                icon: "users",
                mono: false,
              },
            ].map(({ label, value, icon, mono }) => (
              <div key={label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ color: "var(--accent)", marginTop: 2, flexShrink: 0 }}><Icon name={icon} size={16} /></div>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-body)", fontFamily: mono ? "var(--font-mono)" : "var(--font-body)" }}>{value}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={handleShare}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 999, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: "var(--fs-sm)", cursor: "pointer", fontFamily: "var(--font-body)", touchAction: "manipulation", transition: "border-color var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out)" }}
            >
              {copied ? <Icon name="check" size={14} style={{ color: "var(--success)" }} /> : <Icon name="share" size={14} />}
              {copied ? "Link copied!" : "Share event"}
            </button>
            {!isOwner && (
              <button
                onClick={handleSaveToggle}
                className={"ev-save" + (saved ? " is-saved" : "")}
                aria-label={saved ? "Remove from saved events" : "Save this event"}
                title={saved ? "Remove from saved" : "Save for later"}
              >
                <Icon name={saved ? "heart-solid" : "heart"} size={17} />
              </button>
            )}
          </div>
        </div>

        {/* Right: sticky ticket widget */}
        <div style={{ background: "var(--surface)", border: "2px solid var(--border-strong)", borderRadius: 20, boxShadow: "var(--stack-2)", padding: "var(--space-6)", position: "sticky", top: 84 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "var(--space-4)" }}>
            <span style={{ width: 14, height: 2, background: "var(--highlight)", flexShrink: 0 }} />
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--fw-medium)", fontSize: "var(--fs-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>Tickets</span>
          </div>

          <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--fs-h2)", color: "var(--text-strong)", marginBottom: 4, letterSpacing: "-0.03em" }}>
            {event.ticket_price === 0 ? "Free" : `NGN ${event.ticket_price.toLocaleString()}`}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "var(--space-5)" }}>
            <p style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>per ticket</p>
            {isSoldOut && (
              <span style={{
                padding: "2px 10px", borderRadius: 999,
                background: "var(--danger-bg)", border: "1px solid var(--danger-bd)",
                fontSize: "var(--fs-xs)", fontFamily: "var(--font-mono)",
                color: "var(--danger)", letterSpacing: "0.06em", textTransform: "uppercase",
              }}>Sold out</span>
            )}
            {isAlmostFull && (
              <span style={{
                padding: "2px 10px", borderRadius: 999,
                background: "var(--warning-bg)", border: "1px solid var(--warning-bd)",
                fontSize: "var(--fs-xs)", fontFamily: "var(--font-mono)",
                color: "var(--warning)", letterSpacing: "0.06em", textTransform: "uppercase",
              }}>{spotsLeft} spot{spotsLeft === 1 ? "" : "s"} left</span>
            )}
          </div>

          {isOwner ? (
            <p style={{ color: "var(--text-subtle)", fontSize: "var(--fs-sm)", textAlign: "center" }}>
              You created this event.{" "}
              <Link href="/dashboard" style={{ color: "var(--brand)", fontWeight: 600 }}>Manage it</Link>
            </p>
          ) : isEventee ? (
            <Button size="lg" fullWidth onClick={() => setShowBuy(true)} disabled={isSoldOut}>
              <Icon name="ticket" size={17} />
              {isSoldOut ? "Sold out" : "Get tickets"}
            </Button>
          ) : !user ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Button size="lg" fullWidth onClick={() => router.push("/auth/login")}>
                <Icon name="ticket" size={17} /> Sign in to buy tickets
              </Button>
              <p style={{ color: "var(--text-subtle)", fontSize: "var(--fs-sm)", textAlign: "center" }}>
                Need an account?{" "}
                <Link href="/auth/register" style={{ color: "var(--brand)", fontWeight: 600 }}>Sign up</Link>
              </p>
            </div>
          ) : null}

          <p style={{ fontSize: "var(--fs-xs)", color: "var(--text-subtle)", marginTop: "var(--space-4)", textAlign: "center" }}>
            Full refund up to 48h before the event.
          </p>
        </div>
      </div>

      {showBuy && user && (
        <BuyTicketModal event={event} onClose={() => setShowBuy(false)} />
      )}
    </div>
  );
}

/* ---- "Your details" checkout modal ----
   Pre-filled from the account, editable before the pass is issued. */
function BuyTicketModal({ event, onClose }: { event: Event; onClose: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [formErr, setFormErr] = useState("");
  const [busy, setBusy] = useState(false);

  const isFree = event.ticket_price === 0;

  async function handlePay() {
    const nErr = validateName(name);
    const eErr = validateEmail(email);
    setNameErr(nErr);
    setEmailErr(eErr);
    if (nErr || eErr) return;

    setBusy(true);
    setFormErr("");

    // Register (create the pending ticket); tolerate "already registered"
    try {
      await apiCreateTicket(event.id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (!msg.toLowerCase().includes("already")) {
        setFormErr(msg || "Could not reserve a ticket");
        setBusy(false);
        return;
      }
    }

    if (isFree) {
      toast({ tone: "success", title: "You're registered!", message: "This event is free - see it on your dashboard." });
      setBusy(false);
      onClose();
      router.push("/dashboard");
      return;
    }

    try {
      const { authorization_url } = await apiInitPayment(event.id, {
        name: name.trim(),
        email: email.trim(),
      });
      localStorage.setItem("ev_pending_event", event.id);
      window.location.href = authorization_url;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not initialize payment";
      if (msg.toLowerCase().includes("already paid")) {
        toast({
          tone: "info",
          title: "You already have this ticket",
          message: "Your QR pass is waiting on your tickets page.",
          actionLabel: "View my tickets",
          actionHref: "/tickets",
        });
        setBusy(false);
        onClose();
        return;
      }
      setFormErr(msg);
      setBusy(false);
    }
  }

  return (
    <div className="ck-overlay" onClick={e => e.target === e.currentTarget && !busy && onClose()}>
      <div className="ck-block" role="dialog" aria-label="Your details">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div className="ck-block__head">
            <h2>Your details</h2>
            <p className="ck-block__sub">Feel free to edit these details before we issue your ticket.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            disabled={busy}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}
          >
            <Icon name="x-mark" size={18} />
          </button>
        </div>

        {formErr && (
          <div style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-bd)", borderRadius: 10, padding: "10px 14px", color: "var(--danger)", fontSize: "var(--fs-sm)", marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
            <Icon name="exclamation-triangle" size={14} />{formErr}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input
            label="Full name"
            value={name}
            onChange={e => { setName(e.target.value); if (nameErr) setNameErr(validateName(e.target.value)); }}
            onBlur={() => setNameErr(validateName(name))}
            error={nameErr ?? undefined}
            icon={<Icon name="user" size={16} />}
            placeholder="Your full name"
            required
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); if (emailErr) setEmailErr(validateEmail(e.target.value)); }}
            onBlur={() => setEmailErr(validateEmail(email))}
            error={emailErr ?? undefined}
            icon={<Icon name="envelope" size={16} />}
            placeholder="you@email.com"
            helper="Your QR pass and receipts go here."
            required
          />

          {/* Order line */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 12, borderTop: "1px dashed var(--border-strong)" }}>
            <span style={{ fontSize: "var(--fs-body)", color: "var(--text-muted)" }}>1 ticket / {event.title}</span>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--fs-h4)", color: "var(--brand)" }}>
              {isFree ? "Free" : `NGN ${event.ticket_price.toLocaleString()}`}
            </span>
          </div>

          <Button size="lg" fullWidth onClick={handlePay} disabled={busy}>
            <Icon name="lock-closed" size={16} />
            {busy ? "Hold on..." : isFree ? "Register free" : `Pay NGN ${event.ticket_price.toLocaleString()}`}
          </Button>

          <p className="ck-paystack">Secured by <b>Paystack</b> / QR ticket emailed instantly</p>
          <div className="ck-trust"><Icon name="shield-check" size={15} /> Full refund up to 48h before the event</div>
        </div>
      </div>
    </div>
  );
}
