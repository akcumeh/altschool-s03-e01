"use client";

/* Eventee dashboard - saved events, registrations, QR tickets and reminders.
   Layout follows the dashboard-eventee design sample (stat tiles + pill tabs). */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import Button from "@/components/Button";
import {
  apiGetEvents, apiGetMyTickets, apiInitPayment, apiSetReminder, apiVerifyPayment,
  type Event, type Ticket,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { getSavedIds, toggleSaved } from "@/lib/saved";

type TabId = "saved" | "reg" | "tix" | "rem";

const REM_OPTIONS = [
  { hours: 12, label: "12h" },
  { hours: 24, label: "24h" },
  { hours: 72, label: "3 days" },
];

function month(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { month: "short" }).toUpperCase();
}
function day(iso: string) {
  return String(new Date(iso).getDate());
}
function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}
function timeTo(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "already started";
  const hours = Math.round(ms / 3600000);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} to go`;
  return `${Math.round(hours / 24)} days to go`;
}
function price(n: number) {
  return n === 0 ? "Free" : `NGN ${n.toLocaleString()}`;
}

export default function EventeeDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [tab, setTab] = useState<TabId>("saved");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState<Ticket | null>(null);

  useEffect(() => {
    if (!user) return;
    setSavedIds(getSavedIds(user.id));
    Promise.all([apiGetMyTickets(), apiGetEvents()])
      .then(([t, e]) => { setTickets(t); setEvents(e); })
      .finally(() => setLoading(false));
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("tab");
    if (initial === "saved" || initial === "reg" || initial === "tix" || initial === "rem") {
      setTab(initial);
    }
  }, [user]);

  const eventsById = useMemo(() => {
    const map: Record<string, Event> = {};
    events.forEach(e => { map[e.id] = e; });
    return map;
  }, [events]);

  const savedEvents = useMemo(
    () => events.filter(e => savedIds.includes(e.id)),
    [events, savedIds],
  );
  const paidTickets = tickets.filter(t => t.status === "paid");
  const remindersSet = tickets.filter(t => t.reminder_hours_before).length;

  function handleUnsave(eventId: string) {
    if (!user) return;
    toggleSaved(user.id, eventId);
    setSavedIds(getSavedIds(user.id));
    toast({ tone: "info", title: "Removed from saved" });
  }

  async function handleReminder(ticket: Ticket, hours: number) {
    const clearing = ticket.reminder_hours_before === hours;
    try {
      // Re-picking the active chip keeps it (backend requires >= 1h)
      if (clearing) return;
      const updated = await apiSetReminder(ticket.id, hours);
      setTickets(prev => prev.map(t => (t.id === updated.id ? { ...t, ...updated, events: t.events } : t)));
      toast({ tone: "success", title: "Reminder set", message: `We'll email you ${hours}h before it starts.` });
    } catch (e: unknown) {
      toast({ tone: "danger", title: "Could not set reminder", message: e instanceof Error ? e.message : undefined });
    }
  }

  async function handleBuy(ticket: Ticket) {
    setPayingId(ticket.id);
    if (ticket.paystack_reference) {
      try {
        const res = await apiVerifyPayment(ticket.paystack_reference);
        const updated = (res.ticket ?? res) as Ticket;
        if (updated.status === "paid") {
          setTickets(prev => prev.map(t => (t.id === updated.id ? { ...t, ...updated, events: t.events } : t)));
          toast({ tone: "success", title: "Payment confirmed", message: "Your earlier payment went through." });
          setPayingId(null);
          return;
        }
      } catch {
        // fall through to a fresh checkout
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

  function handleShare(eventId: string) {
    const ev = eventsById[eventId];
    if (!ev) return;
    const url = `${window.location.origin}/events/share/${ev.share_token}`;
    navigator.clipboard.writeText(url).then(() =>
      toast({ tone: "info", title: "Link copied", message: "Share it anywhere." }),
    );
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50dvh" }}>
        <div style={{ width: 40, height: 40, border: "3px solid var(--border)", borderTopColor: "var(--brand)", borderRadius: "50%", animation: "ev-spin 0.8s linear infinite" }} />
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: string; count: number }[] = [
    { id: "saved", label: "Saved", icon: "heart", count: savedEvents.length },
    { id: "reg", label: "Registered", icon: "calendar-days", count: tickets.length },
    { id: "tix", label: "My tickets", icon: "ticket", count: paidTickets.length },
    { id: "rem", label: "Reminders", icon: "bell", count: remindersSet },
  ];

  return (
    <div style={{ background: "var(--bg-page)", minHeight: "calc(100dvh - 60px)" }}>
      <div className="ev-container">
        <header className="db-head">
          <div>
            <span className="ea-eyebrow"><i />Your dashboard</span>
            <h1>Hi, <span className="t-accent">{user?.name?.split(" ")[0] || "there"}</span></h1>
          </div>
          <Button onClick={() => router.push("/")}>
            <Icon name="sparkles" size={16} /> Discover more
          </Button>
        </header>

        <div className="db-stats">
          <div className="ea-stat"><div className="ea-stat__icon"><Icon name="heart" size={20} /></div><span className="ea-stat__label">Saved</span><span className="ea-stat__value">{savedEvents.length}</span></div>
          <div className="ea-stat"><div className="ea-stat__icon"><Icon name="calendar-days" size={20} /></div><span className="ea-stat__label">Registered</span><span className="ea-stat__value">{tickets.length}</span></div>
          <div className="ea-stat"><div className="ea-stat__icon"><Icon name="ticket" size={20} /></div><span className="ea-stat__label">Tickets</span><span className="ea-stat__value">{paidTickets.length}</span></div>
          <div className="ea-stat"><div className="ea-stat__icon"><Icon name="bell-alert" size={20} /></div><span className="ea-stat__label">Reminders set</span><span className="ea-stat__value">{remindersSet}</span></div>
        </div>

        <div className="db-tabs">
          <div className="ev-tabs" role="tablist">
            {tabs.map(t => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className={"ev-tab" + (tab === t.id ? " is-active" : "")}
                onClick={() => setTab(t.id)}
              >
                <Icon name={t.icon} size={15} /> {t.label}
                <span className="ev-tab__count">{t.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="db-panel">
          {tab === "saved" && (
            savedEvents.length === 0 ? (
              <div className="db-empty">No saved events yet. Tap the heart on any event to save it here.</div>
            ) : (
              <div className="db-grid">
                {savedEvents.map(ev => (
                  <SavedCard key={ev.id} ev={ev} onOpen={() => router.push(`/events/${ev.id}`)} onUnsave={() => handleUnsave(ev.id)} />
                ))}
              </div>
            )
          )}

          {tab === "reg" && (
            tickets.length === 0 ? (
              <div className="db-empty">
                You haven&apos;t registered for any events yet.{" "}
                <a href="/" style={{ color: "var(--brand)", fontWeight: 600 }}>Find one you&apos;ll love.</a>
              </div>
            ) : (
              <div className="db-reg">
                {tickets.map(t => {
                  const ev = t.events;
                  const fullEvent = eventsById[t.event_id];
                  const paid = t.status === "paid";
                  return (
                    <div className="db-regrow" key={t.id}>
                      <div className="db-datechip">
                        <span className="m">{ev?.starts_at ? month(ev.starts_at) : "TBD"}</span>
                        <span className="d">{ev?.starts_at ? day(ev.starts_at) : "?"}</span>
                      </div>
                      <div>
                        <div className="db-reg__title">
                          {ev?.title ?? "Event"}
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)",
                            textTransform: "uppercase", letterSpacing: "0.06em",
                            padding: "3px 10px", borderRadius: "var(--radius-pill)",
                            background: paid ? "var(--success-bg)" : "var(--warning-bg)",
                            border: `1px solid ${paid ? "var(--success-bd)" : "var(--warning-bd)"}`,
                            color: paid ? "var(--success)" : "var(--warning)",
                          }}>
                            <span style={{ width: 7, height: 7, transform: "rotate(45deg)", background: "currentColor", borderRadius: 1.5, flexShrink: 0 }} />
                            {paid ? "Ticket secured" : "Reserved, unpaid"}
                          </span>
                        </div>
                        <div className="db-reg__meta">
                          {ev?.starts_at && <span><Icon name="calendar-days" size={14} />{fmtWhen(ev.starts_at)}</span>}
                          {ev?.location && <span><Icon name="map-pin" size={14} />{ev.location}</span>}
                        </div>
                        <div className="db-reg__remind">
                          <span className="lbl">
                            {fullEvent?.reminder_hours_before
                              ? `Organiser reminds you ${fullEvent.reminder_hours_before}h before. Add your own:`
                              : "Add your own reminder:"}
                          </span>
                          {REM_OPTIONS.map(o => (
                            <button
                              key={o.hours}
                              className={"db-remchip" + (t.reminder_hours_before === o.hours ? " is-on" : "")}
                              onClick={() => handleReminder(t, o.hours)}
                            >
                              <Icon name="bell-alert" size={13} />{o.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="db-regrow__actions">
                        {paid ? (
                          <Button variant="secondary" size="sm" onClick={() => { setTab("tix"); setQrOpen(t); }}>
                            <Icon name="qr-code" size={15} /> View ticket
                          </Button>
                        ) : (
                          <Button size="sm" onClick={() => handleBuy(t)} disabled={payingId === t.id}>
                            <Icon name="ticket" size={15} /> {payingId === t.id ? "Hold on..." : "Buy ticket"}
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleShare(t.event_id)}>
                          <Icon name="share" size={15} /> Share
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {tab === "tix" && (
            paidTickets.length === 0 ? (
              <div className="db-empty">No paid tickets yet. Buy a ticket and your QR pass will live here.</div>
            ) : (
              <div className="db-tix">
                {paidTickets.map(t => {
                  const ev = t.events;
                  const scanned = !!t.qr_scanned_at;
                  return (
                    <div className="db-ticket" key={t.id}>
                      <div className="db-ticket__info">
                        <span className="db-ticket__eyebrow"><i />Admit 1</span>
                        <span className="db-ticket__title">{ev?.title ?? "Event"}</span>
                        {ev?.starts_at && <span className="db-ticket__meta">{fmtWhen(ev.starts_at)}</span>}
                        {ev?.location && <span className="db-ticket__meta">{ev.location}</span>}
                        <span className={"db-ticket__status " + (scanned ? "scanned" : "valid")}>
                          {scanned
                            ? <><Icon name="check-badge" size={12} />Scanned in</>
                            : <><Icon name="check-circle" size={12} />Valid</>}
                        </span>
                        <span className="db-ticket__code">{t.id}</span>
                      </div>
                      <div className="db-ticket__perf" />
                      <div className="db-ticket__qr">
                        {t.qr_code ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={t.qr_code} alt="Ticket QR code" />
                        ) : (
                          <Icon name="qr-code" size={64} style={{ color: "var(--ink)" }} />
                        )}
                        <span>Scan at gate</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {tab === "rem" && (
            <RemindersPanel tickets={tickets} eventsById={eventsById} onOpen={id => router.push(`/events/${id}`)} />
          )}
        </div>
      </div>

      {/* QR modal (from "View ticket") */}
      {qrOpen && qrOpen.qr_code && (
        <div
          style={{ position: "fixed", inset: 0, background: "var(--overlay)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-4)" }}
          onClick={e => e.target === e.currentTarget && setQrOpen(null)}
        >
          <div style={{ position: "relative", background: "var(--surface)", border: "2px solid var(--border-strong)", borderRadius: "var(--radius-xl)", boxShadow: "var(--stack-2-lg)", width: "100%", maxWidth: 380, padding: "var(--space-6)", textAlign: "center" }}>
            <h2 className="t-h3" style={{ marginBottom: "var(--space-4)" }}>{qrOpen.events?.title}</h2>
            <div style={{ display: "inline-block", padding: "var(--space-3)", border: "2px solid var(--border-strong)", borderRadius: "var(--radius-lg)", boxShadow: "var(--stack-1)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrOpen.qr_code} alt="Ticket QR code" style={{ width: 190, height: 190, display: "block" }} />
            </div>
            <p className="t-label" style={{ marginTop: "var(--space-3)", color: "var(--text-subtle)" }}>{qrOpen.id}</p>
            <button
              onClick={() => setQrOpen(null)}
              aria-label="Close"
              style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
            >
              <Icon name="x-mark" size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SavedCard({ ev, onOpen, onUnsave }: { ev: Event; onOpen: () => void; onUnsave: () => void }) {
  return (
    <div
      onClick={onOpen}
      style={{
        background: "var(--surface)",
        border: "2px solid var(--border-strong)",
        boxShadow: "var(--stack-1-lg)",
        borderRadius: 20,
        overflow: "hidden",
        cursor: "pointer",
        transition: "box-shadow var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out)",
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--stack-2)"; e.currentTarget.style.borderColor = "var(--brand)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "var(--stack-1-lg)"; e.currentTarget.style.borderColor = "var(--border-strong)"; }}
    >
      <div style={{ background: "linear-gradient(135deg, var(--plum) 0%, var(--heather) 100%)", height: 110, position: "relative" }}>
        <div style={{ position: "absolute", top: 12, right: 12, background: "var(--surface)", border: "2px solid var(--border-strong)", boxShadow: "2px 2px 0 var(--shadow-edge)", borderRadius: 10, padding: "6px 10px", textAlign: "center", minWidth: 44 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.6rem", color: "var(--brand)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{month(ev.starts_at)}</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.25rem", color: "var(--text-strong)", lineHeight: 1 }}>{day(ev.starts_at)}</div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onUnsave(); }}
          className="ev-save is-saved"
          aria-label="Remove from saved"
          style={{ position: "absolute", top: 12, left: 12 }}
        >
          <Icon name="heart-solid" size={16} />
        </button>
      </div>
      <div style={{ padding: "14px 16px 16px" }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--fs-title)", color: "var(--text-strong)", margin: "0 0 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
          {ev.location && (
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
              <Icon name="map-pin" size={13} style={{ color: "var(--lilac)" }} />{ev.location.split(",")[0]}
            </span>
          )}
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
            <Icon name="clock" size={13} style={{ color: "var(--lilac)" }} />
            {new Date(ev.starts_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "var(--fs-sm)", color: ev.ticket_price === 0 ? "var(--success)" : "var(--text-strong)" }}>
          {price(ev.ticket_price)}
        </span>
      </div>
    </div>
  );
}

function RemindersPanel({
  tickets,
  eventsById,
  onOpen,
}: {
  tickets: Ticket[];
  eventsById: Record<string, Event>;
  onOpen: (eventId: string) => void;
}) {
  interface Note {
    id: string;
    eventId: string;
    icon: string;
    src: string;
    cls: string;
    unread: boolean;
    title: string;
    body: string;
    time: string;
  }

  const notes: Note[] = [];
  tickets.forEach(t => {
    const ev = t.events;
    if (!ev?.starts_at) return;
    const upcoming = new Date(ev.starts_at).getTime() > Date.now();
    if (!upcoming) return;
    const soon = new Date(ev.starts_at).getTime() - Date.now() < 7 * 86400000;

    if (t.reminder_hours_before) {
      notes.push({
        id: `own-${t.id}`,
        eventId: t.event_id,
        icon: "bell-alert",
        src: "Your reminder",
        cls: "",
        unread: soon,
        title: `${ev.title} is ${timeTo(ev.starts_at)}`,
        body: `You asked Eventful to remind you ${t.reminder_hours_before}h before it starts. We'll email the nudge${t.status === "paid" ? " with your QR pass" : ""} right on time.`,
        time: `Set by you / ${timeTo(ev.starts_at)}`,
      });
    }
    const full = eventsById[t.event_id];
    if (full?.reminder_hours_before) {
      notes.push({
        id: `org-${t.id}`,
        eventId: t.event_id,
        icon: "envelope",
        src: "From organiser",
        cls: "creator",
        unread: soon && t.status !== "paid",
        title: `Organiser reminder for ${ev.title}`,
        body: t.status === "paid"
          ? `The organiser emails all attendees ${full.reminder_hours_before}h before the event. See you there!`
          : `The organiser emails attendees ${full.reminder_hours_before}h before. You haven't got a ticket yet - grab one before it sells out.`,
        time: `Sent by organiser / ${timeTo(ev.starts_at)}`,
      });
    }
  });

  if (notes.length === 0) {
    return <div className="db-empty">No reminders yet. Set one on any registered event and it will show up here.</div>;
  }

  return (
    <div className="db-notes">
      {notes.map(n => (
        <div className={"db-note" + (n.unread ? " is-unread" : "")} key={n.id}>
          <div className={"db-note__icon " + n.cls}><Icon name={n.icon} size={20} /></div>
          <div className="db-note__body">
            <div className="db-note__t">{n.title}<span className="db-note__src">{n.src}</span></div>
            <p className="db-note__p">{n.body}</p>
            <span className="db-note__time">{n.time}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onOpen(n.eventId)}>
            Open <Icon name="arrow-right" size={15} />
          </Button>
        </div>
      ))}
    </div>
  );
}
