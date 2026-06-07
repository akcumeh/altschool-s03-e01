import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as crypto from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { QrService } from '../qr/qr.service';
import { SupabaseService } from '../supabase/supabase.service';
import { TicketsService } from '../tickets/tickets.service';
import { PaymentService } from './payment.service';

describe('PaymentService', () => {
    let service: PaymentService;
    const webhookSecret = 'test-webhook-secret';

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            providers: [
                PaymentService,
                {
                    provide: ConfigService,
                    useValue: {
                        getOrThrow: (key: string) => {
                            if (key === 'PAYSTACK_SECRET_KEY')
                                return webhookSecret;
                            return '';
                        },
                        get: jest.fn(),
                    },
                },
                {
                    provide: SupabaseService,
                    useValue: { db: { from: jest.fn() } },
                },
                {
                    provide: TicketsService,
                    useValue: {
                        findByPaystackReference: jest.fn(),
                        updateAfterPayment: jest.fn(),
                    },
                },
                {
                    provide: QrService,
                    useValue: {
                        generate: jest
                            .fn()
                            .mockResolvedValue('data:image/png;base64,abc'),
                    },
                },
                {
                    provide: NotificationsService,
                    useValue: { sendTicketEmail: jest.fn() },
                },
            ],
        }).compile();

        service = module.get(PaymentService);
    });

    function makeSignature(body: Buffer): string {
        return crypto
            .createHmac('sha512', webhookSecret)
            .update(body)
            .digest('hex');
    }

    describe('verifyWebhookSignature', () => {
        it('returns true for valid signature', () => {
            const body = Buffer.from(
                JSON.stringify({ event: 'charge.success' }),
            );
            const sig = makeSignature(body);
            expect(service.verifyWebhookSignature(body, sig)).toBe(true);
        });

        it('returns false for invalid signature', () => {
            const body = Buffer.from(
                JSON.stringify({ event: 'charge.success' }),
            );
            expect(service.verifyWebhookSignature(body, 'invalidsig')).toBe(
                false,
            );
        });
    });

    describe('handleWebhook', () => {
        it('throws BadRequestException for invalid signature', async () => {
            const body = Buffer.from('{}');
            await expect(service.handleWebhook(body, 'badsig')).rejects.toThrow(
                BadRequestException,
            );
        });

        it('ignores non-charge.success events', async () => {
            const body = Buffer.from(
                JSON.stringify({ event: 'transfer.success' }),
            );
            const sig = makeSignature(body);
            await expect(
                service.handleWebhook(body, sig),
            ).resolves.toBeUndefined();
        });
    });
});
