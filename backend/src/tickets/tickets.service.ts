import {
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class TicketsService {
    constructor(private supabase: SupabaseService) {}

    async create(eventId: string, eventeeId: string) {
        const { data: event } = await this.supabase.db
            .from('events')
            .select('id, creator_id, capacity, status')
            .eq('id', eventId)
            .single();

        if (!event) throw new NotFoundException('Event not found');
        if (event.status !== 'published')
            throw new ForbiddenException('Event is not open for registration');
        if (event.creator_id === eventeeId)
            throw new ForbiddenException(
                'Creators cannot buy tickets for their own events',
            );

        if (event.capacity) {
            const { count } = await this.supabase.db
                .from('tickets')
                .select('id', { count: 'exact', head: true })
                .eq('event_id', eventId)
                .neq('status', 'cancelled');
            if (count && count >= event.capacity)
                throw new ConflictException('Event is at full capacity');
        }

        const { data, error } = await this.supabase.db
            .from('tickets')
            .insert({ event_id: eventId, eventee_id: eventeeId })
            .select()
            .single();

        if (error) {
            if (error.code === '23505')
                throw new ConflictException(
                    'You already have a ticket for this event',
                );
            throw error;
        }
        return data;
    }

    async findMine(eventeeId: string) {
        const { data, error } = await this.supabase.db
            .from('tickets')
            .select('*, events(title, starts_at, location, status)')
            .eq('eventee_id', eventeeId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    }

    async findById(ticketId: string) {
        const { data, error } = await this.supabase.db
            .from('tickets')
            .select('*, events(title, starts_at, location), eventful_users(name, email)')
            .eq('id', ticketId)
            .single();
        if (error || !data) throw new NotFoundException('Ticket not found');
        return data;
    }

    async setReminder(ticketId: string, eventeeId: string, hours: number) {
        const ticket = await this.findById(ticketId);
        if (ticket.eventee_id !== eventeeId) throw new ForbiddenException();

        const { data, error } = await this.supabase.db
            .from('tickets')
            .update({ reminder_hours_before: hours })
            .eq('id', ticketId)
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    async scan(ticketId: string, creatorId: string) {
        const ticket = await this.findById(ticketId);

        const { data: event } = await this.supabase.db
            .from('events')
            .select('creator_id')
            .eq('id', ticket.event_id)
            .single();

        if (!event || event.creator_id !== creatorId)
            throw new ForbiddenException(
                'Only the event creator can scan tickets',
            );

        if (ticket.status !== 'paid')
            throw new ForbiddenException('Ticket has not been paid');

        if (ticket.qr_scanned_at)
            throw new ConflictException('Ticket has already been scanned');

        const { data, error } = await this.supabase.db
            .from('tickets')
            .update({ qr_scanned_at: new Date().toISOString() })
            .eq('id', ticketId)
            .select('*, events(title, starts_at), eventful_users(name, email)')
            .single();
        if (error) throw error;
        return data;
    }

    async updateAfterPayment(opts: {
        ticketId: string;
        reference: string;
        amountPaid: number;
        qrCode: string;
    }) {
        const { data, error } = await this.supabase.db
            .from('tickets')
            .update({
                status: 'paid',
                paystack_reference: opts.reference,
                amount_paid: opts.amountPaid,
                qr_code: opts.qrCode,
                paid_at: new Date().toISOString(),
            })
            .eq('id', opts.ticketId)
            .select('*, events(title, starts_at, location), eventful_users(name, email)')
            .single();
        if (error) throw error;
        return data;
    }

    async findByPaystackReference(reference: string) {
        const { data } = await this.supabase.db
            .from('tickets')
            .select('*')
            .eq('paystack_reference', reference)
            .single();
        return data;
    }
}
