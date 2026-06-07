import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SupabaseService } from '../supabase/supabase.service';
import { EventsService } from './events.service';

const mockEvent = {
    id: 'event-1',
    creator_id: 'user-1',
    title: 'Test Event',
    status: 'published',
    starts_at: new Date().toISOString(),
};

const makeDbChain = (returnValue: any) => {
    const chain: any = {};
    const methods = [
        'from',
        'select',
        'insert',
        'update',
        'delete',
        'eq',
        'order',
        'single',
    ];
    methods.forEach((m) => {
        chain[m] = jest.fn().mockReturnValue(chain);
    });
    chain.single = jest.fn().mockResolvedValue(returnValue);
    chain.order = jest.fn().mockResolvedValue(returnValue);
    chain.eq = jest.fn().mockReturnValue(chain);
    return chain;
};

describe('EventsService', () => {
    let service: EventsService;
    let supabase: { db: any };
    let cache: any;

    beforeEach(async () => {
        const dbChain: any = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            delete: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            single: jest.fn(),
        };

        supabase = { db: dbChain };
        cache = {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn(),
            del: jest.fn(),
        };

        const module = await Test.createTestingModule({
            providers: [
                EventsService,
                { provide: SupabaseService, useValue: supabase },
                { provide: CACHE_MANAGER, useValue: cache },
            ],
        }).compile();

        service = module.get(EventsService);
    });

    describe('create', () => {
        it('inserts event and busts cache', async () => {
            supabase.db.single.mockResolvedValue({
                data: mockEvent,
                error: null,
            });
            const result = await service.create(
                { title: 'Test', starts_at: '' } as any,
                'user-1',
            );
            expect(cache.del).toHaveBeenCalled();
            expect(result).toEqual(mockEvent);
        });
    });

    describe('update', () => {
        it('throws ForbiddenException for non-owner', async () => {
            supabase.db.single.mockResolvedValueOnce({
                data: mockEvent,
                error: null,
            });

            await expect(
                service.update('event-1', { title: 'New' }, 'other-user'),
            ).rejects.toThrow(ForbiddenException);
        });
    });

    describe('remove', () => {
        it('throws ForbiddenException for non-owner', async () => {
            supabase.db.single.mockResolvedValueOnce({
                data: mockEvent,
                error: null,
            });

            await expect(
                service.remove('event-1', 'other-user'),
            ).rejects.toThrow(ForbiddenException);
        });
    });

    describe('findOne', () => {
        it('throws NotFoundException when event is missing', async () => {
            supabase.db.single.mockResolvedValue({
                data: null,
                error: { message: 'not found' },
            });

            await expect(service.findOne('bad-id')).rejects.toThrow(
                NotFoundException,
            );
        });
    });
});
