import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
    BadRequestException,
    ForbiddenException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

const EVENTS_CACHE_KEY = 'events:all';

@Injectable()
export class EventsService {
    constructor(
        private supabase: SupabaseService,
        @Inject(CACHE_MANAGER) private cache: Cache,
    ) {}

    async create(dto: CreateEventDto, creatorId: string) {
        const { data, error } = await this.supabase.db
            .from('events')
            .insert({ ...dto, creator_id: creatorId })
            .select()
            .single();
        if (error) throw error;
        await this.cache.del(EVENTS_CACHE_KEY);
        return data;
    }

    async findAll() {
        let events = await this.cache.get<any[]>(EVENTS_CACHE_KEY);
        if (!events) {
            const { data, error } = await this.supabase.db
                .from('events')
                .select('*')
                .eq('status', 'published')
                .order('starts_at', { ascending: true });
            if (error) throw error;
            await this.cache.set(EVENTS_CACHE_KEY, data);
            events = data;
        }

        // Always fetch fresh ticket counts — tickets change independently of the event cache
        const { data: soldRows } = await this.supabase.db
            .from('tickets')
            .select('event_id')
            .eq('status', 'paid');

        const countMap: Record<string, number> = {};
        soldRows?.forEach((r: { event_id: string }) => {
            countMap[r.event_id] = (countMap[r.event_id] ?? 0) + 1;
        });

        return (events ?? []).map((e: any) => ({
            ...e,
            tickets_sold: countMap[e.id] ?? 0,
        }));
    }

    async findMine(creatorId: string) {
        const { data, error } = await this.supabase.db
            .from('events')
            .select('*')
            .eq('creator_id', creatorId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    }

    async findOne(id: string) {
        const { data, error } = await this.supabase.db
            .from('events')
            .select('*')
            .eq('id', id)
            .single();
        if (error || !data) throw new NotFoundException('Event not found');

        const { count: ticketsSold } = await this.supabase.db
            .from('tickets')
            .select('id', { count: 'exact', head: true })
            .eq('event_id', id)
            .eq('status', 'paid');

        return { ...data, tickets_sold: ticketsSold ?? 0 };
    }

    async findByShareToken(token: string) {
        const { data, error } = await this.supabase.db
            .from('events')
            .select('*')
            .eq('share_token', token)
            .single();
        if (error || !data) throw new NotFoundException('Event not found');
        return data;
    }

    async update(id: string, dto: UpdateEventDto, userId: string) {
        const event = await this.findOne(id);
        if (event.creator_id !== userId) throw new ForbiddenException();

        // class-transformer adds all class fields as undefined own properties;
        // filter to only the fields the caller actually provided.
        const updates = Object.fromEntries(
            Object.entries(dto).filter(([, v]) => v !== undefined),
        ) as UpdateEventDto;

        if (Object.keys(updates).length === 0) {
            throw new BadRequestException('Request body cannot be empty');
        }

        if (updates.starts_at !== undefined || updates.ends_at !== undefined) {
            const effectiveStartsAt = updates.starts_at ?? (event.starts_at as string);
            const effectiveEndsAt = updates.ends_at ?? (event.ends_at as string | null);

            if (effectiveEndsAt && new Date(effectiveEndsAt) <= new Date(effectiveStartsAt)) {
                throw new BadRequestException('ends_at must be after starts_at');
            }
        }

        const { data, error } = await this.supabase.db
            .from('events')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        await this.cache.del(EVENTS_CACHE_KEY);
        return data;
    }

    async findAttendees(eventId: string, creatorId: string) {
        const event = await this.findOne(eventId);
        if (event.creator_id !== creatorId) throw new ForbiddenException();

        const { data, error } = await this.supabase.db
            .from('tickets')
            .select(
                'id, status, amount_paid, paid_at, created_at, eventful_users(id, name, email)',
            )
            .eq('event_id', eventId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    }

    async remove(id: string, userId: string) {
        const event = await this.findOne(id);
        if (event.creator_id !== userId) throw new ForbiddenException();

        const { error } = await this.supabase.db
            .from('events')
            .delete()
            .eq('id', id);
        if (error) throw error;
        await this.cache.del(EVENTS_CACHE_KEY);
        return { message: 'Event deleted' };
    }
}
