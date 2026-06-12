import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SupabaseService } from '../supabase/supabase.service';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
    let service: AnalyticsService;
    let db: any;

    beforeEach(async () => {
        db = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            single: jest.fn(),
        };

        const module = await Test.createTestingModule({
            providers: [
                AnalyticsService,
                { provide: SupabaseService, useValue: { db } },
            ],
        }).compile();

        service = module.get(AnalyticsService);
    });

    describe('getOverview', () => {
        it('returns zeros when creator has no events', async () => {
            db.eq.mockResolvedValue({ data: [], error: null });

            const result = await service.getOverview('creator-1');
            expect(result.total_events).toBe(0);
            expect(result.total_tickets_sold).toBe(0);
            expect(result.total_revenue).toBe(0);
        });

        it('counts paid, pending and scanned tickets correctly', async () => {
            const future = new Date(Date.now() + 86400000).toISOString();
            db.eq.mockResolvedValueOnce({
                data: [
                    { id: 'event-1', status: 'published', starts_at: future },
                ],
                error: null,
            });
            db.in.mockResolvedValueOnce({
                data: [
                    {
                        status: 'paid',
                        amount_paid: 1000,
                        qr_scanned_at: null,
                    },
                    {
                        status: 'paid',
                        amount_paid: 2000,
                        qr_scanned_at: new Date().toISOString(),
                    },
                    {
                        status: 'pending',
                        amount_paid: null,
                        qr_scanned_at: null,
                    },
                ],
                error: null,
            });

            const result = await service.getOverview('creator-1');
            expect(result.total_events).toBe(1);
            expect(result.active_events).toBe(1);
            expect(result.total_tickets_sold).toBe(2);
            expect(result.total_revenue).toBe(3000);
            expect(result.total_attendees).toBe(1);
            expect(result.pending_tickets).toBe(1);
            expect(result.attendance_rate).toBe(50);
        });
    });

    describe('getEventsBreakdown', () => {
        it('returns empty array when creator has no events', async () => {
            db.order.mockResolvedValue({ data: [], error: null });

            const result = await service.getEventsBreakdown('creator-1');
            expect(result).toEqual([]);
        });

        it('aggregates ticket stats per event', async () => {
            db.order.mockResolvedValueOnce({
                data: [
                    {
                        id: 'event-1',
                        title: 'Test event',
                        capacity: 10,
                        status: 'published',
                    },
                ],
                error: null,
            });
            db.in.mockResolvedValueOnce({
                data: [
                    {
                        event_id: 'event-1',
                        status: 'paid',
                        amount_paid: 5000,
                        qr_scanned_at: new Date().toISOString(),
                    },
                    {
                        event_id: 'event-1',
                        status: 'pending',
                        amount_paid: null,
                        qr_scanned_at: null,
                    },
                ],
                error: null,
            });

            const [row] = await service.getEventsBreakdown('creator-1');
            expect(row.tickets_sold).toBe(1);
            expect(row.pending_tickets).toBe(1);
            expect(row.revenue).toBe(5000);
            expect(row.qr_scans).toBe(1);
            expect(row.attendance_rate).toBe(100);
            expect(row.sell_through).toBe(10);
        });
    });

    describe('getEventStats', () => {
        it('throws ForbiddenException for non-owner', async () => {
            db.single.mockResolvedValue({
                data: { id: 'event-1', creator_id: 'other', title: 'Test' },
                error: null,
            });

            await expect(
                service.getEventStats('event-1', 'creator-1'),
            ).rejects.toThrow(ForbiddenException);
        });

        it('throws NotFoundException for missing event', async () => {
            db.single.mockResolvedValue({
                data: null,
                error: { message: 'not found' },
            });

            await expect(
                service.getEventStats('bad-id', 'creator-1'),
            ).rejects.toThrow(NotFoundException);
        });

        it('computes attendance and sell-through for the owner', async () => {
            db.single.mockResolvedValue({
                data: {
                    id: 'event-1',
                    creator_id: 'creator-1',
                    title: 'Test',
                    capacity: 4,
                    ticket_price: 5000,
                },
                error: null,
            });
            // First .eq() call belongs to the event lookup chain (returns the
            // builder); the second ends the tickets query and resolves rows.
            db.eq.mockReturnValueOnce(db).mockResolvedValueOnce({
                data: [
                    {
                        status: 'paid',
                        amount_paid: 5000,
                        qr_scanned_at: new Date().toISOString(),
                    },
                    {
                        status: 'paid',
                        amount_paid: 5000,
                        qr_scanned_at: null,
                    },
                ],
                error: null,
            });

            const result = await service.getEventStats('event-1', 'creator-1');
            expect(result.tickets_sold).toBe(2);
            expect(result.revenue).toBe(10000);
            expect(result.qr_scans).toBe(1);
            expect(result.attendance_rate).toBe(50);
            expect(result.no_shows).toBe(1);
            expect(result.sell_through).toBe(50);
        });
    });
});
