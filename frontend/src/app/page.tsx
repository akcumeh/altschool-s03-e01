"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { apiGetEvents, type Event } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import Button from "@/components/Button";

const CATEGORIES = ["All", "Concert", "Music", "Tech", "Comedy", "Art", "Cultural", "Sports", "Theatre"];

/* Deterministic gradient from event id */
function gradient(id: string): string {
  const palettes = [
    "linear-gradient(135deg,#3A3266 0%,#6E5A93 100%)",
    "linear-gradient(135deg,#6E5A93 0%,#A885B8 100%)",
    "linear-gradient(135deg,#211733 0%,#3A3266 100%)",
    "linear-gradient(135deg,#A885B8 0%,#DCA9C3 100%)",
    "linear-gradient(135deg,#3A3266 0%,#DCA9C3 80%)",
    "linear-gradient(135deg,#211733 0%,#6E5A93 100%)",
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palettes[h % palettes.length];
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function fmtMonth(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { month: "short" }).toUpperCase();
}
function fmtDay(iso: string) {
  return new Date(iso).getDate().toString();
}
function price(n: number) {
  return n === 0 ? "Free" : `NGN ${n.toLocaleString()}`;
}

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("All");

  useEffect(() => {
    apiGetEvents().then(setEvents).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = events.filter(ev => {
    const matchCat = cat === "All" || (ev.category || "").toLowerCase() === cat.toLowerCase();
    const q = search.toLowerCase();
    const matchSearch = !q
      || ev.title.toLowerCase().includes(q)
      || (ev.location || "").toLowerCase().includes(q)
      || (ev.description || "").toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  // While a search is active, skip the featured spotlight so results render
  // as a plain grid instead of one result ballooning into the big card.
  const isSearching = search.trim().length > 0;
  const featured = isSearching ? undefined : filtered[0];
  const rest = isSearching ? filtered : filtered.slice(1);

  return (
    <div style={{ background: "var(--bg-page)", minHeight: "100dvh" }}>
      <style>{`
        /* Featured card: collapse 2-column to 1-column below 640px */
        .ev-featured-card { display: grid; grid-template-columns: 1fr 380px; min-height: 260px; }
        @media (max-width: 640px) {
          .ev-featured-card { grid-template-columns: 1fr !important; }
          .ev-featured-info  { min-height: 180px; }
          .ev-featured-ticket{ border-top: 2px solid var(--border-strong); }
        }
        /* Hero search: stack vertically on very small screens */
        @media (max-width: 480px) {
          .ev-hero-search { flex-direction: column !important; }
          .ev-hero-search button { width: 100% !important; }
        }
      `}</style>

      {/* ── Hero (dark plum + stage-light) ── */}
      <section
        className="ev-stagelight"
        style={{
          background: "var(--plum)",
          padding: "clamp(48px,8vw,96px) 0 clamp(40px,6vw,72px)",
        }}
      >
        <div className="ev-container" style={{ position: "relative", zIndex: 1 }}>
          {/* Eyebrow */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ width: 14, height: 2, background: "var(--blush)", flexShrink: 0 }} />
            <span style={{
              fontFamily: "var(--font-mono)", fontWeight: 500,
              fontSize: "var(--fs-xs)", letterSpacing: "0.08em", textTransform: "uppercase",
              color: "rgba(242,217,201,0.75)",
            }}>Events / Lagos</span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: "var(--font-display)", fontWeight: 800,
            fontSize: "var(--fs-display)", color: "var(--paper)",
            letterSpacing: "-0.035em", lineHeight: 1.04,
            margin: "0 0 20px", textWrap: "balance", maxWidth: 880,
          }}>
            Discover <span style={{ color: "var(--blush)" }}>unforgettable</span> moments
          </h1>

          <p style={{
            color: "rgba(251,245,239,0.65)", fontSize: "var(--fs-body-lg)",
            lineHeight: "var(--lh-relaxed)", margin: "0 0 36px",
            maxWidth: 560, textWrap: "pretty",
          }}>
            Concerts, comedy nights, art fairs, tech summits - every event that matters, all in one place.
          </p>

          {/* Search bar */}
          <div className="ev-hero-search" style={{ display: "flex", gap: 10, maxWidth: 560 }}>
            <div style={{ flex: 1, position: "relative" }}>
              <div style={{
                position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                color: "rgba(251,245,239,0.4)", pointerEvents: "none",
              }}>
                <Icon name="magnifying-glass" size={16} />
              </div>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search events or venues..."
                style={{
                  width: "100%", padding: "13px 14px 13px 42px",
                  background: "rgba(251,245,239,0.1)",
                  border: "1.5px solid rgba(251,245,239,0.25)",
                  borderRadius: 999,
                  fontFamily: "var(--font-body)", fontSize: "var(--fs-body)",
                  color: "var(--paper)", outline: "none", boxSizing: "border-box",
                  transition: "border-color var(--dur-base)",
                }}
                onFocus={e => (e.target.style.borderColor = "rgba(251,245,239,0.6)")}
                onBlur={e => (e.target.style.borderColor = "rgba(251,245,239,0.25)")}
              />
            </div>
            <Button variant="warm" style={{ flexShrink: 0 }}>Search</Button>
          </div>
        </div>
      </section>

      <div className="ev-container" style={{ paddingTop: 40, paddingBottom: 80 }}>
        {/* ── Featured event ── */}
        {!loading && featured && (
          <div style={{ marginBottom: 48 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{ width: 14, height: 2, background: "var(--highlight)" }} />
              <span style={{
                fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: "var(--fs-xs)",
                letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)",
              }}>Featured event</span>
            </div>
            <div
              className="ev-featured-card"
              onClick={() => router.push(`/events/${featured.id}`)}
              style={{
                background: gradient(featured.id),
                border: "2px solid var(--border-strong)", boxShadow: "var(--stack-2)",
                borderRadius: 20, overflow: "hidden", cursor: "pointer",
                transition: "box-shadow var(--dur-base), border-color var(--dur-base)",
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--stack-2-lg)"; e.currentTarget.style.borderColor = "var(--brand)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "var(--stack-2)"; e.currentTarget.style.borderColor = "var(--border-strong)"; }}
            >
              <div className="ev-featured-info" style={{ padding: "36px 40px", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                {featured.category && (
                  <span style={{
                    display: "inline-block", padding: "4px 12px",
                    background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
                    borderRadius: 999, fontSize: "var(--fs-xs)", fontFamily: "var(--font-mono)",
                    color: "rgba(255,255,255,0.9)", letterSpacing: "0.08em",
                    textTransform: "uppercase", marginBottom: 12, alignSelf: "flex-start",
                  }}>{featured.category}</span>
                )}
                <h2 style={{
                  fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--fs-h1)",
                  color: "#fff", letterSpacing: "-0.03em", margin: "0 0 10px", lineHeight: 1.1,
                }}>{featured.title}</h2>
                <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "var(--fs-sm)", display: "flex", gap: 16 }}>
                  <span>{fmtDate(featured.starts_at)}</span>
                  <span>{featured.location?.split(",")[0]}</span>
                </div>
              </div>
              <div className="ev-featured-ticket" style={{
                background: "var(--surface)", padding: "28px 32px",
                display: "flex", flexDirection: "column", justifyContent: "center", gap: 16,
              }}>
                <div>
                  <div style={{
                    fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)",
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    color: "var(--text-muted)", marginBottom: 4,
                  }}>Ticket price</div>
                  <div style={{
                    fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--fs-h2)",
                    color: "var(--text-strong)", letterSpacing: "-0.03em",
                  }}>{price(featured.ticket_price)}</div>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>Date</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-sm)", color: "var(--text-body)" }}>{fmtDate(featured.starts_at)}</div>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>Venue</div>
                  <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-body)" }}>{featured.location}</div>
                </div>
                <Button size="lg" onClick={e => { e.stopPropagation(); router.push(`/events/${featured.id}`); }}>
                  Get tickets <Icon name="arrow-right" size={15} />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Category filters ── */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 28, scrollbarWidth: "none" }}>
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setCat(c)}
              style={{
                padding: "7px 16px", borderRadius: 999,
                border: cat === c ? "2px solid var(--border-strong)" : "1.5px solid var(--border)",
                background: cat === c ? "var(--ink)" : "var(--surface)",
                color: cat === c ? "var(--paper)" : "var(--text-body)",
                fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "var(--fs-sm)",
                cursor: "pointer", whiteSpace: "nowrap",
                boxShadow: cat === c ? "var(--stack-1)" : "none",
                transition: "all var(--dur-fast)",
              }}
            >{c}</button>
          ))}
        </div>

        {/* ── Event grid ── */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
            <div style={{ width: 36, height: 36, border: "3px solid var(--border)", borderTopColor: "var(--brand)", borderRadius: "50%", animation: "ev-spin 0.7s linear infinite" }} />
          </div>
        ) : rest.length === 0 && !featured ? (
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--fs-h4)", color: "var(--text-muted)", margin: "0 0 8px" }}>No events found</p>
            <p style={{ color: "var(--text-subtle)", fontSize: "var(--fs-body)" }}>
              {search ? `No events matching "${search}".` : "No events in this category yet."}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 24 }}>
            {rest.map(ev => <EventCardItem key={ev.id} ev={ev} onClick={() => router.push(`/events/${ev.id}`)} />)}
          </div>
        )}
      </div>

    </div>
  );
}

function EventCardItem({ ev, onClick }: { ev: Event; onClick: () => void }) {
  const ticketsSold = ev.tickets_sold ?? 0;
  const spotsLeft = ev.capacity ? Math.max(0, ev.capacity - ticketsSold) : null;
  const isSoldOut = ev.capacity != null && spotsLeft === 0;
  const isAlmostFull = ev.capacity != null && spotsLeft != null && spotsLeft > 0
    && spotsLeft / ev.capacity <= 0.1;

  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--surface)",
        border: "2px solid var(--border-strong)",
        boxShadow: "var(--stack-1-lg)",
        borderRadius: 20, overflow: "hidden", cursor: "pointer",
        transition: "box-shadow var(--dur-base), border-color var(--dur-base)",
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--stack-2)"; e.currentTarget.style.borderColor = "var(--brand)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "var(--stack-1-lg)"; e.currentTarget.style.borderColor = "var(--border-strong)"; }}
    >
      {/* Poster */}
      <div style={{ background: gradient(ev.id), height: 160, position: "relative", display: "flex", alignItems: "flex-end" }}>
        {/* Date chip */}
        <div style={{
          position: "absolute", top: 12, right: 12,
          background: "var(--surface)", border: "2px solid var(--border-strong)",
          boxShadow: "2px 2px 0 var(--shadow-edge)",
          borderRadius: 10, padding: "6px 10px", textAlign: "center", minWidth: 44,
        }}>
          <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.6rem", color: "var(--brand)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{fmtMonth(ev.starts_at)}</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.25rem", color: "var(--text-strong)", lineHeight: 1 }}>{fmtDay(ev.starts_at)}</div>
        </div>
        {ev.category && (
          <span style={{
            position: "absolute", top: 12, left: 12,
            padding: "3px 10px", background: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.25)", borderRadius: 999,
            fontSize: "var(--fs-xs)", fontFamily: "var(--font-mono)",
            color: "rgba(255,255,255,0.9)", letterSpacing: "0.08em", textTransform: "uppercase",
          }}>{ev.category}</span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "16px 18px 18px" }}>
        <h3 style={{
          fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--fs-title)",
          color: "var(--text-strong)", margin: "0 0 8px",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{ev.title}</h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
          {ev.location && (
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
              <Icon name="map-pin" size={13} style={{ color: "var(--lilac)" }} />{ev.location.split(",")[0]}
            </span>
          )}
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
            <Icon name="clock" size={13} style={{ color: "var(--lilac)" }} />{fmtTime(ev.starts_at)}
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "var(--fs-sm)",
            color: ev.ticket_price === 0 ? "var(--success)" : "var(--text-strong)",
            letterSpacing: "0.04em",
          }}>{price(ev.ticket_price)}</span>
          {isSoldOut ? (
            <span style={{
              padding: "2px 8px", borderRadius: 999,
              background: "var(--danger-bg)", border: "1px solid var(--danger-bd)",
              fontSize: "var(--fs-xs)", fontFamily: "var(--font-mono)",
              color: "var(--danger)", letterSpacing: "0.06em", textTransform: "uppercase",
            }}>Sold out</span>
          ) : isAlmostFull ? (
            <span style={{
              padding: "2px 8px", borderRadius: 999,
              background: "var(--warning-bg)", border: "1px solid var(--warning-bd)",
              fontSize: "var(--fs-xs)", fontFamily: "var(--font-mono)",
              color: "var(--warning)", letterSpacing: "0.06em", textTransform: "uppercase",
            }}>{spotsLeft} spot{spotsLeft === 1 ? "" : "s"} left</span>
          ) : (
            <span style={{
              fontSize: "var(--fs-xs)", fontFamily: "var(--font-mono)",
              color: "var(--text-subtle)", letterSpacing: "0.04em",
            }}>
              {ev.capacity ? `${ev.capacity} spots` : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
