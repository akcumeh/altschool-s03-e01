import {
    ConflictException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SupabaseService } from '../supabase/supabase.service';
import { TicketsService } from './tickets.service';

const mockEvent = {
    id: 'event-1',
    creator_id: 'creator-1',
    capacity: null,
    status: 'published',
};

const mockTicket = {
    id: 'ticket-1',
    event_id: 'event-1',
    eventee_id: 'eventee-1',
    status: 'pending',
};

describe('TicketsService', () => {
    let service: TicketsService;
    let db: any;

    beforeEach(async () => {
        db = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            neq: jest.fn().mockReturnThis(),
            single: jest.fn(),
        };

        const module = await Test.createTestingModule({
            providers: [
                TicketsService,
                { provide: SupabaseService, useValue: { db } },
            ],
        }).compile();

        service = module.get(TicketsService);
    });

    describe('create', () => {
        it('prevents creator from buying their own event ticket', async () => {
            db.single.mockResolvedValueOnce({ data: mockEvent });

            await expect(
                service.create('event-1', 'creator-1'),
            ).rejects.toThrow(ForbiddenException);
        });

        it('throws ConflictException on duplicate ticket (pg error 23505)', async () => {
            db.single.mockResolvedValueOnce({ data: mockEvent });
            db.single.mockResolvedValueOnce({
                data: null,
                error: { code: '23505', message: 'unique violation' },
            });

            await expect(
                service.create('event-1', 'eventee-1'),
            ).rejects.toThrow(ConflictException);
        });

        it('throws ForbiddenException for non-published event', async () => {
            db.single.mockResolvedValueOnce({
                data: { ...mockEvent, status: 'cancelled' },
            });

            await expect(
                service.create('event-1', 'eventee-1'),
            ).rejects.toThrow(ForbiddenException);
        });

        it('creates a pending ticket successfully', async () => {
            db.single
                .mockResolvedValueOnce({ data: mockEvent })
                .mockResolvedValueOnce({ data: mockTicket, error: null });

            const result = await service.create('event-1', 'eventee-1');
            expect(result.status).toBe('pending');
        });
    });

    describe('findById', () => {
        it('throws NotFoundException for missing ticket', async () => {
            db.single.mockResolvedValue({
                data: null,
                error: { message: 'not found' },
            });

            await expect(service.findById('bad-id')).rejects.toThrow(
                NotFoundException,
            );
        });
    });
});
