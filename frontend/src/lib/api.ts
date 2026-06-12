/* In dev, fall back to the same hostname the page was served from (port 3000).
   This means mobile devices on the same LAN automatically hit the right backend
   instead of resolving "localhost" to themselves. */
const BASE = process.env.NEXT_PUBLIC_API_URL
  ?? (typeof window !== "undefined"
    ? `http://${window.location.hostname}:3000`
    : "http://localhost:3000");

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ev_token");
}

async function request<T>(
  path: string,
  opts: RequestInit = {},
  auth = false,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (Array.isArray(body.message)) msg = body.message.join(", ");
      else if (body.message) msg = body.message;
    } catch {
      // ignore parse errors
    }
    throw new Error(msg);
  }

  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

/* ---- Auth ---- */
export function apiRegister(body: { name: string; email: string; password: string; role: "creator" | "eventee" }) {
  return request<{ id: string; name: string; email: string; role: string; created_at: string }>(
    "/auth/register",
    { method: "POST", body: JSON.stringify(body) },
  );
}
export function apiLogin(body: { email: string; password: string }) {
  return request<{ access_token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/* ---- Events ---- */
export interface Event {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  ticket_price: number;
  status: string;
  category?: string;
  reminder_hours_before: number;
  share_token: string;
  created_at: string;
  tickets_sold?: number;
}
export function apiGetEvents() {
  return request<Event[]>("/events");
}
export function apiGetEvent(id: string) {
  return request<Event>(`/events/${id}`);
}
export function apiGetEventByToken(token: string) {
  return request<Event>(`/events/share/${token}`);
}
export function apiGetMyEvents() {
  return request<Event[]>("/events/mine", {}, true);
}
export function apiCreateEvent(body: {
  title: string; description?: string; location: string;
  starts_at: string; ends_at: string; capacity?: number;
  ticket_price: number; reminder_hours_before?: number;
}) {
  return request<Event>("/events", { method: "POST", body: JSON.stringify(body) }, true);
}
export function apiUpdateEvent(id: string, body: Partial<{
  title: string; description: string; location: string;
  starts_at: string; ends_at: string; capacity: number;
  ticket_price: number; reminder_hours_before: number;
}>) {
  return request<Event>(`/events/${id}`, { method: "PATCH", body: JSON.stringify(body) }, true);
}
export function apiDeleteEvent(id: string) {
  return request<{ message: string }>(`/events/${id}`, { method: "DELETE" }, true);
}
export function apiGetEventAttendees(id: string) {
  return request<unknown[]>(`/events/${id}/attendees`, {}, true);
}

/* ---- Tickets ---- */
export interface Ticket {
  id: string;
  event_id: string;
  eventee_id: string;
  status: "pending" | "paid" | "cancelled";
  paystack_reference?: string;
  amount_paid?: number;
  qr_code?: string;
  paid_at?: string;
  qr_scanned_at?: string;
  reminder_hours_before?: number;
  created_at: string;
  events?: { title: string; starts_at: string; location: string; status: string };
}
export function apiCreateTicket(eventId: string) {
  return request<Ticket>(`/tickets/${eventId}`, { method: "POST" }, true);
}
export function apiGetMyTickets() {
  return request<Ticket[]>("/tickets/mine", {}, true);
}
export function apiSetReminder(ticketId: string, reminder_hours_before: number) {
  return request<Ticket>(
    `/tickets/${ticketId}/reminder`,
    { method: "PATCH", body: JSON.stringify({ reminder_hours_before }) },
    true,
  );
}
export function apiScanTicket(ticketId: string) {
  return request<Ticket>(`/tickets/${ticketId}/scan`, { method: "POST" }, true);
}

/* ---- Payment ---- */
export function apiInitPayment(
  eventId: string,
  buyer?: { email?: string; name?: string },
) {
  return request<{ authorization_url: string; reference: string }>(
    `/tickets/${eventId}/pay`,
    { method: "POST", body: JSON.stringify(buyer ?? {}) },
    true,
  );
}
export function apiVerifyPayment(reference: string) {
  return request<Ticket & { message?: string; ticket?: Ticket }>(
    `/payment/verify`,
    { method: "POST", body: JSON.stringify({ reference }) },
    true,
  );
}

/* ---- Analytics ---- */
export interface AnalyticsOverview {
  total_events: number;
  active_events: number;
  total_tickets_sold: number;
  total_revenue: number;
  total_attendees: number;
  pending_tickets: number;
  attendance_rate: number;
  avg_order: number;
}
export interface EventStats {
  event_id: string;
  title: string;
  starts_at: string;
  status: string;
  capacity: number | null;
  ticket_price: number;
  reminder_hours_before: number | null;
  tickets_sold: number;
  pending_tickets: number;
  revenue: number;
  qr_scans: number;
  attendance_rate: number;
  avg_order: number;
  no_shows: number;
  sell_through: number | null;
}
export interface EventBreakdownRow {
  id: string;
  title: string;
  description: string | null;
  share_token: string;
  starts_at: string;
  ends_at: string | null;
  location: string;
  status: string;
  capacity: number | null;
  ticket_price: number;
  reminder_hours_before: number | null;
  tickets_sold: number;
  pending_tickets: number;
  revenue: number;
  qr_scans: number;
  attendance_rate: number;
  avg_order: number;
  no_shows: number;
  sell_through: number | null;
}
export function apiGetAnalyticsOverview() {
  return request<AnalyticsOverview>("/analytics/overview", {}, true);
}
export function apiGetAnalyticsEvents() {
  return request<EventBreakdownRow[]>("/analytics/events", {}, true);
}
export function apiGetEventStats(eventId: string) {
  return request<EventStats>(`/analytics/events/${eventId}`, {}, true);
}
