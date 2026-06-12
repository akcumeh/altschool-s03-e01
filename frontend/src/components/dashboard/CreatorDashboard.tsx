"use client";

/* Creator dashboard - overview stats, per-event sales/attendance table,
   spotlight analytics (attendance ring, sell-through, revenue) and event
   CRUD. Layout follows the dashboard-creator design sample. */

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import Button from "@/components/Button";
import Input from "@/components/Input";
import ShareModal from "@/components/ShareModal";
import ViewToggle, { type ViewMode } from "@/components/ViewToggle";
import DatePicker from "@/components/DatePicker";
import TimePicker from "@/components/TimePicker";
import {
  apiCreateEvent, apiDeleteEvent, apiGetAnalyticsEvents, apiGetAnalyticsOverview,
  apiUpdateEvent,
  type AnalyticsOverview, type Event, type EventBreakdownRow,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import {
  validateAmount, validateInt, validateRequired,
} from "@/lib/validators";

function month(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { month: "short" }).toUpperCase();
}
function day(iso: string) {
  return String(new Date(iso).getDate());
}
function naira(n: number) {
  return `NGN ${Math.round(n).toLocaleString()}`;
}
function nairaCompact(n: number) {
  if (n >= 1_000_000) return `NGN ${(n / 1_000_000).toFixed(1)}M`;
  return naira(n);
}

type RowStatus = { label: string; bg: string; bd: string; fg: string };
function rowStatus(row: EventBreakdownRow): RowStatus {
  const past = new Date(row.starts_at).getTime() < Date.now();
  if (row.status === "cancelled") return { label: "Cancelled", bg: "var(--danger-bg)", bd: "var(--danger-bd)", fg: "var(--danger)" };
  if (row.status === "draft") return { label: "Draft", bg: "var(--info-bg)", bd: "var(--info-bd)", fg: "var(--info)" };
  if (past) return { label: "Ended", bg: "var(--bg-sunken)", bd: "var(--border)", fg: "var(--text-muted)" };
  if (row.capacity && row.tickets_sold >= row.capacity) return { label: "Sold out", bg: "var(--danger-bg)", bd: "var(--danger-bd)", fg: "var(--danger)" };
  return { label: "On sale", bg: "var(--success-bg)", bd: "var(--success-bd)", fg: "var(--success)" };
}

export default function CreatorDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [rows, setRows] = useState<EventBreakdownRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<EventBreakdownRow | null>(null);
  const [shareTarget, setShareTarget] = useState<EventBreakdownRow | null>(null);
  const [view, setView] = useState<ViewMode>("list");

  const refresh = useCallback(() => {
    return Promise.all([apiGetAnalyticsOverview(), apiGetAnalyticsEvents()])
      .then(([ov, evRows]) => {
        setOverview(ov);
        setRows(evRows);
        setSpotlightId(prev => prev && evRows.some(r => r.id === prev) ? prev : evRows[0]?.id ?? null);
      });
  }, []);

  useEffect(() => {
    if (!user || user.role !== "creator") return;
    refresh().finally(() => setLoading(false));
    if (new URLSearchParams(window.location.search).get("create")) {
      setShowCreate(true);
    }
  }, [user, refresh]);

  const spotlight = useMemo(
    () => rows.find(r => r.id === spotlightId) ?? null,
    [rows, spotlightId],
  );
  const maxRevenue = useMemo(() => Math.max(1, ...rows.map(r => r.revenue)), [rows]);


  async function handleDelete(row: EventBreakdownRow) {
    if (!confirm(`Delete "${row.title}"? This cannot be undone.`)) return;
    await apiDeleteEvent(row.id);
    toast({ tone: "success", title: "Event deleted" });
    refresh();
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50dvh" }}>
        <div style={{ width: 40, height: 40, border: "3px solid var(--border)", borderTopColor: "var(--brand)", borderRadius: "50%", animation: "ev-spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ background: "var(--bg-page)", minHeight: "calc(100dvh - 60px)" }}>
      <div className="ev-container" style={{ paddingBottom: 80 }}>
        <header className="db-head">
          <div>
            <span className="ea-eyebrow"><i />Creator studio</span>
            <h1>Hi, <span className="t-accent">{user?.name?.split(" ")[0] || "creator"}</span></h1>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Icon name="plus" size={16} /> Create event
          </Button>
        </header>

        {/* Overview stats */}
        {overview && (
          <div className="db-stats">
            <div className="ea-stat">
              <div className="ea-stat__icon"><Icon name="banknotes" size={20} /></div>
              <span className="ea-stat__label">Total revenue</span>
              <span className="ea-stat__value">{nairaCompact(overview.total_revenue)}</span>
              <span className="ea-stat__delta"><Icon name="arrow-trending-up" size={14} />Avg order {naira(overview.avg_order)}</span>
            </div>
            <div className="ea-stat">
              <div className="ea-stat__icon"><Icon name="ticket" size={20} /></div>
              <span className="ea-stat__label">Tickets sold</span>
              <span className="ea-stat__value">{overview.total_tickets_sold.toLocaleString()}</span>
              <span className="ea-stat__delta" style={{ color: "var(--text-muted)" }}>{overview.pending_tickets} pending</span>
            </div>
            <div className="ea-stat">
              <div className="ea-stat__icon"><Icon name="check-badge" size={20} /></div>
              <span className="ea-stat__label">Attendees (scanned)</span>
              <span className="ea-stat__value">{overview.total_attendees.toLocaleString()}</span>
              <span className="ea-stat__delta"><Icon name="qr-code" size={14} />{overview.attendance_rate}% attendance</span>
            </div>
            <div className="ea-stat">
              <div className="ea-stat__icon"><Icon name="calendar-days" size={20} /></div>
              <span className="ea-stat__label">Active events</span>
              <span className="ea-stat__value">{overview.active_events}</span>
              <span className="ea-stat__delta" style={{ color: "var(--text-muted)" }}>{overview.total_events} all time</span>
            </div>
          </div>
        )}

        {rows.length === 0 ? (
          <div
            style={{
              border: "2px dashed var(--border)", borderRadius: "var(--radius-xl)",
              padding: "var(--space-10)", textAlign: "center", marginTop: "var(--space-5)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)",
            }}
          >
            <p className="t-h3" style={{ color: "var(--text-muted)" }}>No events yet</p>
            <p style={{ color: "var(--text-subtle)", fontSize: "var(--fs-sm)" }}>Create your first event to start selling tickets.</p>
            <Button onClick={() => setShowCreate(true)}>
              <Icon name="plus" size={16} /> Create your first event
            </Button>
          </div>
        ) : (
          <>
            {/* Events table */}
            <div className="cd-card" style={{ margin: "10px 0 18px" }}>
              <div className="cd-card__head">
                <div><h2>Your events</h2><p>Sales and attendance per event. Pick one to spotlight it below.</p></div>
                <ViewToggle view={view} onChange={setView} />
              </div>
              {view === "grid" ? (
              <div className="db-grid">
                {rows.map(row => {
                  const st = rowStatus(row);
                  return (
                    <div
                      key={row.id}
                      onClick={() => setSpotlightId(row.id)}
                      style={{
                        background: "var(--surface)", border: "2px solid var(--border-strong)",
                        borderRadius: "var(--radius-lg)", boxShadow: "var(--stack-1)",
                        padding: 18, display: "flex", flexDirection: "column", gap: 12, cursor: "pointer",
                        transition: "box-shadow var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out)",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--stack-2)"; e.currentTarget.style.borderColor = "var(--brand)"; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = "var(--stack-1)"; e.currentTarget.style.borderColor = "var(--border-strong)"; }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <div className="cd-ev__chip"><span className="m">{month(row.starts_at)}</span><span className="d">{day(row.starts_at)}</span></div>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)",
                          textTransform: "uppercase", letterSpacing: "0.06em",
                          padding: "3px 10px", borderRadius: "var(--radius-pill)",
                          background: st.bg, border: `1px solid ${st.bd}`, color: st.fg,
                        }}>
                          <span style={{ width: 7, height: 7, transform: "rotate(45deg)", background: "currentColor", borderRadius: 1.5, flexShrink: 0 }} />
                          {st.label}
                        </span>
                      </div>
                      <div>
                        <div className="cd-ev__name">{row.title}</div>
                        <div className="cd-ev__sub">{row.location}</div>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
                        <span><span className="cd-num">{row.tickets_sold.toLocaleString()}</span> / {row.capacity ? row.capacity.toLocaleString() : "open"} sold</span>
                        <span><span className="cd-num">{row.attendance_rate}%</span> attendance</span>
                        <span className="cd-num">{nairaCompact(row.revenue)}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: "auto" }} onClick={e => e.stopPropagation()}>
                        <IconAction label="View event" icon="eye" onClick={() => router.push(`/events/${row.id}`)} />
                        <IconAction label="Share event" icon="share" onClick={() => setShareTarget(row)} />
                        <IconAction label="Edit event" icon="pencil-square" onClick={() => setEditTarget(row)} />
                        <IconAction label="Delete event" icon="trash" danger onClick={() => handleDelete(row)} />
                      </div>
                    </div>
                  );
                })}
              </div>
              ) : (
              <table className="cd-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th className="num">Sold / cap</th>
                    <th className="num">Attendance</th>
                    <th className="num">Revenue</th>
                    <th className="num">Status</th>
                    <th className="num">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const st = rowStatus(row);
                    return (
                      <tr key={row.id} style={{ cursor: "pointer" }} onClick={() => setSpotlightId(row.id)}>
                        <td>
                          <div className="cd-ev">
                            <div className="cd-ev__chip"><span className="m">{month(row.starts_at)}</span><span className="d">{day(row.starts_at)}</span></div>
                            <div>
                              <div className="cd-ev__name">{row.title}</div>
                              <div className="cd-ev__sub">{row.location}</div>
                            </div>
                          </div>
                        </td>
                        <td className="num">
                          <span className="cd-num">{row.tickets_sold.toLocaleString()}</span>{" "}
                          <span className="cd-ev__sub">/ {row.capacity ? row.capacity.toLocaleString() : "open"}</span>
                        </td>
                        <td className="num">
                          {row.tickets_sold > 0 ? (
                            <span className="cd-rate">
                              <span className="cd-rate__track"><span className="cd-rate__fill" style={{ width: `${row.attendance_rate}%` }} /></span>
                              <span className="cd-num">{row.attendance_rate}%</span>
                            </span>
                          ) : (
                            <span className="cd-ev__sub">No sales yet</span>
                          )}
                        </td>
                        <td className="num"><span className="cd-num">{nairaCompact(row.revenue)}</span></td>
                        <td className="num">
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)",
                            textTransform: "uppercase", letterSpacing: "0.06em",
                            padding: "3px 10px", borderRadius: "var(--radius-pill)",
                            background: st.bg, border: `1px solid ${st.bd}`, color: st.fg,
                          }}>
                            <span style={{ width: 7, height: 7, transform: "rotate(45deg)", background: "currentColor", borderRadius: 1.5, flexShrink: 0 }} />
                            {st.label}
                          </span>
                        </td>
                        <td className="num" onClick={e => e.stopPropagation()}>
                          <div style={{ display: "inline-flex", gap: 6 }}>
                            <IconAction label="View event" icon="eye" onClick={() => router.push(`/events/${row.id}`)} />
                            <IconAction label="Share event" icon="share" onClick={() => setShareTarget(row)} />
                            <IconAction label="Edit event" icon="pencil-square" onClick={() => setEditTarget(row)} />
                            <IconAction label="Delete event" icon="trash" danger onClick={() => handleDelete(row)} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              )}
            </div>

            {/* Revenue + sales mix */}
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 18, paddingBottom: 18 }} className="cd-two-grid">
              <style>{`@media (max-width: 900px){ .cd-two-grid { grid-template-columns: 1fr !important; } }`}</style>
              <div className="cd-card">
                <div className="cd-card__head"><div><h2>Revenue by event</h2><p>Paid tickets only</p></div></div>
                <div className="cd-tierbars">
                  {rows.map((row, i) => (
                    <div key={row.id}>
                      <div className="cd-tierbar__top"><span>{row.title}</span><b>{row.tickets_sold.toLocaleString()} sold / {nairaCompact(row.revenue)}</b></div>
                      <div className="cd-tierbar__track">
                        <div className="cd-tierbar__fill" style={{ width: `${(row.revenue / maxRevenue) * 100}%`, background: ["var(--plum)", "var(--lilac)", "var(--blush)", "var(--heather)"][i % 4] }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="cd-card">
                <div className="cd-card__head"><div><h2>Sales mix</h2><p>Paid vs reserved, all events</p></div></div>
                <div className="cd-tierbars">
                  {(() => {
                    const paid = overview?.total_tickets_sold ?? 0;
                    const pending = overview?.pending_tickets ?? 0;
                    const scanned = overview?.total_attendees ?? 0;
                    const max = Math.max(1, paid, pending);
                    const mix = [
                      { label: "Paid tickets", n: paid, color: "var(--plum)" },
                      { label: "Reserved, unpaid", n: pending, color: "var(--blush)" },
                      { label: "Scanned at the gate", n: scanned, color: "var(--lilac)" },
                    ];
                    return mix.map(m => (
                      <div key={m.label}>
                        <div className="cd-tierbar__top"><span>{m.label}</span><b>{m.n.toLocaleString()}</b></div>
                        <div className="cd-tierbar__track"><div className="cd-tierbar__fill" style={{ width: `${(m.n / max) * 100}%`, background: m.color }} /></div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>

            {/* Spotlight event analytics */}
            {spotlight && (
              <>
                <h2 className="cd-section-h">{spotlight.title} / event analytics</h2>
                <div className="cd-card">
                  <div className="cd-spot">
                    <div className="cd-ring">
                      <div className="cd-ring__dial" style={{ "--ring-pct": `${spotlight.attendance_rate}%` } as React.CSSProperties}>
                        <div className="cd-ring__center"><b>{spotlight.attendance_rate}%</b><span>Attendance</span></div>
                      </div>
                      <p className="cd-ring__sub">
                        <b>{spotlight.qr_scans.toLocaleString()}</b> of <b>{spotlight.tickets_sold.toLocaleString()}</b> QR passes scanned at the gate.{" "}
                        <b>{spotlight.no_shows.toLocaleString()}</b> no-shows.
                      </p>
                    </div>
                    <div>
                      <div className="cd-spot__metrics">
                        <div className="cd-mini"><span>Revenue</span><b>{nairaCompact(spotlight.revenue)}</b></div>
                        <div className="cd-mini"><span>Tickets sold</span><b>{spotlight.tickets_sold.toLocaleString()}</b></div>
                        <div className="cd-mini"><span>Sell-through</span><b>{spotlight.sell_through != null ? `${spotlight.sell_through}%` : "Open cap"}</b></div>
                        <div className="cd-mini"><span>Avg order</span><b>{naira(spotlight.avg_order)}</b></div>
                        <div className="cd-mini"><span>Reserved, unpaid</span><b>{spotlight.pending_tickets.toLocaleString()}</b></div>
                        <div className="cd-mini"><span>Ticket price</span><b>{spotlight.ticket_price === 0 ? "Free" : naira(spotlight.ticket_price)}</b></div>
                      </div>

                      <div className="cd-remrow">
                        <div className="cd-remrow__l"><Icon name="bell-alert" size={17} />Attendee reminder schedule</div>
                        <div className="cd-remrow__chips">
                          {spotlight.reminder_hours_before ? (
                            <span className="cd-remchip is-on">
                              <Icon name="check" size={12} />
                              {spotlight.reminder_hours_before}h before
                            </span>
                          ) : (
                            <span className="cd-remchip">No reminder set</span>
                          )}
                          <Button variant="secondary" size="sm" onClick={() => setEditTarget(spotlight)}>
                            <Icon name="pencil-square" size={14} /> Edit
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {showCreate && (
        <EventFormModal
          mode="create"
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            toast({ tone: "success", title: "Event published", message: "It is live and ready to share." });
            refresh();
          }}
        />
      )}

      {editTarget && (
        <EventFormModal
          mode="edit"
          event={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            toast({ tone: "success", title: "Changes saved" });
            refresh();
          }}
        />
      )}

      {shareTarget && (
        <ShareModal
          eventTitle={shareTarget.title}
          url={`${window.location.origin}/events/share/${shareTarget.share_token}`}
          onClose={() => setShareTarget(null)}
        />
      )}
    </div>
  );
}

function IconAction({ label, icon, danger, onClick }: { label: string; icon: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: 32, height: 32, borderRadius: 9,
        display: "grid", placeItems: "center", cursor: "pointer",
        background: "var(--surface)",
        color: danger ? "var(--danger)" : "var(--text-muted)",
        border: "2px solid var(--border-strong)",
        boxShadow: "1px 1px 0 var(--shadow-edge)",
        transition: "box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out)",
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "2px 2px 0 var(--shadow-edge)"; e.currentTarget.style.transform = "translate(-1px,-1px)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "1px 1px 0 var(--shadow-edge)"; e.currentTarget.style.transform = "none"; }}
      onMouseDown={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translate(1px,1px)"; }}
      onMouseUp={e => { e.currentTarget.style.boxShadow = "2px 2px 0 var(--shadow-edge)"; e.currentTarget.style.transform = "translate(-1px,-1px)"; }}
    >
      <Icon name={icon} size={15} />
    </button>
  );
}

/* ---- Create / edit event form with per-field error states ---- */
function EventFormModal({
  mode,
  event,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  event?: EventBreakdownRow;
  onClose: () => void;
  onSaved: (evt: Event) => void;
}) {
  function splitDt(iso?: string | null) {
    if (!iso) return { date: "", time: "" };
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
  }

  const startDt = splitDt(event?.starts_at);
  const endDt = splitDt(event?.ends_at);

  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [startDate, setStartDate] = useState(startDt.date);
  const [startTime, setStartTime] = useState(startDt.time || "09:00");
  const [endDate, setEndDate] = useState(endDt.date);
  const [endTime, setEndTime] = useState(endDt.time || "18:00");
  const [capacity, setCapacity] = useState(event?.capacity?.toString() ?? "");
  const [ticketPrice, setTicketPrice] = useState(event?.ticket_price?.toString() ?? "");
  const [reminderHours, setReminderHours] = useState(event?.reminder_hours_before?.toString() ?? "24");

  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formErr, setFormErr] = useState("");
  const [saving, setSaving] = useState(false);

  const fieldValidators: Record<string, () => string | null> = {
    title: () => validateRequired(title, "Event title"),
    location: () => validateRequired(location, "Location"),
    startDate: () => (startDate ? null : "Start date is required."),
    endDate: () => {
      if (!endDate) return "End date is required.";
      const start = new Date(`${startDate}T${startTime}`);
      const end = new Date(`${endDate}T${endTime}`);
      if (startDate && end <= start) return "End must be after the start.";
      return null;
    },
    ticketPrice: () => validateAmount(ticketPrice, "Ticket price"),
    capacity: () => validateInt(capacity, "Capacity", { min: 1, optional: true }),
    reminderHours: () => validateInt(reminderHours, "Reminder", { min: 1, max: 720 }),
  };

  function check(field: string) {
    const err = fieldValidators[field]();
    setErrors(prev => ({ ...prev, [field]: err }));
    return err;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const all = Object.keys(fieldValidators).map(f => check(f));
    if (all.some(Boolean)) return;

    setFormErr("");
    setSaving(true);
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim(),
        starts_at: new Date(`${startDate}T${startTime}`).toISOString(),
        ends_at: new Date(`${endDate}T${endTime}`).toISOString(),
        capacity: capacity ? Number(capacity) : undefined,
        ticket_price: Number(ticketPrice),
        reminder_hours_before: Number(reminderHours),
      };
      const result = mode === "create"
        ? await apiCreateEvent(body)
        : await apiUpdateEvent(event!.id, body);
      onSaved(result);
    } catch (err: unknown) {
      setFormErr(err instanceof Error ? err.message : "Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const fieldLabel: React.CSSProperties = {
    fontFamily: "var(--font-mono)", fontWeight: 500,
    fontSize: "var(--fs-xs)", letterSpacing: "0.08em",
    textTransform: "uppercase", color: "var(--text-muted)",
    display: "block", marginBottom: 6,
  };

  const dateErr = errors.startDate || errors.endDate;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "var(--overlay)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-4)" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{ background: "var(--surface)", border: "2px solid var(--border-strong)", borderRadius: 28, boxShadow: "var(--stack-2-lg)", width: "100%", maxWidth: 560, maxHeight: "90dvh", overflowY: "auto", padding: 40 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--fs-h2)", color: "var(--text-strong)", letterSpacing: "-0.02em", margin: 0 }}>
            {mode === "create" ? "Create event" : "Edit event"}
          </h2>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "1px solid var(--border)", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="x-mark" size={16} />
          </button>
        </div>

        {formErr && (
          <div style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-bd)", borderRadius: 10, padding: "10px 14px", color: "var(--danger)", fontSize: "var(--fs-sm)", marginBottom: 20, display: "flex", gap: 8, alignItems: "center" }}>
            <Icon name="exclamation-triangle" size={14} />{formErr}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Input
            label="Title"
            value={title}
            onChange={e => { setTitle(e.target.value); if (errors.title) setErrors(p => ({ ...p, title: null })); }}
            onBlur={() => check("title")}
            error={errors.title ?? undefined}
            placeholder="Event title"
          />

          <div>
            <label style={fieldLabel}>Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Tell attendees about this event"
              rows={3}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 14,
                border: "2px solid var(--border)", background: "var(--surface)",
                fontFamily: "var(--font-body)", fontSize: "var(--fs-body)",
                color: "var(--text-body)", outline: "none", boxSizing: "border-box", resize: "vertical",
                transition: "border-color var(--dur-base), box-shadow var(--dur-base)",
              }}
              onFocus={e => { e.target.style.borderColor = "var(--brand)"; e.target.style.boxShadow = "3px 3px 0 var(--shadow-edge)"; }}
              onBlur={e => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
            />
          </div>

          <Input
            label="Location"
            value={location}
            onChange={e => { setLocation(e.target.value); if (errors.location) setErrors(p => ({ ...p, location: null })); }}
            onBlur={() => check("location")}
            error={errors.location ?? undefined}
            placeholder="Venue or city"
          />

          <div>
            <label style={fieldLabel}>Start</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <DatePicker value={startDate} onChange={v => { setStartDate(v); setErrors(p => ({ ...p, startDate: null, endDate: null })); }} placeholder="Start date" />
              <TimePicker value={startTime} onChange={setStartTime} placeholder="Start time" />
            </div>
          </div>

          <div>
            <label style={fieldLabel}>End</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <DatePicker value={endDate} onChange={v => { setEndDate(v); setErrors(p => ({ ...p, endDate: null })); }} min={startDate} placeholder="End date" />
              <TimePicker value={endTime} onChange={setEndTime} placeholder="End time" />
            </div>
            {dateErr && (
              <p role="alert" style={{ fontSize: "var(--fs-sm)", color: "var(--danger)", margin: "6px 0 0", display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="exclamation-triangle" size={13} /> {dateErr}
              </p>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input
              label="Ticket price (NGN)"
              type="number"
              min={0}
              step={1}
              value={ticketPrice}
              onChange={e => { setTicketPrice(e.target.value); if (errors.ticketPrice) setErrors(p => ({ ...p, ticketPrice: null })); }}
              onBlur={() => check("ticketPrice")}
              error={errors.ticketPrice ?? undefined}
              placeholder="0 for free"
            />
            <Input
              label="Capacity"
              type="number"
              min={1}
              step={1}
              value={capacity}
              onChange={e => { setCapacity(e.target.value); if (errors.capacity) setErrors(p => ({ ...p, capacity: null })); }}
              onBlur={() => check("capacity")}
              error={errors.capacity ?? undefined}
              placeholder="Unlimited"
            />
          </div>

          <Input
            label="Reminder (hours before)"
            type="number"
            min={1}
            max={720}
            step={1}
            value={reminderHours}
            onChange={e => { setReminderHours(e.target.value); if (errors.reminderHours) setErrors(p => ({ ...p, reminderHours: null })); }}
            onBlur={() => check("reminderHours")}
            error={errors.reminderHours ?? undefined}
            helper="Eventees get a reminder email this many hours before the event starts."
          />

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 4 }}>
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} size="lg">
              {saving
                ? <><div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "ev-spin 0.7s linear infinite" }} /> Saving...</>
                : mode === "create" ? "Create event" : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
