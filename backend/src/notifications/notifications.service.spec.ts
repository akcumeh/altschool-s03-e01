import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { SupabaseService } from '../supabase/supabase.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService - reminder idempotency', () => {
    let service: NotificationsService;
    let db: any;
    let insertMock: jest.Mock;
    let sendEmailSpy: jest.SpyInstance;

    const pendingTicket = {
        ticket_id: 'ticket-1',
        email: 'eventee@example.com',
        name: 'Bob',
        title: 'Cool Event',
        starts_at: new Date(Date.now() + 3600000).toISOString(),
        location: 'Lagos',
        qr_code: 'data:image/png;base64,abc',
    };

    beforeEach(async () => {
        insertMock = jest.fn().mockResolvedValue({ error: null });

        db = {
            rpc: jest.fn(),
            from: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnValue({ error: null }),
        };
        db.from.mockReturnValue({ insert: insertMock });

        const module = await Test.createTestingModule({
            providers: [
                NotificationsService,
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string, def?: any) => def ?? ''),
                        getOrThrow: jest
                            .fn()
                            .mockReturnValue('test@example.com'),
                    },
                },
                { provide: SupabaseService, useValue: { db } },
            ],
        }).compile();

        service = module.get(NotificationsService);
        sendEmailSpy = jest
            .spyOn(service, 'sendEmail')
            .mockResolvedValue(undefined);
    });

    it('sends reminder and logs it for each due ticket', async () => {
        db.rpc.mockResolvedValue({ data: [pendingTicket], error: null });

        await service.sendScheduledReminders();

        expect(sendEmailSpy).toHaveBeenCalledTimes(1);
        expect(insertMock).toHaveBeenCalledWith({ ticket_id: 'ticket-1' });
    });

    it('does not send if rpc returns empty list', async () => {
        db.rpc.mockResolvedValue({ data: [], error: null });

        await service.sendScheduledReminders();

        expect(sendEmailSpy).not.toHaveBeenCalled();
        expect(insertMock).not.toHaveBeenCalled();
    });

    it('continues processing other tickets if one fails', async () => {
        const secondTicket = {
            ...pendingTicket,
            ticket_id: 'ticket-2',
            email: 'b@example.com',
        };
        db.rpc.mockResolvedValue({
            data: [pendingTicket, secondTicket],
            error: null,
        });
        sendEmailSpy
            .mockRejectedValueOnce(new Error('SMTP error'))
            .mockResolvedValueOnce(undefined);

        await service.sendScheduledReminders();

        expect(sendEmailSpy).toHaveBeenCalledTimes(2);
        expect(insertMock).toHaveBeenCalledTimes(1);
    });
});
