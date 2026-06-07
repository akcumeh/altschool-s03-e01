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
        const cached = await this.cache.get(EVENTS_CACHE_KEY);
        if (cached) return cached;

        const { data, error } = await this.supabase.db
            .from('events')
            .select('*')
            .eq('status', 'published')
            .order('starts_at', { ascending: true });
        if (error) throw error;

        await this.cache.set(EVENTS_CACHE_KEY, data);
        return data;
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
        return data;
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

        if (Object.keys(dto).length === 0) {
            throw new BadRequestException('Request body cannot be empty');
        }

        if (dto.starts_at !== undefined || dto.ends_at !== undefined) {
            const effectiveStartsAt = dto.starts_at ?? (event.starts_at as string);
            const effectiveEndsAt = dto.ends_at ?? (event.ends_at as string | null);

            if (effectiveEndsAt && new Date(effectiveEndsAt) <= new Date(effectiveStartsAt)) {
                throw new BadRequestException('ends_at must be after starts_at');
            }
        }

        const { data, error } = await this.supabase.db
            .from('events')
            .update(dto)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        await this.cache.del(EVENTS_CACHE_KEY);
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
