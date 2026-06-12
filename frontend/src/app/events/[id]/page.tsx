"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { apiGetEvent, type Event } from "@/lib/api";
import EventDetail from "@/components/EventDetail";

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    apiGetEvent(id)
      .then(setEvent)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PageLoader />;
  if (notFound || !event) return <NotFound />;
  return <EventDetail event={event} />;
}

function PageLoader() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50dvh" }}>
      <div style={{ width: 40, height: 40, border: "3px solid var(--border)", borderTopColor: "var(--brand)", borderRadius: "50%", animation: "ev-spin 0.8s linear infinite" }} />
    </div>
  );
}

function NotFound() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)", padding: "var(--space-11) var(--space-4)", textAlign: "center" }}>
      <p className="t-h2" style={{ color: "var(--text-muted)" }}>Event not found</p>
      <p style={{ color: "var(--text-subtle)" }}>This event may have been removed or doesn&apos;t exist.</p>
    </div>
  );
}
