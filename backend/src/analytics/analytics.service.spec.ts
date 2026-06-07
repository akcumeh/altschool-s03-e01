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
            expect(result.total_tickets_sold).toBe(0);
            expect(result.total_revenue).toBe(0);
        });

        it('counts paid tickets correctly', async () => {
            db.eq
                .mockResolvedValueOnce({
                    data: [{ id: 'event-1' }],
                    error: null,
                })
                .mockResolvedValueOnce({
                    data: [
                        { amount_paid: 1000, qr_scanned_at: null },
                        {
                            amount_paid: 2000,
                            qr_scanned_at: new Date().toISOString(),
                        },
                    ],
                    error: null,
                });

            const result = await service.getOverview('creator-1');
            expect(result.total_tickets_sold).toBe(2);
            expect(result.total_revenue).toBe(3000);
            expect(result.total_attendees).toBe(1);
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
    });
});
