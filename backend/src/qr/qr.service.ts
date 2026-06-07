import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';

@Injectable()
export class QrService {
    async generate(ticketId: string): Promise<string> {
        return QRCode.toDataURL(ticketId);
    }
}
