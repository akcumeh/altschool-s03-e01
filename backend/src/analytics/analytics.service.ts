import {
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AnalyticsService {
    constructor(private supabase: SupabaseService) {}

    async getOverview(creatorId: string) {
        const { data: events } = await this.supabase.db
            .from('events')
            .select('id')
            .eq('creator_id', creatorId);

        if (!events || events.length === 0) {
            return {
                total_tickets_sold: 0,
                total_revenue: 0,
                total_attendees: 0,
            };
        }

        const eventIds = events.map((e) => e.id);

        const { data: tickets, error } = await this.supabase.db
            .from('tickets')
            .select('amount_paid, qr_scanned_at')
            .in('event_id', eventIds)
            .eq('status', 'paid');

        if (error) throw error;

        const total_tickets_sold = tickets?.length ?? 0;
        const total_revenue = tickets?.reduce(
            (sum, t) => sum + Number(t.amount_paid ?? 0),
            0,
        );
        const total_attendees =
            tickets?.filter((t) => t.qr_scanned_at).length ?? 0;

        return { total_tickets_sold, total_revenue, total_attendees };
    }

    async getEventStats(eventId: string, creatorId: string) {
        const { data: event, error: evErr } = await this.supabase.db
            .from('events')
            .select('id, creator_id, title')
            .eq('id', eventId)
            .single();

        if (evErr || !event) throw new NotFoundException('Event not found');
        if (event.creator_id !== creatorId) throw new ForbiddenException();

        const { data: tickets, error } = await this.supabase.db
            .from('tickets')
            .select('amount_paid, qr_scanned_at')
            .eq('event_id', eventId)
            .eq('status', 'paid');

        if (error) throw error;

        const tickets_sold = tickets?.length ?? 0;
        const revenue = tickets?.reduce(
            (sum, t) => sum + Number(t.amount_paid ?? 0),
            0,
        );
        const qr_scans = tickets?.filter((t) => t.qr_scanned_at).length ?? 0;

        return {
            event_id: eventId,
            title: event.title,
            tickets_sold,
            revenue,
            qr_scans,
        };
    }
}
