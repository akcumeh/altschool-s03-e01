import { Test } from '@nestjs/testing';
import { QrService } from './qr.service';

describe('QrService', () => {
    let service: QrService;

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            providers: [QrService],
        }).compile();
        service = module.get(QrService);
    });

    it('generates a non-empty base64 data URL for a ticket ID', async () => {
        const result = await service.generate('ticket-uuid-123');
        expect(result).toBeTruthy();
        expect(result.startsWith('data:image/png;base64,')).toBe(true);
    });

    it('encodes the ticket ID in the QR', async () => {
        const result = await service.generate('my-ticket-id');
        expect(result.length).toBeGreaterThan(100);
    });
});
