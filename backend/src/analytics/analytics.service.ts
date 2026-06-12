import {
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface TicketRow {
    event_id?: string;
    status: string;
    amount_paid: number | null;
    qr_scanned_at: string | null;
}

function aggregate(tickets: TicketRow[]) {
    const paid = tickets.filter((t) => t.status === 'paid');
    const pending = tickets.filter((t) => t.status === 'pending');
    const scanned = paid.filter((t) => t.qr_scanned_at);
    const revenue = paid.reduce((sum, t) => sum + Number(t.amount_paid ?? 0), 0);
    return {
        tickets_sold: paid.length,
        pending_tickets: pending.length,
        revenue,
        qr_scans: scanned.length,
        attendance_rate:
            paid.length > 0
                ? Math.round((scanned.length / paid.length) * 100)
                : 0,
        avg_order: paid.length > 0 ? Math.round(revenue / paid.length) : 0,
        no_shows: paid.length - scanned.length,
    };
}

@Injectable()
export class AnalyticsService {
    constructor(private supabase: SupabaseService) {}

    async getOverview(creatorId: string) {
        const { data: events } = await this.supabase.db
            .from('events')
            .select('id, status, starts_at')
            .eq('creator_id', creatorId);

        if (!events || events.length === 0) {
            return {
                total_events: 0,
                active_events: 0,
                total_tickets_sold: 0,
                total_revenue: 0,
                total_attendees: 0,
                pending_tickets: 0,
                attendance_rate: 0,
                avg_order: 0,
            };
        }

        const eventIds = events.map((e) => e.id);
        const now = Date.now();
        const active_events = events.filter(
            (e) =>
                e.status === 'published' &&
                new Date(e.starts_at as string).getTime() >= now,
        ).length;

        const { data: tickets, error } = await this.supabase.db
            .from('tickets')
            .select('status, amount_paid, qr_scanned_at')
            .in('event_id', eventIds);

        if (error) throw error;

        const agg = aggregate((tickets ?? []) as TicketRow[]);

        return {
            total_events: events.length,
            active_events,
            total_tickets_sold: agg.tickets_sold,
            total_revenue: agg.revenue,
            total_attendees: agg.qr_scans,
            pending_tickets: agg.pending_tickets,
            attendance_rate: agg.attendance_rate,
            avg_order: agg.avg_order,
        };
    }

    /** Per-event sales and attendance rows for the creator dashboard table. */
    async getEventsBreakdown(creatorId: string) {
        const { data: events, error: evErr } = await this.supabase.db
            .from('events')
            .select(
                'id, title, description, starts_at, ends_at, location, status, capacity, ticket_price, reminder_hours_before, share_token',
            )
            .eq('creator_id', creatorId)
            .order('starts_at', { ascending: true });

        if (evErr) throw evErr;
        if (!events || events.length === 0) return [];

        const eventIds = events.map((e) => e.id);

        const { data: tickets, error } = await this.supabase.db
            .from('tickets')
            .select('event_id, status, amount_paid, qr_scanned_at')
            .in('event_id', eventIds);

        if (error) throw error;

        const byEvent: Record<string, TicketRow[]> = {};
        (tickets ?? []).forEach((t: TicketRow) => {
            const key = t.event_id as string;
            (byEvent[key] ??= []).push(t);
        });

        return events.map((e) => {
            const agg = aggregate(byEvent[e.id] ?? []);
            return {
                ...e,
                ...agg,
                sell_through: e.capacity
                    ? Math.round((agg.tickets_sold / e.capacity) * 100)
                    : null,
            };
        });
    }

    async getEventStats(eventId: string, creatorId: string) {
        const { data: event, error: evErr } = await this.supabase.db
            .from('events')
            .select(
                'id, creator_id, title, starts_at, capacity, ticket_price, reminder_hours_before, status',
            )
            .eq('id', eventId)
            .single();

        if (evErr || !event) throw new NotFoundException('Event not found');
        if (event.creator_id !== creatorId) throw new ForbiddenException();

        const { data: tickets, error } = await this.supabase.db
            .from('tickets')
            .select('status, amount_paid, qr_scanned_at')
            .eq('event_id', eventId);

        if (error) throw error;

        const agg = aggregate((tickets ?? []) as TicketRow[]);

        return {
            event_id: eventId,
            title: event.title,
            starts_at: event.starts_at,
            status: event.status,
            capacity: event.capacity,
            ticket_price: event.ticket_price,
            reminder_hours_before: event.reminder_hours_before,
            ...agg,
            sell_through: event.capacity
                ? Math.round((agg.tickets_sold / event.capacity) * 100)
                : null,
        };
    }
}
