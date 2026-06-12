"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";
import { apiGetMyTickets, apiInitPayment, apiSetReminder, apiVerifyPayment, type Ticket } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import Button from "@/components/Button";

function fmt(iso: string | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_STYLES: Record<string, { bg: string; text: string; bd: string }> = {
  paid: { bg: "var(--success-bg)", text: "var(--success)", bd: "var(--success-bd)" },
  pending: { bg: "var(--warning-bg)", text: "var(--warning)", bd: "var(--warning-bd)" },
  cancelled: { bg: "var(--danger-bg)", text: "var(--danger)", bd: "var(--danger-bd)" },
};

export default function TicketsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [qrOpen, setQrOpen] = useState<Ticket | null>(null);
  const [reminderTarget, setReminderTarget] = useState<Ticket | null>(null);
  const [reminderHours, setReminderHours] = useState(24);
  const [settingReminder, setSettingReminder] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "eventee")) {
      router.push("/auth/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user || user.role !== "eventee") return;
    apiGetMyTickets()
      .then(setTickets)
      .finally(() => setLoadingData(false));
  }, [user]);

  async function handleSetReminder() {
    if (!reminderTarget) return;
    setSettingReminder(true);
    try {
      const updated = await apiSetReminder(reminderTarget.id, reminderHours);
      setTickets(prev => prev.map(t => (t.id === updated.id ? { ...t, ...updated, events: t.events } : t)));
      setReminderTarget(null);
      toast({ tone: "success", title: "Reminder set", message: `We'll email you ${reminderHours}h before the event.` });
    } finally {
      setSettingReminder(false);
    }
  }

  /* Pending ticket: confirm an existing reference first (the payment may have
     gone through without the redirect completing), otherwise start a fresh
     Paystack checkout. */
  async function handleCompletePayment(ticket: Ticket) {
    setPayingId(ticket.id);
    if (ticket.paystack_reference) {
      try {
        const res = await apiVerifyPayment(ticket.paystack_reference);
        const updated = (res.ticket ?? res) as Ticket;
        if (updated.status === "paid") {
          setTickets(prev => prev.map(t => (t.id === updated.id ? { ...t, ...updated, events: t.events } : t)));
          toast({ tone: "success", title: "Payment confirmed", message: "Your earlier payment went through. QR pass emailed." });
          setPayingId(null);
          return;
        }
      } catch {
        // Not paid yet - fall through to a fresh checkout
      }
    }
    try {
      const { authorization_url } = await apiInitPayment(ticket.event_id);
      localStorage.setItem("ev_pending_event", ticket.event_id);
      window.location.href = authorization_url;
    } catch (e: unknown) {
      toast({ tone: "danger", title: "Could not start payment", message: e instanceof Error ? e.message : undefined });
      setPayingId(null);
    }
  }

  if (isLoading || loadingData) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50dvh" }}>
        <div style={{ width: 40, height: 40, border: "3px solid var(--border)", borderTopColor: "var(--brand)", borderRadius: "50%", animation: "ev-spin 0.8s linear infinite" }} />
      </div>
    );
  }

  const paidCount = tickets.filter(t => t.status === "paid").length;

  return (
    <div style={{ background: "var(--bg-page)", minHeight: "calc(100dvh - 60px)", paddingBottom: "var(--space-11)" }}>
      {/* Header */}
      <div
        className="ev-stagelight"
        style={{ background: "var(--plum)", padding: "clamp(32px,5vw,56px) 0 clamp(28px,4vw,48px)", position: "relative", overflow: "hidden" }}
      >
        <div className="ev-container" style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 14, height: 2, background: "var(--blush)", flexShrink: 0 }} />
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--fw-medium)", fontSize: "var(--fs-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(242,217,201,0.7)" }}>My tickets</span>
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--fs-h1)", color: "var(--paper)", letterSpacing: "-0.035em", margin: "0 0 8px", textWrap: "balance" }}>
            Hello,{" "}
            <span style={{ color: "var(--blush)" }}>{user?.name || "there"}</span>
          </h1>
          <p style={{ color: "rgba(251,245,239,0.6)", fontSize: "var(--fs-body)", margin: "0 0 20px" }}>
            {tickets.length > 0
              ? `${paidCount} paid ticket${paidCount !== 1 ? "s" : ""} / ${tickets.length} total`
              : "Browse events and get your first ticket."}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button variant="warm" size="sm" onClick={() => router.push("/")}>
              <Icon name="magnifying-glass" size={14} /> Discover events
            </Button>
            <Button variant="secondary" size="sm" onClick={() => router.push("/dashboard")}>
              <Icon name="sparkles" size={14} /> My dashboard
            </Button>
          </div>
        </div>
      </div>

      <div className="ev-container" style={{ paddingTop: "var(--space-7)" }}>
        {tickets.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)", padding: "var(--space-10) var(--space-4)", textAlign: "center" }}>
            <Icon name="qr-code" size={40} style={{ color: "var(--lilac)" }} />
            <p className="t-h3" style={{ color: "var(--text-muted)" }}>No tickets yet</p>
            <p style={{ color: "var(--text-subtle)", fontSize: "var(--fs-sm)" }}>Browse events and get your first ticket.</p>
            <Button onClick={() => router.push("/")}>Browse events</Button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
            {tickets.map(ticket => {
              const event = ticket.events;
              const st = STATUS_STYLES[ticket.status] ?? STATUS_STYLES.pending;
              return (
                <div
                  key={ticket.id}
                  style={{
                    background: "var(--surface)",
                    border: "2px solid var(--border-strong)",
                    borderRadius: "var(--radius-xl)",
                    boxShadow: "var(--stack-1-lg)",
                    overflow: "hidden",
                    transition: "box-shadow var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out)",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--stack-2)"; e.currentTarget.style.borderColor = "var(--brand)"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "var(--stack-1-lg)"; e.currentTarget.style.borderColor = "var(--border-strong)"; }}
                >
                  {/* Ticket header links to the event page */}
                  <Link
                    href={`/events/${ticket.event_id}`}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--brand)", padding: "var(--space-4) var(--space-5)", textDecoration: "none" }}
                  >
                    <div>
                      <p style={{ color: "var(--text-on-brand)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--fs-title)", display: "flex", alignItems: "center", gap: 8 }}>
                        {event?.title ?? "Event ticket"}
                        <Icon name="arrow-up-right" size={14} style={{ opacity: 0.7 }} />
                      </p>
                      {event?.location && (
                        <p style={{ color: "var(--text-on-brand)", opacity: 0.7, fontSize: "var(--fs-sm)", display: "flex", alignItems: "center", gap: 4 }}>
                          <Icon name="map-pin" size={13} /> {event.location}
                        </p>
                      )}
                    </div>
                    <span
                      style={{
                        background: st.bg,
                        color: st.text,
                        border: `1px solid ${st.bd}`,
                        borderRadius: "var(--radius-pill)",
                        padding: "3px 10px",
                        fontSize: "var(--fs-xs)",
                        fontFamily: "var(--font-mono)",
                        textTransform: "uppercase",
                        letterSpacing: "var(--ls-label)",
                        flexShrink: 0,
                      }}
                    >
                      {ticket.status}
                    </span>
                  </Link>

                  {/* Perforation line */}
                  <div style={{ height: 2, background: "repeating-linear-gradient(90deg, var(--border) 0 8px, transparent 8px 14px)" }} />

                  {/* Ticket body */}
                  <div style={{ padding: "var(--space-5)", display: "flex", flexWrap: "wrap", gap: "var(--space-6)", alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                      {event?.starts_at && (
                        <InfoRow icon={<Icon name="calendar-days" size={15} />}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-sm)" }}>{fmt(event.starts_at)}</span>
                        </InfoRow>
                      )}
                      {ticket.amount_paid != null && (
                        <InfoRow icon={<Icon name="banknotes" size={15} />}>
                          <span style={{ fontSize: "var(--fs-sm)", color: "var(--text-body)" }}>
                            NGN {ticket.amount_paid.toLocaleString()} paid
                            {ticket.paid_at && <span style={{ color: "var(--text-subtle)" }}> on {fmt(ticket.paid_at)}</span>}
                          </span>
                        </InfoRow>
                      )}
                      <InfoRow icon={<Icon name="ticket" size={15} />}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", color: "var(--text-subtle)" }}>{ticket.id}</span>
                      </InfoRow>
                      {ticket.qr_scanned_at && (
                        <p style={{ fontSize: "var(--fs-xs)", color: "var(--success)", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: 6 }}>
                          <Icon name="check-circle" size={13} /> Scanned at entry: {fmt(ticket.qr_scanned_at)}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", minWidth: 170 }}>
                      {ticket.status === "pending" && (
                        <Button size="sm" onClick={() => handleCompletePayment(ticket)} disabled={payingId === ticket.id}>
                          <Icon name="lock-closed" size={14} />
                          {payingId === ticket.id ? "Hold on..." : "Complete payment"}
                        </Button>
                      )}
                      {ticket.status === "paid" && ticket.qr_code && (
                        <Button size="sm" onClick={() => setQrOpen(ticket)}>
                          <Icon name="qr-code" size={14} /> Show QR code
                        </Button>
                      )}
                      <Button size="sm" variant="secondary" onClick={() => { setReminderTarget(ticket); setReminderHours(ticket.reminder_hours_before ?? 24); }}>
                        <Icon name="bell" size={14} /> Set reminder
                      </Button>
                      <Link href={`/events/${ticket.event_id}`} style={{ display: "contents" }}>
                        <Button size="sm" variant="ghost">
                          <Icon name="eye" size={14} /> View event
                        </Button>
                      </Link>
                      {ticket.reminder_hours_before && (
                        <p style={{ fontSize: "var(--fs-xs)", color: "var(--text-subtle)", fontFamily: "var(--font-mono)" }}>
                          Reminder: {ticket.reminder_hours_before}h before
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* QR modal */}
      {qrOpen && (
        <Modal onClose={() => setQrOpen(null)}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-5)", padding: "var(--space-4) 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ width: 14, height: 2, background: "var(--highlight)", flexShrink: 0 }} />
              <span className="t-label">Your QR pass</span>
            </div>
            <h2 className="t-h2" style={{ textAlign: "center" }}>{qrOpen.events?.title}</h2>
            <div
              style={{
                padding: "var(--space-4)",
                background: "var(--surface)",
                border: "2px solid var(--border-strong)",
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--stack-2)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrOpen.qr_code} alt="Ticket QR code" style={{ width: 200, height: 200, display: "block" }} />
            </div>
            <p className="t-label" style={{ letterSpacing: "var(--ls-label)", color: "var(--text-subtle)" }}>
              {qrOpen.id}
            </p>
            <p style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)", textAlign: "center" }}>
              Show this QR code at the gate. We also emailed it to you.
            </p>
          </div>
        </Modal>
      )}

      {/* Reminder modal */}
      {reminderTarget && (
        <Modal onClose={() => setReminderTarget(null)}>
          <h2 className="t-h2" style={{ marginBottom: "var(--space-4)" }}>Set reminder</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)", marginBottom: "var(--space-5)" }}>
            You&apos;ll receive an email reminder this many hours before the event starts.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
              {[1, 3, 6, 12, 24, 48, 72, 168].map(h => (
                <button
                  key={h}
                  onClick={() => setReminderHours(h)}
                  className={"db-remchip" + (reminderHours === h ? " is-on" : "")}
                >
                  <Icon name="bell-alert" size={12} />
                  {h < 24 ? `${h}h` : h === 24 ? "1 day" : h === 48 ? "2 days" : h === 72 ? "3 days" : "1 week"}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
              <Button variant="secondary" onClick={() => setReminderTarget(null)}>Cancel</Button>
              <Button onClick={handleSetReminder} disabled={settingReminder}>
                {settingReminder ? "Saving..." : "Set reminder"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function InfoRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
      <span style={{ flexShrink: 0, color: "var(--lilac)" }}>{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "var(--overlay)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-4)" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          position: "relative",
          background: "var(--surface)",
          border: "2px solid var(--border-strong)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--stack-2-lg)",
          width: "100%",
          maxWidth: 420,
          padding: "var(--space-7)",
        }}
      >
        {children}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: "var(--space-4)",
            right: "var(--space-4)",
            width: 28,
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
            borderRadius: "50%",
            transition: "background var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out)",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-sunken)"; e.currentTarget.style.color = "var(--text-strong)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          <Icon name="x-mark" size={16} />
        </button>
      </div>
    </div>
  );
}
