"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { apiGetEventByToken, type Event } from "@/lib/api";
import EventDetail from "@/components/EventDetail";

export default function SharedEventPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    apiGetEventByToken(token)
      .then(setEvent)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50dvh" }}>
      <div style={{ width: 40, height: 40, border: "3px solid var(--border)", borderTopColor: "var(--brand)", borderRadius: "50%", animation: "ev-spin 0.8s linear infinite" }} />
    </div>
  );

  if (notFound || !event) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)", padding: "var(--space-11) var(--space-4)", textAlign: "center" }}>
      <p className="t-h2" style={{ color: "var(--text-muted)" }}>Event not found</p>
      <p style={{ color: "var(--text-subtle)" }}>This share link is invalid or has expired.</p>
    </div>
  );

  return <EventDetail event={event} />;
}
